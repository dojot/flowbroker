'use strict';

/**
 * Implements interface with 3rd party provided nodes
 */


var zmq = require('zeromq');

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
     console.log('[dispatcher] got reply', reply.toString());
     console.log('[dispatcher] remote [%s] took %dms', node, new Date() - ts);
     sock.close();

     let data;
     try {
       data = JSON.parse(reply.toString());
     } catch (error) {
       return reject(error);
     }

     resolve(data);
   });

   // TODO proper validation of node.type as an address (or host name for that sake)
  //  console.log('[dispatcher] will connect');
   sock.connect("tcp://" + node + ":5555");
  //  console.log('[dispatcher] will send');
   sock.send(JSON.stringify(msg));
 })
}
