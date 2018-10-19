'use strict';

/**
 * Implements interface with 3rd party provided nodes
 */


var zmq = require('zeromq');
var logger = require("@dojot/dojot-module-logger").logger;
var util = require("util");

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
   logger.debug(`Creating new zeromq socket...`, {filename:"zeromq-disp"});
   let sock = zmq.socket('req');
   logger.debug(`... zeromq socket created.`, {filename:"zeromq-disp"});
   sock.on("message", function(reply) {
     logger.debug(`Got reply from zeromq socket: ${reply.toString()}.`, {filename:"zeromq-disp"});
    //  console.log('[dispatcher] got reply', reply.toString());
     logger.debug(`Remote node ${node} took ${new Date() - ts}ms`, {filename:"zeromq-disp"});
     sock.close();

     let data;
     try {
       data = JSON.parse(reply.toString());
     } catch (error) {
       logger.error(`Error while receiving data from zeromq: ${error}`, {filename:"zeromq-disp"});
       return reject(error);
     }

     logger.error(`Message successfully received from zeromq socket.`, {filename:"zeromq-disp"});
     resolve(data);
   });

   // TODO proper validation of node.type as an address (or host name for that sake)
  //  console.log('[dispatcher] will connect');
  logger.debug(`Connecting to zeromq endpoint: tcp://${node}:5555`, {filename:"zeromq-disp"});
  sock.connect("tcp://" + node + ":5555");
  logger.debug(`... connected to zeromq endpoint.`, {filename:"zeromq-disp"});
  //  console.log('[dispatcher] will send');
  logger.debug(`Sending message: ${util.inspect(msg)}...`, {filename:"zeromq-disp"});
  sock.send(JSON.stringify(msg));
  logger.debug(`... message successfully sent.`, {filename:"zeromq-disp"});
 });
};
