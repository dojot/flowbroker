'use strict';

/**
 * Implements interface with 3rd party provided nodes
 */


var zmq = require('zeromq');

class InputError extends Error {
  constructor(remote) {
    super("Got invalid message from remote");
    this.remote = remote;
  }
}

module.exports = class DojotServer {
  constructor(){
    this.socketPool = {};
    this._callbacks = {};

    this.handleMessage.bind(this);
  }

  _getConnection(target) {
    if (this.socketPool.hasOwnProperty(target)) {
      return this.socketPool[target];
    }

    let socket = zmq.socket('req');
    socket.connect(target);
    socket.on("message", (reply) => {
      this.handleMessage(target, reply);
    })
  }

  _on(callid, callback) {
    this._callbacks[callid] = callback;
  }

  handleMessage(target, reply) {
    // TODO how to resolve a promise returned from somewhere else here?
    // call ids?

    // received messages should be json
    let payload;
    try {
      payload = JSON.parse(reply.toString());
    } catch (e) {
      throw new InputError();
      return;
    }

    if (this._callbacks.hasOwnProperty(reply.id)){

    }
  }

  getUI(node) {}

  getMeta(node) {}

  getLocale(node, locale) {}

  validate(node) {}

  _invoke()
};

/**
 * Execute individual processing node, with given configuration
 * @param  {[type]}     node node configuration to be used within invocation
 * @param  {[type]}     msg  message that triggered the invocation
 * @return {[Promise]}
 */
module.exports = function invokeRemote(node, msg) {
 let ts = new Date();
 // TODO improve communication model (REQ/REP, connection reuse, ...)
 return new Promise((resolve, reject) => {
   // TODO we could be using a proper zmq async req-rep pattern
   let sock = zmq.socket('req');
   sock.on("message", function(reply) {
     // console.log('got reply', reply.toString());
     sock.close();
     // console.log('remote took %dms', new Date() - ts);
     resolve(JSON.parse(reply.toString()));
   });

   // TODO proper validation of node.type as an address (or host name for that sake)
   sock.connect("tcp://" + node.type + ":5555");
   sock.send(JSON.stringify(msg));
 })
}
