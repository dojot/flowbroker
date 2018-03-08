"use strict";

// library stub
var zmq = require('zeromq');

module.exports = class DojotHandler {
  constructor(dataHandler) {
    this.handler = dataHandler
  }

  init() {
    this.handleResults.bind(this);

    this.sock = zmq.socket('rep');

    this.sock.on("message", (request) => {
      const data = JSON.parse(request.toString());

      // the following will still be updated
      // if (!data.hasOwnProperty('action')) {
      //   console.error("Received invalid data on 0mq socket, ignoring");
      //   return;
      // }
      // switch(data.action) {
      //   case 'locale':
      //     break;
      //   case 'meta':
      //     break
      //   case 'message':
      //
      //     handler.handleMessage()
      // }

      console.log('Got message. invoking handler ...', data);
      this.handler.handleMessage(undefined, data, this.handleResults);
    });

    this.sock.bind('tcp://*:5555', (err) => {
      if (err) {
        console.err(err);
        process.exit(1);
      } else {
        console.log('listening on 5555');
      }
    });

    process.on('SIGINT', () => {
      this.sock.close();
    });
  }

  handleResults(error, response) {
    if (error) {
      console.error("Message processing failed", error)
      this.sock.send(JSON.stringify({"error": true}));
    }
    console.log('Results: ', response)
    this.sock.send(JSON.stringify(response));
  }
}
