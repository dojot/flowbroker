"use strict";

/**
 * Feeds messages to the flow engine, mapping received messages to known configured flows
 */
var amqp = require('amqplib/callback_api');
var config = require('./config');
const logger = require("@dojot/dojot-module-logger").logger;

class AMQPBase {
  constructor(target) {
    this.target = target || config.amqp.url;
    this.connection = null;
    this.channel = null;
    this.callbacks = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      amqp.connect(this.target, (error, connection) => {
        if (error) {
          return reject(error);
        }

        this.connection = connection;
        for (let callback in this.callbacks.connection) {
          if (this.callbacks.connection.hasOwnProperty(callback)) {
            callback(this.connection);
          }
        }

        this.connection.createChannel((error, channel) => {
          if (error) {
            return reject(error);
          }

          channel.prefetch(1); // only 1 unacked msg
          this.channel = channel;
          let list = this.callbacks.channel;
          for (let i = 0; i < list.length; i++) {
            list[i](channel);
          }

          return resolve();
        });
      });
    });
  }

  on(event, callback) {
    let registered = [];
    if (this.callbacks.hasOwnProperty(event)) {
      registered = this.callbacks[event];
    }

    registered.unshift(callback);
    this.callbacks[event] = registered;
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
      channel.assertQueue(this.queue, { durable: true, maxPriority: maxPriority});
      logger.info('producer ready ... ', { filename: 'amqp' });

      let event = this.backtrack.pop();
      while (event) {
        this.sendMessage(event.data, event.priority);
        event = this.backtrack.pop();
      }
    });
  }

  sendMessage(data, priority = 0) {
    if (this.channel) {
      let buffer = new Buffer(data);
      this.channel.sendToQueue(this.queue, buffer, { persistent: true, priority: priority });
      return;
    } else {
      logger.debug('channel was not ready yet', { filename: 'amqp' });
      this.backtrack.push({data, priority});
    }
  }
}

class AMQPConsumer extends AMQPBase {
  constructor(queue, onMessage, target, maxPriority) {
    if (queue === undefined || onMessage === undefined) {
      throw new Error("Both queue and message callbacks must be defined");
    }

    super(target);
    this.queue = queue;
    this.on('channel', (channel) => {
      logger.info('consumer ready ... ', { filename: 'amqp' });
      channel.assertQueue(this.queue, { durable: true, maxPriority: maxPriority });
      channel.consume(this.queue, (amqpCtx) => {
        onMessage(amqpCtx.content.toString(), () => {
          channel.ack(amqpCtx);
        });
      });
    });
  }
}

module.exports = {
  AMQPConsumer: AMQPConsumer,
  AMQPProducer: AMQPProducer
};
