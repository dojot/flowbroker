var config = require('./config');
var amqp = require('./amqp');
var util = require('util');
var node = require('./nodeManager').Manager;
var redisManager = require('./redisManager').RedisManager;

var dojotModule = require("@dojot/dojot-module");
var logger = require("@dojot/dojot-module-logger").logger;
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
    logger.debug("Registering callbacks for tenancy subject...", {filename:"ingestor"});
    this.kafkaMessenger.on(dojotConfig.dojot.subjects.tenancy, "new-tenant", (tenant, newtenant) => {
      node.addTenant(newtenant, this.kafkaMessenger);
    });
    logger.debug("... callbacks for tenancy registered.", {filename:"ingestor"});

    //device-manager subject
    logger.debug("Registering callbacks for device-manager device subject...", {filename:"ingestor"});
    this.kafkaMessenger.on(dojotConfig.dojot.subjects.devices, "message", (tenant, msg) => {
      try {
        let parsed = JSON.parse(msg);
        if (parsed.event === 'update' || parsed.event === 'remove'){
          this.handleUpdate(parsed);
        }
      } catch (error) {
        logger.error(`Device-manager event ingestion failed: ${error.message}`, {filename:"ingestor"});
      }
    });
    logger.debug("... callbacks for device-manager registered.", {filename:"ingestor"});

    // device-data subject
    logger.debug("Registering callbacks for device-data device subject...", {filename:"ingestor"});
    this.kafkaMessenger.on(dojotConfig.dojot.subjects.deviceData, "message", (tenant, msg) => {
      let parsed = null;
      try {
        parsed = JSON.parse(msg);
      } catch (e) {
        logger.error("Device-data event is not valid json. Ignoring.", {filename:"ingestor"});
        return;
      }
      try {
        this.handleEvent(parsed);
      } catch (error) {
        logger.error(`Device-data event ingestion failed: ${error.message}`, {filename:"ingestor"});
      }
    });
    logger.debug("... callbacks for device-data registered.", {filename:"ingestor"});

    // Initializes flow nodes by tenant ...
    logger.debug("Initializing flow nodes for current tenants ...", {filename:"ingestor"});
    for (const tenant of this.kafkaMessenger.tenants) {
      logger.debug(`Initializing nodes for ${tenant} ...`, {filename:"ingestor"});
      node.addTenant(tenant, this.kafkaMessenger);
      logger.debug(`... nodes initialized for ${tenant}.`, {filename:"ingestor"});
    }
    logger.debug("... flow nodes initialized for current tenants.", {filename:"ingestor"});

    //Connects to RabbitMQ
    this.amqp.connect();
  }

  _publish(node, message, flow, metadata) {
    if (node.hasOwnProperty('status') &&
      (node.status.toLowerCase() !== 'true') &&
      metadata.hasOwnProperty('reason') &&
      (metadata.reason === 'statusUpdate')) {
      logger.debug(`Ignoring device status update ${metadata.deviceid} ${flow.id}`, {filename:"ingestor"});
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
    logger.debug(`Got new device event: ${util.inspect(event, { depth: null })}`, {filename:"ingestor"});
    let flowManager = this.fmBuiler.get(event.metadata.tenant);
    flowManager.getByDevice(event.metadata.deviceid).then((flowlist) => {
      for (let flow of flowlist) {
        this.handleFlow(event, flow, false);
      }
    });

    this.client.getDeviceInfo(event.metadata.tenant, event.metadata.deviceid, this.redis.getState()).then((data) => {

      event.metadata.templates = data.templates;

      if (data.staticAttrs !== null) {
        if (event.metadata.hasOwnProperty('reason')) {
          if (event.metadata.reason === 'statusUpdate') {
            event.attrs = {};
          }
        }
        // Copy static attrs to event.attrs
        for (var attr in data.staticAttrs) {
          event.attrs[attr] = data.staticAttrs[attr];
        }
      }

      for (let template of data.templates) {
        flowManager.getByTemplate(template).then( (flowlist) => {
          for (let flow of flowlist) {
            this.handleFlow(event, flow, true);
          }
        });
      }
    }).catch((error) => {
      logger.debug(error, {filename:"ingestor"});
    })
  }

  handleUpdate(tenant, deviceid) {
    this.client.deleteDevice(tenant, deviceid);
  }
};
