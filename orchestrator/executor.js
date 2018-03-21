"use strict";

var amqp = require('./amqp');
var config = require('./config');

// TODO - remove the following
var change = require('./nodes/change/index').Handler;
var edge = require('./nodes/edge/index').Handler;
var email = require('./nodes/email/index').Handler;
var geo = require('./nodes/geo/index').Handler;
var http = require('./nodes/http/index').Handler;
var select = require('./nodes/switch/index').Handler;
var template = require('./nodes/template/index').Handler;
//
var nodes = {
  "change": new change(),
  "edgedetection": new edge(),
  "email": new email(),
  "geofence": new geo(),
  "http_request_out": new http(),
  "switch": new select(),
  "template": new template(),
  "device out": {
    handleMessage: function (config, message, callback, tenant) {
      let output = { attrs: message, metadata: {} };
      output.metadata.deviceid = config._device_id;
      output.metadata.templates = config._device_templates;
      output.metadata.timestamp = Date.now();
      output.metadata.tenant = tenant
      console.log('will publish (device out)', util.inspect(output, { depth: null }));
      publisher.publish(output);
      callback();
    }
  }
};

module.exports = class Executor {
  constructor() {
    this.hop = this.hop.bind(this);
    this.producer = new amqp.AMQPProducer(config.amqp.queue);
    this.consumer = new amqp.AMQPConsumer(config.amqp.queue, this.hop);
  }

  hop(data, ack) {
    try {
      let event = JSON.parse(data);
    } catch (error) {
      console.error("[amqp] Received event is not valid JSON. Ignoring");
      return ack();
    }

    const at = event.flow.nodeMap[event.hop];
    console.log(`[executor] will handle node ${at.type}`);
    if (nodes.hasOwnProperty(at.type)) {
      nodes[at.type].handleMessage(at, ctx.message, (error, result) => {
        console.log(`[executor] got ${error}:${JSON.stringify(result)} from ${at.type}`);
        for (let output = 0; output < at.wires.length; output++) {
          for (let newEvent of result[output]) {
            for (let hop of at.wires[output]) {
              this.producer.sendMessage(JSON.stringify({
                hop: hop,
                message: newEvent,
                flow: event.flow
              }))
            }
          }
        }
      }, event.metadata.tenant);
    } else {
      console.error(`[executor] Unknown node ${at.type} detected. Igoring.`)
      return ack();
    }
  }
}