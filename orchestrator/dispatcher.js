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
