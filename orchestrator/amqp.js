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
    this.channelDisconnecting = false
    this.connectionDisconnecting = false
    this.maxTimeToRetryReconnection = config.amqp.maxTimeToRetryReconnection;
    this.actualTimeToRetryReconnection = config.amqp.initialTimeToRetryReconnection;
    this.initialTimeToRetryReconnection = config.amqp.initialTimeToRetryReconnection;
    this.currentNumberRetryReconnection = 0;
  }

  /**
   * Disconnect from rabbitMQ and close resources.
   * 
   * @returns 
   */
  disconnect() {
    if (this.connection && this.channel) {
      return Promise.all([Promise.resolve()]).then(() => {
        this.channelDisconnecting = true
        this.connectionDisconnecting = true
      }).then(() => {
        this.channel.close()
      }).then(() => {
        this.connection.close();
      }).catch((err) => logger.error(`[Producer Queue: ${this.queue}] Error when closing connection to RabbitMQ: ${err}`, { filename: 'amqp' }))
        .finally(() => {
          this.channelDisconnecting = false
          this.connectionDisconnecting = false
        })
    }
  }

  /**
  * Try reconnect to rabbitMQ
  */
  async reconnect() {
    return new Promise(async (resolve, reject) => {
      if (this.initialTimeToRetryReconnection) {
        if(this.initialTimeToRetryReconnection === 1) this.initialTimeToRetryReconnection = 2;

        const exponentialValue = Math.round(this.initialTimeToRetryReconnection ** this.currentNumberRetryReconnection);
        this.actualTimeToRetryReconnection = exponentialValue;

        if (
          exponentialValue >= this.maxTimeToRetryReconnection) {
          this.actualTimeToRetryReconnection = this.maxTimeToRetryReconnection;
        }

        await logger.info(`[Producer Queue: ${this.queue}] Reconnecting to RabbitMQ...`, { filename: 'amqp' });

        await this.disconnect();

        await logger.info(`[Producer Queue: ${this.queue}] Trying (${this.actualTimeToRetryReconnection}) seconds passed`, { filename: 'amqp' });

        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        await delay(this.actualTimeToRetryReconnection * 1000);

        await this.connect();
      } else {
        reject(`[Producer Queue: ${this.queue}] Producer is not connected`);
      }
    });
  }

  async connect() {
    if (this.channelDisconnecting == true || this.connectionDisconnecting == true) {
      logger.info(`[Producer Queue: ${this.queue}] Disconnecting from RabbitMQ...`, { filename: 'amqp' });
      return
    }
    return amqp.connect(this.url).then((connection) => {
      this.connection = connection;
      connection.once('error', async (err) => {
        logger.error(`[Producer Queue: ${this.queue}] Error on connectio with RabbitMQ: ${err}`, { filename: 'amqp' });
        this.connection = null;
        this.channel = null;
        this.currentNumberRetryReconnection++;

        await this.reconnect();
      });

      connection.once('close', async (err) => {
        logger.error(`[Producer Queue: ${this.queue}] Connection RabbitMQ was closed: ${err}`, { filename: 'amqp' });
        this.connection = null;
        this.channel = null;

        await this.connect();
      });
      return this.connection.createConfirmChannel().then((channel) => {
        this.channel = channel;
        channel.prefetch(1); // only 1 unacked msg
        channel.assertQueue(this.queue, { durable: true, maxPriority: this.maxPriority }).then(() => {
          logger.info(`Producer Queue: ${this.queue} ready ... `, { filename: 'amqp' });

          this.currentNumberRetryReconnection = 0;
          this.actualTimeToRetryReconnection = config.amqp.initialTimeToRetryReconnection;

          return Promise.resolve();
        }).catch((error) => {
          logger.error(`[Producer Queue: ${this.queue}] Failed to assert a channel. Error: ${error}`, { filename: 'amqp' });
          return Promise.reject(`[Producer Queue: ${this.queue}] Cannot connect to RabbitMQ`);
        });
      }).catch((error) => {
        logger.error(`[Producer Queue: ${this.queue}] Failed to create a channel. Error: ${error}`, { filename: 'amqp' });
        return Promise.reject(`[Producer Queue: ${this.queue}] Cannot connect to RabbitMQ`);
      });
    }).catch(async (error) => {
      logger.error(`[Producer Queue: ${this.queue}] Failed to create a connection. Error: ${error}`, { filename: 'amqp' });
      this.connection = null;
      this.channel = null;
      this.currentNumberRetryReconnection++;
      await this.reconnect();
      return Promise.reject(`[Producer Queue: ${this.queue}] Cannot connect to RabbitMQ`);
    });
  }

  async sendMessage(data, priority = 0) {
    if (this.channel) {
      let buffer = new Buffer(data);
      return new Promise((resolve, reject) => {
        if (!this.connection) reject(`[Producer Queue: ${this.queue}] Producer is not connected`);
        this.channel.sendToQueue(this.queue, buffer, { persistent: true, priority: priority }, (error, ok) => {
          if (error !== null) {
            return reject();
          }
          return resolve();
        });
      });
    } else {
      logger.error(`[Producer Queue: ${this.queue}] Channel was not ready yet`, { filename: 'amqp' });
      return Promise.reject(`[Producer Queue: ${this.queue}] Producer is not connected`);
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
    this.maxTimeToRetryReconnection = config.amqp.maxTimeToRetryReconnection;
    this.actualTimeToRetryReconnection = config.amqp.initialTimeToRetryReconnection;
    this.initialTimeToRetryReconnection = config.amqp.initialTimeToRetryReconnection;
    this.currentNumberRetryReconnection = 0;
  }

  /**
   * Disconnect from rabbitMQ and close resources.
   * 
   * @returns 
   */
  disconnect() {
    if (this.connection && this.channel) {
      return Promise.resolve().then(() => {
        this.channelDisconnecting = true;
        this.connectionDisconnecting = true;
      }).then(() => {
        this.channel.close();
      }).then(() => {
        this.connection.close();
      }).catch((err) => logger.error(`[Consumer: Queue: ${this.queue}] Error when closing connection to RabbitMQ: ${err}`, { filename: 'amqp' }))
        .finally(() => {
          this.channelDisconnecting = false;
          this.connectionDisconnecting = false;
        });
    }
  }

  /**
  * Try reconnect to rabbitMQ
  */
  async reconnect() {
    return new Promise(async (resolve, reject) => {
      if (this.initialTimeToRetryReconnection) {
        if(this.initialTimeToRetryReconnection === 1) this.initialTimeToRetryReconnection = 2;

        const exponentialValue = Math.round(this.initialTimeToRetryReconnection ** this.currentNumberRetryReconnection);
        this.actualTimeToRetryReconnection = exponentialValue;

        if (
          exponentialValue >= this.maxTimeToRetryReconnection) {
          this.actualTimeToRetryReconnection = this.maxTimeToRetryReconnection;
        }

        await logger.info(`[Consumer: Queue: ${this.queue}] Reconnecting to RabbitMQ...`, { filename: 'amqp' });

        await this.disconnect();

        await logger.info(`[Consumer: Queue: ${this.queue}] Trying (${this.actualTimeToRetryReconnection}) seconds passed`, { filename: 'amqp' });

        const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
        await delay(this.actualTimeToRetryReconnection * 1000);

        await this.connect();
      } else {
        reject(`[Consumer: Queue: ${this.queue}] Consumer is not connected`);
      }
    });
  }

  async connect() {
    return amqp.connect(this.url).then((connection) => {
      this.connection = connection;
      connection.once('error', async (err) => {
        logger.error(`[Consumer Queue: ${this.queue}] Error on connectio with RabbitMQ: ${err}`, { filename: 'amqp' });
        this.connection = null;
        this.channel = null;
        this.currentNumberRetryReconnection++;

        await this.reconnect();
      });

      connection.once('close', async (err) => {
        logger.error(`[Consumer Queue: ${this.queue}] Connection RabbitMQ was closed: ${err}`, { filename: 'amqp' });
        this.connection = null;
        this.channel = null;

        await this.connect();
      });

      return this.connection.createChannel().then((channel) => {
        this.channel = channel;
        channel.prefetch(1); // only 1 unacked msg
        channel.assertQueue(this.queue, { durable: true, maxPriority: this.maxPriority }).then(() => {
          channel.consume(this.queue, (amqpCtx) => {
            this.onMessage(amqpCtx.content.toString(), () => {
              channel.ack(amqpCtx);
            });
          }).then((consumerTag) => {
            logger.info(`[Consumer Queue: ${this.queue}] ${util.inspect(consumerTag, { depth: null })} ready ... `, { filename: 'amqp' });

            this.currentNumberRetryReconnection = 0;
            this.actualTimeToRetryReconnection = config.amqp.initialTimeToRetryReconnection;

            return Promise.resolve();
          }).catch((error) => {
            logger.error(`[Consumer Queue: ${this.queue}] Failed to consume a channel. Error: ${error}`, { filename: 'amqp' });
            return Promise.reject(`[Consumer Queue: ${this.queue}] Cannot connect to RabbitMQ`);
          });
        }).catch((error) => {
          logger.error(`[Consumer Queue: ${this.queue}] Failed to assert a channel. Error: ${error}`, { filename: 'amqp' });
          return Promise.reject(`[Consumer Queue: ${this.queue}] Cannot connect to RabbitMQ`);
        });
      }).catch((error) => {
        logger.error(`[Consumer Queue: ${this.queue}] Failed to create a channel. Error: ${error}`, { filename: 'amqp' });
        return Promise.reject(`[Consumer Queue: ${this.queue}] Cannot connect to RabbitMQ`);
      });
    }).catch(async (error) => {
      logger.error(`[Consumer Queue: ${this.queue}] Failed to create a connection. Error: ${error}`, { filename: 'amqp' });
      this.connection = null;
      this.channel = null;
      this.currentNumberRetryReconnection++;
      await this.reconnect();
      return Promise.reject(`[Consumer Queue: ${this.queue}] Cannot connect to RabbitMQ`);
    });
  }
}

module.exports = {
  AMQPConsumer: AMQPConsumer,
  AMQPProducer: AMQPProducer
};
