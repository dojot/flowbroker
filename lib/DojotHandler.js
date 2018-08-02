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

module.exports = class DojotHandler {
  constructor(dataHandler,
      contextResponseTimeout,
      contextManagerHost,
      contextManagerPort
    ) {

    let ctxResponseTimeout = contextResponseTimeout || 10000;
    let ctxManagerHost = contextManagerHost || "flowbroker-context-manager";
    let ctxManagerPort = contextManagerPort || 5556;

    this.handler = dataHandler;
    this._handleResults = this._handleResults.bind(this);
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
        return this._handleResults(new Error("Payload must be valid json"));
      }

      try {
        checkField(data, 'command', "Request is missing command field");
        console.log('Got message. invoking handler ...', data);
        switch (data.command) {
          case 'locale':
            this._handleLocale(data);
            break;
          case 'metadata':
            this._handleMetadata(data);
            break;
          case 'message':
            this._handleMessage(data);
            break;
          case 'html':
            this._handleHtml(data);
            break;
          default:
            this._handleResults(new Error("Unknown command requested"));
        }
      } catch (error) {
        return this._handleResults(error);
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

  _handleResults(error, response) {
    if (error) {
      console.error("Message processing failed", error);
      return this.commandSocket.send(JSON.stringify({"error": error.message}));
    }

    const output = JSON.stringify(response);
    console.log('Results: ', output);
    return this.commandSocket.send(output);
  }

  _handleHtml() {
    const path = this.handler.getNodeRepresentationPath();
    const html = fs.readFileSync(path);
    this._handleResults(undefined, { payload: html.toString('utf8') });
  }

  _handleMetadata() {
    this._handleResults(undefined, { payload: this.handler.getMetadata() });
  }

  _handleLocale(data) {
    checkField(data, 'locale', "Missing locale to be returned");
    this._handleResults(undefined, { payload: this.handler.getLocaleData(data.locale)});
  }

  _handleMessage(data) {
    checkField(data, 'config', "Missing node config to be used");
    checkField(data, 'message', "Missing message to be processed");
    checkField(data, 'metadata', "Missing metadata to be processed");

    this.handler.handleMessage(data.config, data.message, this._handleResults, data.metadata, this.contextHandler);
  }
}
