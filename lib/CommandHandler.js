"use strict";

var zmq = require('zeromq');
var fs = require('fs');
var ContextManagerClient = require('./ContextManagerClient.js');
var ContextHandler = require('./ContextHandler.js');

function checkField(target, field, message) {
  if (!target.hasOwnProperty(field)) {
    throw new Error(message);
  }
}

class DojotHandler {
  constructor(dataHandler,
      contextResponseTimeout,
      contextManagerHost,
      contextManagerPort
    ) {

    let ctxResponseTimeout = contextResponseTimeout || 10000;
    let ctxManagerHost = contextManagerHost || "flowbroker-context-manager";
    let ctxManagerPort = contextManagerPort || 5556;

    this.handler = dataHandler;
    this.handleResults = this.handleResults.bind(this);
    this.contextManager = new ContextManagerClient(ctxManagerHost,
                                                   ctxManagerPort,
                                                   ctxResponseTimeout);
    this.contextHandler = null;
    this.isInitialized = false;
    this.commandSocket = null;
  }

  init() {
    if (this.isInitialized) {
      console.log('CommandHandler is already initialized');
      return;
    }

    this.commandSocket = zmq.socket('rep');

    this.commandSocket.on("message", (request) => {
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

    this.commandSocket.bind('tcp://*:5555', (err) => {
      if (err) {
        console.err(err);
        process.exit(1);
      } else {
        console.log('listening on 5555');
      }
    });

    this.contextManager.init();

    this.contextHandler = new ContextHandler(this.contextManager);

    process.on('SIGINT', () => {
      this.commandSocket.close();
    });

    this.isInitialized = true;
  }

  handleResults(error, response) {
    if (error) {
      console.error("Message processing failed", error);
      return this.commandSocket.send(JSON.stringify({"error": error.message}));
    }

    const output = JSON.stringify(response);
    console.log('Results: ', output);
    return this.commandSocket.send(output);
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
    this.handler.handleMessage(data.config, data.message, this.handleResults, this.contextHandler);
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
    let source = field.match(/([^.]+)/g);
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
    let source = field.match(/([^.]+)/g);
    let at = source.shift();
    let data = target;
    while (at) {
      if (!data.hasOwnProperty(at)) {
        throw new Error(`Unknown property ${field} requested`);
      }

      data = data[at];
      at = source.shift();
    }

    return data;
  }
}

module.exports = { DojotHandler: DojotHandler, DataHandlerBase: DataHandlerBase };