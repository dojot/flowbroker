"use strict";

var zmq = require('zeromq');
var fs = require('fs');

function checkField(target, field, message) {
  if (!target.hasOwnProperty(field)) {
    throw new Error(message);
  }
}

class DojotHandler {
  constructor(dataHandler) {
    this.handler = dataHandler;
    this.handleResults = this.handleResults.bind(this);
  }

  init() {
    this.handleResults.bind(this);

    this.sock = zmq.socket('rep');

    this.sock.on("message", (request) => {
      let data;
      try {
        data = JSON.parse(request.toString());
      } catch (error) {
        return this.handleResults(new Error("Payload must be valid json"));
      }

      try {
        checkField(data, 'command', "Request is missing command field");
        console.log('Got message. invoking handler ...', data);
        switch (data.command) {
          case 'locale':
            this.handleLocale(data);
            break;
          case 'metadata':
            this.handleMetadata(data);
            break;
          case 'message':
            this.handleMessage(data);
            break;
          case 'html':
            this.handleHtml(data);
            break;
          default:
            this.handleResults(new Error("Unknown command requested"));
        }
      } catch (error) {
        return this.handleResults(error);
      }
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
      console.error("Message processing failed", error);
      return this.sock.send(JSON.stringify({"error": error.message}));
    }

    const output = JSON.stringify(response);
    console.log('Results: ', output);
    return this.sock.send(output);
  }

  handleHtml() {
    const path = this.handler.getNodeRepresentationPath();
    const html = fs.readFileSync(path);
    this.handleResults(undefined, { payload: html.toString('utf8') });
  }

  handleMetadata() {
    this.handleResults(undefined, { payload: this.handler.getMetadata() });
  }

  handleLocale(data) {
    checkField(data, 'locale', "Missing locale to be returned");
    this.handleResults(undefined, { payload: this.handler.getLocaleData(data.locale)});
  }

  handleMessage(data) {
    checkField(data, 'config', "Missing node config to be used");
    checkField(data, 'message', "Missing message to be processed");
    this.handler.handleMessage(data.config, data.message, this.handleResults);
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
    let source = field.match(/([^\.]+)/g);
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
    let source = field.match(/([^\.]+)/g);
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

module.exports = { DojotHandler: DojotHandler, DataHandlerBase: DataHandlerBase };