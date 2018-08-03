"use strict";

var dojot = require('@dojot/flow-node');
var dispatcher = require('../../dispatcher');
var fs = require('fs');

class RemoteNodeHandler extends dojot.DataHandlerBase {

  /**
   * Constructor
   * @param {string} image The image to be added to Kubernetes pod
   * @param {string} id Node ID
   */
  constructor() {
    super();
    
  }

  init() {
    // Fetch all meta information from newly created remote impl
    return dispatcher(this.target, {command: 'metadata'})
      .then(meta => {
        this.metadata = meta.payload;
        return dispatcher(this.target, { command: 'html' })
      })
      .then(html => {
        this.html = '/tmp/' + this.target;
        fs.writeFileSync(this.html, html.payload);
        return dispatcher(this.target, { command: 'locale', locale: 'en-US' })
      })
      .then(reply => {
        this.locale = reply.payload;
      });
  }
  getNodeRepresentationPath() {
    return this.html;
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
  getLocaleData() {
    return this.locale;
  }

  handleMessage(config, message, callback, metadata) {
    // invoke remote
    let command = {
      command: 'message',
      message: message,
      config: config,
      metadata: metadata
    };
    dispatcher(this.target, command).then((reply) => {
      if (reply.error) {
        return callback(reply.error);
      }

      if (Array.isArray(reply)){
        return callback(undefined, reply);
      }

      return callback(new Error("Invalid response received from node"));
    }).catch((error) => {
      callback(error);
    });
  }
}

module.exports = {Handler: RemoteNodeHandler};