"use strict";

var amqp = require('./amqp');
var config = require('./config');
var util = require('util');

// TODO - remove the following
var change = require('./nodes/change/index').Handler;
var edge = require('./nodes/edge/index').Handler;
var email = require('./nodes/email/index').Handler;
var geo = require('./nodes/geo/index').Handler;
var http = require('./nodes/http/index').Handler;
var select = require('./nodes/switch/index').Handler;
var template = require('./nodes/template/index').Handler;
var device_out = require('./nodes/device-out/device-out').Handler;
var publisher = require('./publisher');
//
var nodes = {
  "change": new change(),
  "edgedetection": new edge(),
  "email": new email(),
  "geofence": new geo(),
  "http_request_out": new http(),
  "switch": new select(),
  "template": new template(),
  "device out": new device_out(publisher)
};

module.exports = class Executor {
  constructor() {
    console.log('[executor] initializing ...');
    this.hop = this.hop.bind(this);
    this.producer = new amqp.AMQPProducer(config.amqp.queue);
    this.consumer = new amqp.AMQPConsumer(config.amqp.queue, this.hop);
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
    console.log(`[executor] will handle node ${at.type}`);
    if (nodes.hasOwnProperty(at.type)) {
      nodes[at.type].handleMessage(at, event.message, (error, result) => {
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