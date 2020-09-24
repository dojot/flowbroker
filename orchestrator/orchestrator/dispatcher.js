'use strict';

var zmq = require('zeromq');
var uuidv4 = require('uuid/v4');
const logger = require("@dojot/dojot-module-logger").logger;

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
      logger.debug(`Received reply: ${responsePacket.toString()}`, { filename: 'dispatcher' });
      let response = JSON.parse(responsePacket);

      if (!this.requestMap.hasOwnProperty(response.requestId)) {
        logger.warn(`request ${response.requestId} was expired`, { filename: 'dispatcher' });
        return;
      }

      let requestEntry = this.requestMap[response.requestId];
      delete this.requestMap[response.requestId];
      clearTimeout(requestEntry.timer);

      requestEntry.resolve(response.payload);
    });

    this.sock.connect('tcp://' + this.address + ':' + this.port);
    logger.info(`Dispatcher connected to ${this.address} on port ${this.port}`, { filename: 'dispatcher' });
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
          logger.warn(`time out ${id}`, { filename: 'dispatcher' });
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
