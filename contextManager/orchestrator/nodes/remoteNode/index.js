"use strict";

var dojot = require('@dojot/flow-node');
var Dispatcher = require('../../dispatcher');
var fs = require('fs');

class RemoteNodeHandler extends dojot.DataHandlerBase {

  /**
   * Constructor
   * @param {string} id Node ID
   * @param {string} serverAddress server address
   * @param {integer} serverPort server port
   */
  constructor(id, serverAddress, serverPort) {
    super();
    this.id = id;
    this.serverAddress = serverAddress;
    this.serverPort = serverPort;
    this.dispatcher = null;
  }

  init() {
    this.dispatcher = new Dispatcher(this.serverAddress, this.serverPort);
    this.dispatcher.init();

    // Fetch all meta information from newly created remote impl
    return this.dispatcher.sendRequest({command: 'metadata'})
      .then(meta => {
        this.metadata = meta.payload;
        return this.dispatcher.sendRequest({ command: 'html' });
      })
      .then(html => {
        this.html = '/tmp/' + this.id;
        fs.writeFileSync(this.html, html.payload);
      });

  }
  getNodeRepresentationPath() {
    return this.html;
  }

  deinit() {
    if (this.dispatcher) {
      this.dispatcher.deinit();
    }
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return this.metadata;
  }

  /**
   * Returns object with locale data (for the given locale)
   * @param  {[string]} locale Locale string, such as "en-US"
   * @return {[object]}        Locale settings used by the module
   */
  async getLocaleData(locale) {
      const  res = await (this.dispatcher.sendRequest({command: 'locale', locale: locale}));
      return res.payload;
  }

  handleMessage(config, message, metadata) {
    // invoke remote
    let command = {
      command: 'message',
      message: message,
      config: config,
      metadata: metadata
    };

    return new Promise ( (resolve, reject) => {
      this.dispatcher.sendRequest(command).then((reply) => {
        if (reply.error) {
          return reject(reply.error);
        }

        if (Array.isArray(reply)){
          return resolve(reply);
        }

        return reject(new Error("Invalid response received from node"));
      }).catch((error) => {
        reject(error);
      });
    });
  }
}

module.exports = {Handler: RemoteNodeHandler};
