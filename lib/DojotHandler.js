"use strict";

const zmq = require('zeromq');
const fs = require('fs');
const ContextManagerClient = require('./ContextManagerClient.js');
const ContextHandler = require('./ContextHandler.js');

const ZMQ_PORT = 5555;

function checkField(target, field, message) {
  if (!target.hasOwnProperty(field)) {
    throw new Error(message);
  }
}

module.exports = class DojotHandler {
  constructor(dataHandler,
      contextResponseTimeout,
      contextManagerHost,
      contextManagerPort) {

    let ctxResponseTimeout = contextResponseTimeout || 10000;
    let ctxManagerHost = contextManagerHost || "flowbroker-context-manager";
    let ctxManagerPort = contextManagerPort || 5556;

    this.handler = dataHandler;
    this.contextManager = new ContextManagerClient(ctxManagerHost,
      ctxManagerPort,
      ctxResponseTimeout);
    this.contextHandler = null;
    this.isInitialized = false;
    this.port = ZMQ_PORT;
    this.sock = null;
  }

  init() {
    if (this.isInitialized) {
      console.log('CommandHandler is already initialized');
      return;
    }

    this.sock = zmq.socket('router');

    this.sock.on("message", (identity, packet) => {
      let request;
      //parse the packet
      try {
        request = JSON.parse(packet);
      } catch (error) {
        console.log("Invalid JSON format. Discarding request: %s. Error:",
          packet.toString(), error);
        return;
      }
      try {
        // console.log('Got message. invoking handler ...', payload);
        checkField(request, 'requestId', "Request is missing requestId field");
        checkField(request, 'payload', "Request is missing payload field");

        this._handleRequest(request.payload).then((response) => {
          let responsePacket = {
            payload: response,
            requestId: request.requestId
          };
          this.sock.send([identity, JSON.stringify(responsePacket)]);
        }).catch( (error) => {
          let responsePacket = {
            payload: { error },
            requestId: request.requestId
          };
          this.sock.send([identity, JSON.stringify(responsePacket)]);
        });
      } catch (error) {
        console.log("Exception: " + error);
        return;
      }
    }); // on message

    process.on('SIGINT', () => {
      this.sock.close();
    });

    this.sock.bind('tcp://*:' + this.port, (err) => {
      if (err) {
        console.log('Failed on bind the zmq port %d. Error: %s', this.port, err);
        process.exit(1);
      } else {
        console.log('zmq listening on %d', this.port);
      }
    });

    this.contextManager.init();
    this.contextHandler = new ContextHandler(this.contextManager);

    this.isInitialized = true;
  }

  _handleRequest(request) {

    try {
      checkField(request, 'command', "Request is missing command field");
      console.log('Got message. invoking handler ...', request);
      switch (request.command) {
        case 'locale':
          return this._handleLocale(request);
        case 'metadata':
          return this._handleMetadata(request);
        case 'message':
          return this._handleMessage(request);
        case 'html':
          return this._handleHtml(request);
        default:
        return Promise.reject(new Error("Unknown command requested"));
      }
    } catch (error) {
      return Promise.reject(error);
    }
  }

  _handleHtml() {
    const path = this.handler.getNodeRepresentationPath();
    const html = fs.readFileSync(path);
    return Promise.resolve({ payload: html.toString('utf8') });
  }

  _handleMetadata() {
    return Promise.resolve({ payload: this.handler.getMetadata() });
  }

  _handleLocale(data) {
    checkField(data, 'locale', "Missing locale to be returned");
    return this.handler.getLocaleData(data.locale).then(dataLocale =>{
        return Promise.resolve({ payload: dataLocale});
    }).catch(()=>{
        return Promise.resolve({});
    });
  }

  _handleMessage(data) {
    checkField(data, 'config', "Missing node config to be used");
    checkField(data, 'message', "Missing message to be processed");
    checkField(data, 'metadata', "Missing metadata to be processed");

    return this.handler.handleMessage(data.config, data.message, data.metadata, this.contextHandler)
      .then((result) => {
        if (!result) {
          return Promise.resolve([]);
        }
        return Promise.resolve(result);
      });
  }
}
