"use strict";

/**
 * Feeds messages to the flow engine, mapping received messages to known configured flows
 */
var amqp = require('amqplib/callback_api');
var config = require('./config');
var logger = require("@dojot/dojot-module-logger").logger;
var util = require("util");

class AMQPBase {
  constructor(target) {
    this.target = target || config.amqp.url;
    this.connection = null;
    this.channel = null;
    this.callbacks = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      logger.debug(`Connecting to AMQP endpoint: ${this.target}...`, {filename:"amqp"});
      amqp.connect(this.target, (error, connection) => {
        if (error) {
          logger.debug(`... error while connecting to AMQP: ${error}.`, {filename:"amqp"});
          return reject(error);
        }
        logger.debug(`... successfully connected to AMQP endpoint.`);
        this.connection = connection;
        logger.debug(`Invoking callbacks...`, {filename:"amqp"});
        for (let callback in this.callbacks.connection) {
          if (this.callbacks.connection.hasOwnProperty(callback)) {
            callback(this.connection);
          }
        }
        logger.debug(`... callbacks invoked.`, {filename:"amqp"});

        logger.debug(`Creating channel...`, {filename:"amqp"});
        this.connection.createChannel((error, channel) => {
          if (error) {
            logger.debug(`... error while creating channel: ${error}.`, {filename:"amqp"});
            return reject(error);
          }
          logger.debug(`... channel successfully created.`, {filename:"amqp"});
          logger.debug(`Advertising newly created channel...`, {filename:"amqp"});
          this.channel = channel;
          let list = this.callbacks.channel;
          for (let i = 0; i < list.length; i++) {
            list[i](channel);
          }
          logger.debug(`... new channel was successfully advertised.`, {filename:"amqp"});
          return resolve();
        });
        logger.debug(`... channel creation requested.`, {filename:"amqp"});
      });
      logger.debug(`... connection request created.`, {filename:"amqp"});
    });
  }

  on(event, callback) {
    logger.debug(`Registering new callback for event ${event}`, {filename:"amqp"});
    let registered = [];
    if (this.callbacks.hasOwnProperty(event)) {
      registered = this.callbacks[event];
    }

    registered.unshift(callback);
    this.callbacks[event] = registered;
    logger.debug(`... event ${event} was successfully registered.`, {filename:"amqp"});
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
      logger.debug(`Processing new channel...`, {filename:"amqp"});
      channel.assertQueue(this.queue, { durable: true, maxPriority: maxPriority});
      logger.debug('AMQP producer is ready. ', {filename:"amqp"});

      logger.debug(`Sending all queued messages...`, {filename:"amqp"});
      let event = this.backtrack.pop();
      while (event) {
        this.sendMessage(event.data, event.priority);
        event = this.backtrack.pop();
      }
      logger.debug(`... all queued messages were sent.`, {filename:"amqp"});
      logger.debug(`... new channel was successfully processed.`, {filename:"amqp"});
    });
  }

  sendMessage(data, priority = 0) {
    logger.debug(`Sending data: ${util.inspect(data)}, priority: ${priority}...`, {filename:"amqp"});
    if (this.channel) {
      let buffer = new Buffer(data);
      // console.log('Will send message [%s] %s', this.queue, data);
      this.channel.sendToQueue(this.queue, buffer, { persistent: true, priority: priority });
      logger.debug(`... data was successfully sent.`, {filename:"amqp"});
      return;
    } else {
      logger.debug(`... data not sent: channel not ready yet.`, {filename:"amqp"});
      this.backtrack.push({data, priority});
    }
  }
}

class AMQPConsumer extends AMQPBase {
  constructor(queue, onMessage, target, maxPriority) {
    logger.debug(`Creating AMQP consumer...`);
    logger.debug(`Target: ${target}, maximum priority: ${maxPriority}`);
    if (queue === undefined || onMessage === undefined) {
      logger.error(`Error while creating AMQP consumer: both queue and message callbacks must be defined.`);
      throw new Error("Both queue and message callbacks must be defined");
    }

    super(target);
    this.queue = queue;
    logger.debug(`Registering callback to new consumer...`);
    this.on('channel', (channel) => {
      logger.debug(`AMQP consumer is ready.`)
      logger.debug(`Processing new AMQP consumer channel...`);
      channel.assertQueue(this.queue, { durable: true, maxPriority: maxPriority });
      channel.consume(this.queue, (amqpCtx) => {
        onMessage(amqpCtx.content.toString(), () => {
          channel.ack(amqpCtx);
        });
      });
    });
    logger.debug(`... callback for new consumer was successfully registered.`);
  }
}

module.exports = {
  AMQPConsumer: AMQPConsumer,
  AMQPProducer: AMQPProducer
};
