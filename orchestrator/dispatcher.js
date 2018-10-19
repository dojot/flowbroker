'use strict';

/**
 * Implements interface with 3rd party provided nodes
 */


var zmq = require('zeromq');
var logger = require("@dojot/dojot-module-logger").logger;
var util = require("util");

const TAG={filename:"zeromq-disp"};

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
    logger.debug(`Creating new zeromq socket...`, TAG);
    let sock = zmq.socket("req");
    logger.debug(`... zeromq socket created.`, TAG);

    logger.debug("Registering callback for processing response message...", TAG);
    sock.on("message", function(reply) {
      logger.debug(`Got reply from zeromq socket: ${reply.toString()}.`, TAG);
      logger.info(`Remote node ${node} took ${new Date() - ts}ms`, TAG);
      sock.close();

      let data;
      try {
        data = JSON.parse(reply.toString());
      } catch (error) {
        logger.error(`Error while receiving data from zeromq: ${error}`, TAG);
        return reject(error);
      }

      logger.debug(`Message successfully received from zeromq socket.`, TAG);
      resolve(data);
    });
    logger.debug("... response message callback registered.", TAG);

    // TODO proper validation of node.type as an address (or host name for that sake)
    //  console.log('[dispatcher] will connect');
    logger.debug(`Connecting to zeromq endpoint: tcp://${node}:5555`, TAG);
    sock.connect("tcp://" + node + ":5555");
    logger.debug(`... connected to zeromq endpoint.`, TAG);
    //  console.log('[dispatcher] will send');
    logger.debug(`Sending message: ${util.inspect(msg)}...`, TAG);
    sock.send(JSON.stringify(msg));
    logger.debug(`... message successfully sent.`, TAG);
  });
};
