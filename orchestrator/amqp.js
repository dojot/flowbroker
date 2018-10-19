"use strict";

/**
 * Feeds messages to the flow engine, mapping received messages to known configured flows
 */
var amqp = require('amqplib/callback_api');
var config = require('./config');
var logger = require("@dojot/dojot-module-logger").logger;
var util = require("util");

const TAG={filename:"amqp"}

class AMQPBase {
  constructor(target) {
    this.target = target || config.amqp.url;
    this.connection = null;
    this.channel = null;
    this.callbacks = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      logger.debug(`Connecting to AMQP endpoint: ${this.target}...`, TAG);
      amqp.connect(this.target, (error, connection) => {
        if (error) {
          logger.debug(`... failure while connecting to AMQP target.`, TAG);
          logger.error(`Error while connecting to AMQP target: ${error}.`, TAG);
          return reject(error);
        }
        logger.debug(`... successfully connected to AMQP target.`);
        this.connection = connection;
        logger.debug(`Invoking callbacks...`, TAG);
        for (let callback in this.callbacks.connection) {
          if (this.callbacks.connection.hasOwnProperty(callback)) {
            callback(this.connection);
          }
        }
        logger.debug(`... callbacks invoked.`, TAG);

        logger.debug(`Creating channel...`, TAG);
        this.connection.createChannel((error, channel) => {
          if (error) {
            logger.debug(`... error while creating channel: ${error}.`, TAG);
            return reject(error);
          }

          channel.prefetch(1); // only 1 unacked msg
          logger.debug(`... channel successfully created.`, TAG);
          logger.debug(`Advertising newly created channel...`, TAG);
          this.channel = channel;
          let list = this.callbacks.channel;
          for (let i = 0; i < list.length; i++) {
            list[i](channel);
          }
          logger.debug(`... new channel was successfully advertised.`, TAG);
          logger.info("Connected to AMQP target.", TAG);
          return resolve();
        });
        logger.debug(`... channel creation requested.`, TAG);
      });
      logger.debug(`... connection request created.`, TAG);
    });
  }

  on(event, callback) {
    logger.debug(`Registering new callback for event ${event}`, TAG);
    let registered = [];
    if (this.callbacks.hasOwnProperty(event)) {
      registered = this.callbacks[event];
    }

    registered.unshift(callback);
    this.callbacks[event] = registered;
    logger.debug(`... event ${event} was successfully registered.`, TAG);
  }
}

class AMQPProducer extends AMQPBase {
  constructor(queue, target, maxPriority) {
    if (queue === undefined) {
      throw new Error("Queue must be defined");
    }

    super(target);
    this.queue = queue;
    this.backtrack = [];

    this.on('channel', (channel) => {
      logger.debug(`Processing new channel...`, TAG);
      channel.assertQueue(this.queue, { durable: true, maxPriority: maxPriority});
      logger.debug('AMQP producer is ready. ', TAG);

      logger.debug(`Sending all queued messages...`, TAG);
      let event = this.backtrack.pop();
      while (event) {
        this.sendMessage(event.data, event.priority);
        event = this.backtrack.pop();
      }
      logger.debug(`... all queued messages were sent.`, TAG);
      logger.debug(`... new channel was successfully processed.`, TAG);
    });
  }

  sendMessage(data, priority = 0) {
    logger.debug(`Sending data: ${util.inspect(data)}, priority: ${priority}...`, TAG);
    if (this.channel) {
      let buffer = new Buffer(data);
      // console.log('Will send message [%s] %s', this.queue, data);
      this.channel.sendToQueue(this.queue, buffer, { persistent: true, priority: priority });
      logger.debug(`... data was successfully sent.`, TAG);
      return;
    } else {
      logger.debug(`... data not sent: channel not ready yet.`, TAG);
      logger.info("Could not send message to AMQP target: channel not yet ready.", TAG);
      logger.info("Message will be stored for future transmission.", TAG);
      this.backtrack.push({data, priority});
    }
  }
}

class AMQPConsumer extends AMQPBase {
  constructor(queue, onMessage, target, maxPriority) {
    logger.debug(`Creating AMQP consumer...`, TAG);
    logger.debug(`Target: ${target}, maximum priority: ${maxPriority}`, TAG);
    if (queue === undefined || onMessage === undefined) {
      logger.error(`Error while creating AMQP consumer: both queue and message callbacks must be defined.`, TAG);
      throw new Error("Both queue and message callbacks must be defined");
    }

    super(target);
    this.queue = queue;
    logger.debug(`Registering callback to new consumer...`, TAG);
    this.on('channel', (channel) => {
      logger.info(`AMQP consumer is ready.`, TAG);
      logger.debug(`Processing new AMQP consumer channel...`, TAG);
      channel.assertQueue(this.queue, { durable: true, maxPriority: maxPriority });
      channel.consume(this.queue, (amqpCtx) => {
        onMessage(amqpCtx.content.toString(), () => {
          channel.ack(amqpCtx);
        });
      });
      logger.debug("... new AMQP consumer channel was successfully processed.", TAG);
    });
    logger.debug(`... callback for new consumer was successfully registered.`, TAG);
  }
}

module.exports = {
  AMQPConsumer: AMQPConsumer,
  AMQPProducer: AMQPProducer
};
