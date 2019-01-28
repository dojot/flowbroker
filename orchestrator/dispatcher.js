'use strict';

var zmq = require('zeromq');
var uuidv4 = require('uuid/v4');

/**
 * Implements interface with 3rd party provided nodes
 */
module.exports = class Dispatcher {

  constructor(address, port, requestTimeout = undefined) {
    this.address = address;
    this.port = port;
    this.requestTimeout = requestTimeout;
    this.sock = null;
    this.requestMap = {};
  }

  init() {
    this.sock = zmq.socket('dealer');

    this.sock.on("message", (responsePacket) => {
      console.log("Received reply [%s]", responsePacket.toString());
      let response = JSON.parse(responsePacket);

      if (!this.requestMap.hasOwnProperty(response.requestId)) {
        console.log('request %s was expired', response.requestId);
        return;
      }

      let requestEntry = this.requestMap[response.requestId];
      delete this.requestMap[response.requestId];
      clearTimeout(requestEntry.timer);

      requestEntry.resolve(response.payload);
    });

    this.sock.connect('tcp://' + this.address + ':' + this.port);
    console.log('Dispatcher connected to %s on port %d', this.address, this.port);
  }

  deinit() {
    if (this.sock) {
      this.sock.close();
    }
  }

  sendRequest(payload) {
    return new Promise((resolve, reject) => {
      let request = {
        requestId: uuidv4().toString(),
        payload
      };

      let timer;
      if (this.requestTimeout) {
        timer = setTimeout((id, map) => {
          console.log("time out %s", id);
          let entry = map[id];
          delete map[id];
          entry.reject('timeout');
        }, this.requestTimeout, request.requestId, this.requestMap);
      }

      this.requestMap[request.requestId] = {
        resolve,
        reject,
        timer
      }
      this.sock.send(JSON.stringify(request));
    });
  }
}
