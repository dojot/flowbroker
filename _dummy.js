"use strict";

var zmq = require('zeromq');
var sock = zmq.socket('rep');
var os = require('os');

sock.on("message", function(request) {
  // console.log('got request', request.toString());
  setTimeout(() => {
    let response = JSON.parse(request.toString());
    response[os.hostname()] = true;
    sock.send(JSON.stringify([response]));
  }, 10);
});

sock.bind('tcp://*:5555', (err) => {
  if (err) {
    console.err(err);
  } else {
    console.log('listening on 5555');
  }
});

process.on('SIGINT', () => {
  sock.close();
});
