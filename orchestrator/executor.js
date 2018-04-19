"use strict";

var util = require('util');
var amqp = require('./amqp');
var config = require('./config');
var nodes = require('./nodeManager').Manager;
// var nodes = new nodeManager.Manager();

module.exports = class Executor {
  constructor() {
    console.log('[executor] initializing ...');
    this.hop = this.hop.bind(this);
    this.producer = new amqp.AMQPProducer(config.amqp.queue);
    this.consumer = new amqp.AMQPConsumer(config.amqp.queue, this.hop);
  }

  init() {
    return new Promise((resolve, reject) => {
      this.producer.connect().then(() => {
        this.consumer.connect();
        resolve();
      }).catch((error) => {
        reject(error);
      })
    });
  }

  hop(data, ack) {
    let event;
    try {
      event = JSON.parse(data);
    } catch (error) {
      console.error("[amqp] Received event is not valid JSON. Ignoring");
      return ack();
    }

    const at = event.flow.nodeMap[event.hop];
    // sanity check on received hop
    if (!at.hasOwnProperty('type')) {
      console.error(`[executor] Node execution failed. ${error}. Aborting flow ${event.flow.id}.`);
      // TODO notify alarmManager
      return ack();
    }

    console.log(`[executor] will handle node ${at.type}`);
    let handler = nodes.getNode(at.type);
    if (handler) {
      handler.handleMessage(at, event.message, (error, result) => {
        if (error) {
          console.error(`[executor] Node execution failed. ${error}. Aborting flow ${event.flow.id}.`);
          // TODO notify alarmManager
          return ack();
        }

        console.log(`[executor] hop (${at.type}) result: ${JSON.stringify(result)}`);
        for (let output = 0; output < at.wires.length; output++) {
          let newEvent = result[output];
          if (newEvent) {
            for (let hop of at.wires[output]) {
              this.producer.sendMessage(JSON.stringify({
                hop: hop,
                message: newEvent,
                flow: event.flow,
                metadata: event.metadata
              }));
            }
          }
        }
        return ack();
      }, event.metadata.tenant);
    } else {
      console.error(`[executor] Unknown node ${at.type} detected. Igoring.`)
      return ack();
    }
  }
}