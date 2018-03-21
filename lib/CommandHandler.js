"use strict";

// library stub
var zmq = require('zeromq');

class DojotHandler {
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

class DataHandlerBase {

  /**
   *
   * @param {string} field Path to field to be set
   * @param {string} value Value to set field to
   * @param {object} target Object to be modified
   */
  _set(field, value, target) {
    let source = field.match(/([^\.]+)/g)
    let key = source.shift();
    let at = target;
    while (key) {
      if (source.length) {
        if (!at.hasOwnProperty(key)) {
          at[key] = {};
        }
        at = at[key];
      } else {
        at[key] = value;
      }
      key = source.shift();
    }
  }

  /**
   *
   * @param {string} field Path to field to be set
   * @param {object} target Object to read from
   */
  _get(field, target) {
    let source = field.match(/([^\.]+)/g)
    let at = source.shift();
    let data = target;
    while (at) {
      if (!data.hasOwnProperty(at)) {
        throw new Error("Unknown property requested");
      }

      data = data[at];
      at = source.shift();
    }

    return data;
  }
}

module.exports = { DojotHandler: DojotHandler, DataHandlerBase: DataHandlerBase }