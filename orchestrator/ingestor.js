var config = require('./config');
var amqp = require('./amqp');
var util = require('util');
var node = require('./nodeManager').Manager;
var redisManager = require('./redisManager').RedisManager;

var logger = require("@dojot/dojot-module-logger").logger;

const TAG={filename: "ingestor"};

// class InitializationError extends Error {}

module.exports = class DeviceIngestor {
  /**
   * Constructor.
   * @param {FlowManagerBuilder} fmBuilder Builder instance to be used when parsing received events
   */
  constructor(fmBuilder, kafkaMessenger) {
    // using redis as cache
    this.redis = new redisManager();
    this.client = this.redis.getClient();

    // flow builder
    this.fmBuiler = fmBuilder;

    // rabbitmq
    this.preProcessEvent = this.preProcessEvent.bind(this);
    this.amqpTaskProducer = new amqp.AMQPProducer(config.amqp.queue, config.amqp.url, 2);
    this.amqpEventProducer = new amqp.AMQPProducer(config.amqp.event_queue, config.amqp.url, 1);
    this.amqpEventConsumer = new amqp.AMQPConsumer(config.amqp.event_queue, this.preProcessEvent,
      config.amqp.url, 1);

    // kafka messenger
    this.kafkaMessenger = kafkaMessenger;
  }

  /**
   * Initializes device ingestor: Kafka, RabbitMQ ...
   */
  init() {
    //tenancy subject
    logger.debug("Registering callbacks for tenancy subject...", TAG);
    this.kafkaMessenger.on(config.kafkaMessenger.dojot.subjects.tenancy,
      "new-tenant", (tenant, newtenant) => {
        node.addTenant(newtenant, this.kafkaMessenger)});
    logger.debug("... callbacks for tenancy registered.", TAG);

    //device-manager subject
    logger.debug("Registering callbacks for device-manager device subject...", TAG);
    this.kafkaMessenger.on(config.kafkaMessenger.dojot.subjects.devices,
      "message", (tenant, msg) => {
        try {
          let parsed = JSON.parse(msg);
        if (parsed.event === 'update' || parsed.event === 'remove'){
          this.handleUpdate(parsed);
        }
      } catch (error) {
        logger.error(`DeviceManager event ingestion failed: ${error.message}.`, TAG);
      }
    });
    logger.debug("... callbacks for device-manager registered.", TAG);

    // device-data subject
    logger.debug("Registering callbacks for device-data device subject...", TAG);
    this.kafkaMessenger.on(config.kafkaMessenger.dojot.subjects.deviceData,
      "message", (tenant, msg) => {

      this.enqueueEvent(msg);
    });
    logger.debug("... callbacks for device-data registered.", TAG);

    // Initializes flow nodes by tenant ...
    logger.debug("Initializing flow nodes for current tenants ...", TAG);
    for (const tenant of this.kafkaMessenger.tenants) {
      logger.debug(`Initializing nodes for ${tenant} ...`, TAG);
      node.addTenant(tenant, this.kafkaMessenger);
      logger.debug(`... nodes initialized for ${tenant}.`, TAG);
    }
    logger.debug("... flow nodes initialized for current tenants.", TAG);

    // Connects to RabbitMQ
    Promise.all(
      [this.amqpTaskProducer.connect(),
        this.amqpEventProducer.connect(),
        this.amqpEventConsumer.connect()]).then(() => {
          logger.debug('Connections established with RabbitMQ!', TAG);
        }).catch( errors => {
          logger.error(`Failed to establish connections with RabbitMQ. Error = ${errors}`, TAG);
          process.exit(1);
        });
  }

  _publish(node, message, flow, metadata) {
    if (node.hasOwnProperty('status') &&
      (node.status.toLowerCase() !== 'true') &&
      metadata.hasOwnProperty('reason') &&
      (metadata.reason === 'statusUpdate')) {
      logger.debug(`Ignoring device status update ${metadata.deviceid} ${flow.id}`, TAG);
      return;
    }

    // new events must have the lowest priority in the queue, in this way
    // events that are being processed can be finished first
    // This should work for single output nodes only!
    for (let output of node.wires) {
      for (let hop of output) {
        this.amqpTaskProducer.sendMessage(JSON.stringify({
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
    logger.debug(`Got new device event: ${util.inspect(event, { depth: null })}`, TAG);
    let flowManager = this.fmBuiler.get(event.metadata.tenant);

    return this.client.getDeviceInfo(event.metadata.tenant, event.metadata.deviceid,
      this.redis.getState()).then((data) => {

        // update event with template and static attr info
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

        let flowsPromise = [];
        // [0]: flows starting with a given device
        flowsPromise.push(flowManager.getByDevice(event.metadata.deviceid));

        // [1..N]: flows starting with a given template
        for (let template of data.templates) {
          flowsPromise.push(flowManager.getByTemplate(template));
        }

        return Promise.all(flowsPromise);
      }).then(flowLists => {

        // [0]: flows starting with a given device
        let flows = flowLists.shift();
        for (let flow of flows) {
          this.handleFlow(event, flow, false);
        }

        // [1..N]: flows starting with a given template
        for (let flows of flowLists) {
          for (let flow of flows) {
            this.handleFlow(event, flow, true);
          }
        }
      });
  }

  handleUpdate(tenant, deviceid) {
    this.client.deleteDevice(tenant, deviceid);
  }

  enqueueEvent(event) {
    this.amqpEventProducer.sendMessage(event);
    logger.debug(`Queued event ${event}`, TAG);
  }

  preProcessEvent(event, ack) {
    logger.debug(`Pre-processing event ${event}`, TAG);

    let parsed = null;
    try {
      parsed = JSON.parse(event);
    } catch (e) {
      logger.error("Event is not valid json. Ignoring.", TAG);
      return ack();
    }

    this.handleEvent(parsed).then( () => {
      return ack();
    }).catch( error => {
      logger.error(`Coudn't enqueue message. Reason: ${error}`, TAG);
      return ack();
    });
  }

};
