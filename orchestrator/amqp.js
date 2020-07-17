"use strict";

/**
 * Feeds messages to the flow engine, mapping received messages to known configured flows
 */
var amqp = require('amqplib');
var config = require('./config');
const util = require('util');
const logger = require("@dojot/dojot-module-logger").logger;

class AMQPProducer {
  constructor(queue, url, maxPriority) {
    this.url = url || config.amqp.url;
    this.connection = null;
    this.channel = null;
    this.queue = queue;
    this.maxPriority = maxPriority;
  }

  async connect() {
    return amqp.connect(this.url).then((connection) => {
      this.connection = connection;
      return this.connection.createConfirmChannel().then((channel) => {
        this.channel = channel;
        channel.prefetch(1); // only 1 unacked msg
        channel.assertQueue(this.queue, { durable: true, maxPriority: this.maxPriority }).then(() => {
          logger.info(`Producer ready ... `, { filename: 'amqp' });
          return Promise.resolve();
        }).catch((error) => {
          logger.error(`Failed to assert a channel. Error: ${error}`, { filename: 'amqp' });
          return Promise.reject('Cannot connect to RabbitMQ');
        });
      }).catch((error) => {
        logger.error(`Failed to create a channel. Error: ${error}`, { filename: 'amqp' });
        return Promise.reject('Cannot connect to RabbitMQ');
      });
    }).catch((error) => {
      logger.error(`Failed to create a connection. Error: ${error}`, { filename: 'amqp' });
      return Promise.reject('Cannot connect to RabbitMQ');
    });
  }

  async sendMessage(data, priority = 0) {
    if (this.channel) {
      let buffer = new Buffer(data);
      return new Promise((resolve, reject) => {
        this.channel.sendToQueue(this.queue, buffer, { persistent: true, priority: priority }, (error, ok) => {
          if (error !== null) {
            return reject();
          }
          return resolve();
        });
      });
    } else {
      logger.error('channel was not ready yet', { filename: 'amqp' });
      return Promise.reject('Producer is not connected');
    }
  }
}

class AMQPConsumer {
  constructor(queue, onMessage, url, maxPriority) {
    this.url = url || config.amqp.url;
    this.connection = null;
    this.channel = null;
    this.queue = queue;
    this.onMessage = onMessage;
    this.maxPriority = maxPriority;
  }

  async connect() {
    return amqp.connect(this.url).then((connection) => {
      this.connection = connection;

      return this.connection.createChannel().then((channel) => {
        this.channel = channel;
        channel.prefetch(1); // only 1 unacked msg
        channel.assertQueue(this.queue, { durable: true, maxPriority: this.maxPriority }).then(() => {
          channel.consume(this.queue, (amqpCtx) => {
            this.onMessage(amqpCtx.content.toString(), () => {
              channel.ack(amqpCtx);
            });
          }).then((consumerTag) => {
            logger.info(`consumer ${util.inspect(consumerTag, { depth: null })} ready ... `, { filename: 'amqp' });
            return Promise.resolve();
          }).catch((error) => {
            logger.error(`Failed to consume a channel. Error: ${error}`, { filename: 'amqp' });
            return Promise.reject('Cannot connect to RabbitMQ');
          });
        }).catch((error) => {
          logger.error(`Failed to assert a channel. Error: ${error}`, { filename: 'amqp' });
          return Promise.reject('Cannot connect to RabbitMQ');
        });
      }).catch((error) => {
        logger.error(`Failed to create a channel. Error: ${error}`, { filename: 'amqp' });
        return Promise.reject('Cannot connect to RabbitMQ');
      });
    }).catch((error) => {
      logger.error(`Failed to create a connection. Error: ${error}`, { filename: 'amqp' });
      return Promise.reject('Cannot connect to RabbitMQ');
    });
  }
}

module.exports = {
  AMQPConsumer: AMQPConsumer,
  AMQPProducer: AMQPProducer
};
