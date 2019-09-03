var config = require('./config');
var amqp = require('./amqp');
var util = require('util');
var node = require('./nodeManager').Manager;
var redisManager = require('./redisManager').RedisManager;
var logger = require("@dojot/dojot-module-logger").logger;
var auth = require("@dojot/dojot-module").Auth;

// class InitializationError extends Error {}

function hotfixTemplateIdFormat(message) {
  let msg = JSON.parse(message);
  if ( (msg.event === "create") || (msg.event === "update") ) {
    let templates = [];
    for (let templateId of msg.data.templates) {
      templates.push(templateId.toString());
    }
    msg.data.templates = templates;
  }

  message = JSON.stringify(msg);
  return message;
}

module.exports = class DeviceIngestor {
  /**
   * Constructor.
   * @param {FlowManagerBuilder} fmBuilder Builder instance to be used when parsing received events
   */
  constructor(fmBuilder, kafkaMessenger) {
    // using redis as cache
    this.redis = new redisManager();
    this.deviceCache = this.redis.getClient("deviceCache");

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
    // Create a channel using a particular for notificarions
    this.kafkaMessenger.createChannel(config.kafkaMessenger.dojot.subjects.notification, "rw");

    return auth.getTenants(config.kafkaMessenger.auth.host).then((tenants) => {
      return this.deviceCache.populate(tenants).then(() => {
        //tenancy subject
        logger.debug("Registering callbacks for tenancy subject...");
        this.kafkaMessenger.on(config.kafkaMessenger.dojot.subjects.tenancy,
          "new-tenant", (tenant, newtenant) => {
            node.addTenant(newtenant, this.kafkaMessenger).catch((error) => {
              logger.error(`Failed to add tenant ${newtenant} to node handler (${error}). Bailing out...`);
              process.kill(process.pid, "SIGTERM");
            });
          }
        );
        logger.debug("... callbacks for tenancy registered.");

        //device-manager subject
        logger.debug("Registering callbacks for device-manager device subject...");
        this.kafkaMessenger.on(config.kafkaMessenger.dojot.subjects.devices,
          "message", (tenant, message) => {
            message = hotfixTemplateIdFormat(message);
            let event = {
              source: 'device-manager',
              message: message
            };
            this._enqueueEvent(event).then(() => {
              logger.debug(`Queued event ${event}`);
            }).catch((error) => {
              logger.warn(`Failed to enqueue event ${event}. Error: ${error}`);
            });
          }
        );
        logger.debug("... callbacks for device-manager registered.");

        // device-data subject
        logger.debug("Registering callbacks for device-data device subject...");
        this.kafkaMessenger.on(config.kafkaMessenger.dojot.subjects.deviceData,
          "message", (tenant, message) => {
            let event = {
              source: "device",
              message: message
            };
            this._enqueueEvent(event).then(() => {
              logger.debug(`Queued event ${event}`);
            }).catch((error) => {
              logger.warn(`Failed to enqueue event ${event}. Error: ${error}`);
            });
          }
        );
        logger.debug("... callbacks for device-data registered.");

        // Initializes flow nodes by tenant ...
        logger.debug("Initializing flow nodes for current tenants ...");
        for (const tenant of this.kafkaMessenger.tenants) {
          logger.debug(`Initializing nodes for ${tenant} ...`)
          node.addTenant(tenant, this.kafkaMessenger).catch((error) => {
            logger.error(`Failed to add tenant ${tenant} to node handler (${error}). Bailing out...`);
            process.kill(process.pid, "SIGTERM");
          });
          logger.debug(`... nodes initialized for ${tenant}.`)
        }
        logger.debug("... flow nodes initialized for current tenants.");

        // Connects to RabbitMQ
        return Promise.all([this.amqpTaskProducer.connect(),
          this.amqpEventProducer.connect(), this.amqpEventConsumer.connect()]).then(() => {
            logger.debug('Connections established with RabbitMQ!');
          }).catch( errors => {
            logger.error(`Failed to establish connections with RabbitMQ. Error = ${errors}`);
            process.exit(1);
          });
      });
    });
  }

  /**
   * @brief This method publishes the next tasks given the current node.
   * @warning If an error occurs, there is no rollback from the messages sent,
   * so be aware
   * @param {*} node the current node (processed task)
   * @param {*} message the message to be send to the next tasks
   * @param {*} flow the flow which the node belongs
   * @param {*} metadata an object with the metadatas ('tenant', 'deviceId' and 'timestamp')
   */
  async _publish(node, message, flow, metadata) {
    let sendMsgPromises = [];
    // new events must have the lowest priority in the queue, in this way
    // events that are being processed can be finished first
    // This should work for single output nodes only!
    for (let output of node.wires) {
      for (let hop of output) {
        let sendMsgPromise = this.amqpTaskProducer.sendMessage(JSON.stringify({
          hop: hop,
          message: message,
          flow: flow,
          metadata: {
            tenant: metadata.tenant,
            originator: metadata.deviceId,
            timestamp: metadata.timestamp
          }
        }), 0);
        let reflectPromise = sendMsgPromise.then(r => ({isFulfilled: true, data: r})).catch(r => ({isFulfilled: false, data: r}));
        sendMsgPromises.push(reflectPromise);
      }
    }

    return Promise.all(sendMsgPromises).then((promises) => {
      for (let i = 0; i < promises.length; i++) {
          let promise = promises[i];
          if (!promise.isFulfilled) {
            this.logger.warn(`Failed to publish some data. Error: ${promise.data}`);
          }
      }
      return Promise.resolve();
    }).catch((error) => {
      this.logger.Error(`Unexpect error on publish message. Error: ${error}`);
      return Promise.reject('Internal error');
    });
  }

  async _handleFlow(tenant, deviceId, timestamp, templates, message, flow, source) {
    flow.nodeMap = {};
    for (let node of flow.red) {
      flow.nodeMap[node.id] = node;
    }

    let publishPromises = [];

    for (let head of flow.heads) {
      const node = flow.nodeMap[head];
      let publishPromise = null;
      switch (node.type) {
        case 'device in':
        case 'device template in':
          if (source === 'publish') {
            publishPromise = this._publish(node, { payload: message.data.attrs }, flow, {tenant, deviceId, timestamp});
          }
        break;
        case 'event device in':
          if ( (node.device_id === deviceId) && node['event_' + source] ) {
            publishPromise = this._publish(node, { payload: message }, flow, {tenant, deviceId, timestamp});
          }
        break;
        case 'event template in':
          if (templates.includes(node.template_id) && node['event_' + source]) {
            publishPromise = this._publish(node, { payload: message }, flow, {tenant, deviceId, timestamp});
          }
        break;
        default:
          logger.error(`Unsupported node type ${node.type}`);
          break;
      }

      if (publishPromise !== null) {
        let reflectPromise = publishPromise.then(r => ({isFulfilled: true, data: r})).catch(r => ({isFulfilled: false, data: r}));
        publishPromises.push(reflectPromise);
      }
    }

    return Promise.all(publishPromises).then((promises) => {
      for (let i = 0; i < promises.length; i++) {
          let promise = promises[i];
          if (!promise.isFulfilled) {
            this.logger.warn(`Failed to handle some flow. Error: ${promise.data}`);
          }
      }
      return Promise.resolve();
    }).catch((error) => {
      this.logger.Error(`Unexpected error on handle some flow. Error: ${error}`);
      return Promise.reject('Internal error');
    });
  }

  _handleEvent(tenant, deviceId, timestamp, templates, source, event) {
    logger.debug(`[ingestor] got new device event: ${util.inspect(event, { depth: null })}`);
    let flowManager = this.fmBuiler.get(tenant);

    let flowsPromise = [];
    // flows starting with a given device
    flowsPromise.push(flowManager.getByDevice(deviceId));

    // flows starting with a given template
    for (let template of templates) {
      flowsPromise.push(flowManager.getByTemplate(template));
    }

    return Promise.all(flowsPromise).then(flowLists => {

      let uniqueFlows = {};
      // remove possible repeated flows
      for (let flows of flowLists) {
        for (let flow of flows) {
          uniqueFlows[flow.id] = flow;
        }
      }

      let handleFlowPromises = [];
      for (let flow of Object.values(uniqueFlows)) {
        let promise = this._handleFlow(tenant, deviceId, timestamp, templates, event, flow, source);

        let reflectPromise = promise.then(r => ({isFulfilled: true, data: r})).catch(r => ({isFulfilled: false, data: r}));
        handleFlowPromises.push(reflectPromise);
      }
      
      return Promise.all(handleFlowPromises).then((promises) => {
        for (let i = 0; i < promises.length; i++) {
            let promise = promises[i];
            if (!promise.isFulfilled) {
              this.logger.warn(`Failed to handle some flow. Error: ${promise.data}`);
            }
        }
        return Promise.resolve();
      }).catch((error) => {
        this.logger.Error(`Unexpected error on handle some flow. Error: ${error}`);
        return Promise.reject('Internal error');
      });
    });
  }

  _enqueueEvent(event) {
    return this.amqpEventProducer.sendMessage(JSON.stringify(event));
  }

  preProcessEvent(eventStringfied, ack) {
    logger.debug(`Pre-processing event ${eventStringfied}`);

    try {
      let event = JSON.parse(eventStringfied);
      let preProcessPromise;

      switch(event.source){
        case 'device-manager':
          preProcessPromise = this._preProcessDeviceManagerEvent(event.message);
          break;
        case 'device':
          preProcessPromise = this._preProcessDeviceEvent(event.message);
          break;
        default:
          logger.error(`Unsupported event source ${event.source}`);
          return ack();
      }

      preProcessPromise.then( () => {
        return ack();
      }).catch( error => {
        logger.error(`Problem on pre process event. Reason: ${error}`);
        return ack();
      });
    } catch (error) {
      logger.error(`Problem on pre process event. Reason: ${error}`);
      return ack();
    }
  }


  async _preProcessDeviceManagerEvent(messageStringfied) {

    try {
      let message = JSON.parse(messageStringfied);

      // rename/move some attributes to uniformize with the device event
      message.metadata = message.meta;
      message.metadata.tenant = message.metadata.service;
      delete message.meta;
      delete message.metadata.service;

      switch(message.event) {
        case 'create':
        case 'update':
          // we really don't care if the data was saved successfully into the
          // cache, it only affects performance not the behavior
          return this.deviceCache.addDevice(message).catch((error) => {
            logger.warn(`failed to write data on cache, system performance could be compromised. Error: ${error}`);

          }).then(() => {
            this._transformDeviceEvent(message);
            return this._handleEvent(message.metadata.tenant, message.data.id, undefined, message.data.templates, message.event, message);
          });
        case 'remove':
          return this.deviceCache.getDeviceInfo(message.metadata.tenant, message.data.id).then((deviceData) => {
            return this.deviceCache.deleteDevice(message.metadata.tenant, message.data.id).catch(() => {
              logger.warn('failed to delete data from cache');
            }).then(() => {
              return this._handleEvent(message.metadata.tenant, message.data.id, undefined, deviceData.templates, message.event, message);
            });
          }).catch( (error) => {
            logger.error(`[ingestor] device-manager event ingestion failed: ${error}`);
            return Promise.reject('Failed to processe device manager delete message');
          });
        case 'configure':
          return this.deviceCache.getDeviceInfo(message.metadata.tenant, message.data.id).then((deviceData) => {
            if (deviceData.staticAttrs) {
              // Copy the static attrs to the event
              for (let attr in deviceData.staticAttrs) {
                message.data.attrs[attr] = deviceData.staticAttrs[attr].value;
              }
            }
            return this._handleEvent(message.metadata.tenant, message.data.id, undefined, deviceData.templates, message.event, message);
          }).catch( (error) => {
            logger.error(`[ingestor] device-manager event ingestion failed: ${error}`);
            return Promise.reject('Failed to processe device manager configure message');
          });
        default:
        logger.warn(`[ingestor] unsupported device manager event ${message.event}`);
        return Promise.reject('Unsupported device manager event');
      }
    } catch (error) {
      logger.warn(`[ingestor] device-manager event ingestion failed: `, error.message);
      return Promise.reject('Failed to processe device manager event');
    }
  }

  async _preProcessDeviceEvent(messageStringfied) {
    let message;

    try {
      message = JSON.parse(messageStringfied);

      // rename some attributes to uniformize with the device manager event
      message.event = "publish";
      message.data = {};
      message.data.attrs = message.attrs;
      message.data.id = message.metadata.deviceid;
      delete message.attrs;
      delete message.metadata.deviceid;
    } catch (error) {
      logger.error(`[ingestor] Fail to parse device event: ${error.message}`);
      return Promise.reject();
    }

    return this.deviceCache.getDeviceInfo(message.metadata.tenant, message.data.id)
    .then((deviceData) => {

      if (deviceData.staticAttrs) {
        // Copy static attrs to event.attrs
        for (let attr in deviceData.staticAttrs) {
          message.data.attrs[attr] = deviceData.staticAttrs[attr].value;
        }
      }
      return this._handleEvent(message.metadata.tenant, message.data.id, message.metadata.timestamp, deviceData.templates, message.event, message);
    }).catch((error) => {
      logger.error(`[ingestor] device-manager event ingestion failed: ${error}`);
      return Promise.reject('Failed to process device event');
    });

  }

  /**
   * Transforms devices related events to become more friendly.
   * @param {*} event
   */
  _transformDeviceEvent(event) {
    let attrs = {};
    for (let template of Object.keys(event.data.attrs) ) {
        let templateAttrs = event.data.attrs[template];
        for (let attr of templateAttrs) {
            let label = attr.label;
            delete attr.label;
            attrs[label] = attr;
        }
    }
    delete event.data.attrs;
    event.data.attrs = attrs;
    return event;
}

};
