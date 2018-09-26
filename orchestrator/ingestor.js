var config = require('./config');
var amqp = require('./amqp');
var util = require('util');
var node = require('./nodeManager').Manager;
var redisManager = require('./redisManager').RedisManager;

var dojotModule = require("@dojot/dojot-module");
var dojotConfig = dojotModule.Config;

// class InitializationError extends Error {}

module.exports = class DeviceIngestor {
  /**
   * Constructor.
   * @param {FlowManagerBuilder} fmBuilder Builder instance to be used when parsing received events
   */
  constructor(fmBuilder, kafka) {
    // using redis as cache
    this.redis = new redisManager();
    this.client = this.redis.getClient();
    
    // flow builder
    this.fmBuiler = fmBuilder;

    // rabbitmq
    this.amqp = new amqp.AMQPProducer(config.amqp.queue, config.amqp.url, 2);

    // kafka
    this.kafkaMessenger = kafka;
  }

  /**
   * Initializes device ingestor: Kafka, RabbitMQ ...
   */
  init() {
    //TODO: The messages must be read from kafka in the pace
    //      flowbroker can process them, otherwise, all messages
    //      will be processed in parallel, so their running will prolong,
    //      and flowbroker will seem very slow!!
    //tenancy subject
    console.log("Registering callbacks for tenancy subject...");
    this.kafkaMessenger.on(dojotConfig.dojot.subjects.tenancy, "new-tenant", (tenant, newtenant) => {
      node.addTenant(newtenant, this.kafkaMessenger)});
    console.log("... callbacks for tenancy registered.");

    //device-manager subject
    console.log("Registering callbacks for device-manager device subject...");
    this.kafkaMessenger.on(dojotConfig.dojot.subjects.devices, "message", (tenant, msg) => {
      try {
        let parsed = JSON.parse(msg);
        if (parsed.event === 'update' || parsed.event === 'remove'){
          this.handleUpdate(parsed);
        }
      } catch (error) {
        console.error(`[ingestor] device-manager event ingestion failed: `, error.message);
      }
    });
    console.log("... callbacks for device-manager registered.");

    // device-data subject
    console.log("Registering callbacks for device-data device subject...");
    this.kafkaMessenger.on(dojotConfig.dojot.subjects.deviceData, "message", (tenant, msg) => {
      let parsed = null;
      try {
        parsed = JSON.parse(msg);
      } catch (e) {
        console.error("[ingestor] device-data event is not valid json. Ignoring.");
        return;
      }
      try {
        this.handleEvent(parsed);
      } catch (error) {
        console.error('[ingestor] device-data event ingestion failed: ', error.message);
      }
    });
    console.log("... callbacks for device-data registered.");

    // Initializes flow nodes by tenant ...
    console.log("Initializing flow nodes for current tenants ...");
    for (const tenant of this.kafkaMessenger.tenants) {
      console.log(`Initializing nodes for ${tenant} ...`)
      node.addTenant(tenant, this.kafkaMessenger);
      console.log(`... nodes initialized for ${tenant}.`)
    }
    console.log("... flow nodes initialized for current tenants.");

    //Connects to RabbitMQ
    this.amqp.connect();
  }

  _publish(node, message, flow, metadata) {
    if (node.hasOwnProperty('status') &&
      (node.status.toLowerCase() !== 'true') &&
      metadata.hasOwnProperty('reason') &&
      (metadata.reason === 'statusUpdate')) {
      console.log(`[ingestor] ignoring device status update ${metadata.deviceid} ${flow.id}`);
      return;
    }

    // new events must have the lowest priority in the queue, in this way
    // events that are being processed can be finished first
    // This should work for single output nodes only!
    for (let output of node.wires) {
      for (let hop of output) {
        this.amqp.sendMessage(JSON.stringify({
          hop: hop,
          message: message,
          flow: flow,
          metadata: {
            tenant: metadata.tenant,
            originator: metadata.deviceid
          }
        }), 0);
      }
    }
  }

  handleFlow(event, flow, isTemplate) {
    flow.nodeMap = {};
    for (let node of flow.red) {
      flow.nodeMap[node.id] = node;
    }

    for (let head of flow.heads) {
      const node = flow.nodeMap[head];
      // handle input by device
      if (node.hasOwnProperty('_device_id') &&
        (node._device_id === event.metadata.deviceid) &&
        (isTemplate === false)) {
        this._publish(node, { payload: event.attrs }, flow, event.metadata);
      }

      // handle input by template
      if (node.hasOwnProperty('device_template_id') &&
        event.metadata.hasOwnProperty('templates') &&
        (event.metadata.templates.includes(node.device_template_id)) &&
        (isTemplate === true)) {
        this._publish(node, { payload: event.attrs }, flow, event.metadata);
      }
    }
  }

  handleEvent(event) {
    console.log(`[ingestor] got new device event: ${util.inspect(event, { depth: null })}`);
    let flowManager = this.fmBuiler.get(event.metadata.tenant);
    flowManager.getByDevice(event.metadata.deviceid).then((flowlist) => {
      for (let flow of flowlist) {
        this.handleFlow(event, flow, false);
      }
    });

    this.client.getTemplateList(event.metadata.tenant, event.metadata.deviceid, this.redis.getState()).then((data) => {
      event.metadata.templates = data.templates;
      for (let template of data.templates) {
        flowManager.getByTemplate(template).then( (flowlist) => {
          for (let flow of flowlist) {
            this.handleFlow(event, flow, true);
          }
        });
      }
    }).catch((error) => {
      console.log(error);
    })
  }

  handleUpdate(event) {
    console.log(`[ingestor] got new device info update: ${util.inspect(event, { depth: null})}`);
    this.client.deleteDevice(event.meta.service, event.data.id);
  }
};
