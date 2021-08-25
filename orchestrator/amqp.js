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
    this.timeToReconnection = config.amqp.timeToReconnect;
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
      }).catch((err) => logger.error(`Error when closing connection to RabbitMQ: ${err}`, { filename: 'amqp' }))
        .finally(() => {
          this.channelDisconnecting = false
          this.connectionDisconnecting = false
        })
    }
  }

  /**
  * Try reconnect to rabbitMQ
  */
  reconnect() {
    logger.info(`[Producer] Reconnecting to RabbitMQ...`, { filename: 'amqp' });
    //Add 5s after each iteration to max 120s
    if (this.timeToReconnection + 5000 > 120000) {
      this.timeToReconnection = 120000;
    } else {
      this.timeToReconnection += 5000;
    }


    setTimeout(() => {
      logger.info(`[Producer] Trying to reconnect to RabbitMQ after ${this.timeToReconnection / 1000} seconds passed`, { filename: 'amqp' })
      this.disconnect();
      this.connect();
    }, this.timeToReconnection)

  }

  async connect() {
    if (this.channelDisconnecting == true || this.connectionDisconnecting == true) {
      logger.info("[Producer] Disconnecting from RabbitMQ...", { filename: 'amqp' });
      return
    }
    return amqp.connect(this.url+'?heartbeat=10').then((connection) => {
      this.connection = connection;
      connection.on('error', (err) => {
        logger.error(`[Producer] Error on connectio with RabbitMQ: ${err}`, { filename: 'amqp' });
        this.reconnect();
      });

      connection.on('close', (err) => {
        logger.error(`[Producer] Connection RabbitMQ was closed: ${err}`, { filename: 'amqp' });
        this.connection=null;
        this.channel=null;
        this.reconnect();
      });
      return this.connection.createConfirmChannel().then((channel) => {
        //Reset counting
        this.timeToReconnection = 10000;
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
      this.reconnect();
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
    this.timeToReconnection = config.amqp.timeToReconnect;
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
      }).catch((err) => logger.error(`[Consumer] Error when closing connection to RabbitMQ: ${err}`, { filename: 'amqp' }))
        .finally(() => {
          this.channelDisconnecting = false
          this.connectionDisconnecting = false
        })
    }
  }

  /**
  * Try reconnect to rabbitMQ
  */
  reconnect() {
    logger.info(`[Consumer] Reconnecting to RabbitMQ...`, { filename: 'amqp' });
    //Add 5s after each iteration to max 120s
    if (this.timeToReconnection + 5000 > 120000) {
      this.timeToReconnection = 120000;
    } else {
      this.timeToReconnection += 5000;
    }


    setTimeout(() => {
      logger.info(`[Consumer] Trying to reconnect to RabbitMQ after ${this.timeToReconnection / 1000} seconds passed`, { filename: 'amqp' })
      this.disconnect();
      this.connect();
    }, this.timeToReconnection)

  }

  async connect() {
    return amqp.connect(this.url+'?heartbeat=10').then((connection) => {
      this.connection = connection;
      connection.on('error', (err) => {
        logger.error(`[Consumer] Error on connectio with RabbitMQ: ${err}`, { filename: 'amqp' });
        this.reconnect();
      });

      connection.on('close', (err) => {
        logger.error(`[Consumer] RabbitMQ was closed: ${err}`, { filename: 'amqp' });
        this.connection=null;
        this.channel=null;
        this.reconnect();
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
      this.reconnect();
      return Promise.reject('Cannot connect to RabbitMQ');
    });
  }
}

module.exports = {
  AMQPConsumer: AMQPConsumer,
  AMQPProducer: AMQPProducer
};
