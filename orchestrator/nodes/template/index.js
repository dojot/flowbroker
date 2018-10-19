"use strict";

let fs = require('fs');
let path = require('path');
var dojot = require('@dojot/flow-node');
let mustache = require('mustache');
var logger = require("@dojot/dojot-module-logger").logger;

// Sample node implementation
class DataHandler extends dojot.DataHandlerBase {
  constructor() {
    super();
  }

  /**
   * Returns full path to html file
   * @return {string} String with the path to the node representation file
   */
  getNodeRepresentationPath() {
    return path.resolve(__dirname, 'template.html');
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      'id': 'dojot/template',
      'name': 'template',
      'module': 'dojot',
      'version': '1.0.0',
    };
  }

  /**
   * Returns object with locale data (for the given locale)
   * @param  {[string]} locale Locale string, such as "en-US"
   * @return {[object]}        Locale settings used by the module
   */
  getLocaleData(locale) {

    let filepath = path.join(__dirname, "locales/" + locale + "/template.json");
    if (fs.existsSync(filepath)) {
      return require(filepath);
    } else {
      return null;
    }

  }

  /**
   * Check if the node configuration is valid
   * @param {object} config  Configuration data for the node
   * @return {[boolean, object]} Boolean variable stating if the configuration is valid or not and error message
   */
  checkConfig() {

    return [true, null];
  }

  /**
   * Statelessly handle a single given message, using given node configuration parameters
   *
   * This method should perform all computation required by the node, transforming its inputs
   * into outputs. When such processing is done, the node should issue a call to the provided
   * callback, notifying either failure to process the message with given config, or the set
   * of transformed messages to be sent to the flow's next hop.
   *
   * @param  {[type]}       config   Node configuration to be used for this message
   * @param  {[type]}       message  Message to be processed
   * @param  {Function}     callback Callback to call upon processing completion
   * @return {[undefined]}
   */
  handleMessage(config, message, callback) {
    logger.debug("Executing template node...");
    try {
      let result = mustache.render(config.template, message);
      this._set(config.field, result, message);
      logger.debug("... template node was successfully executed.");
      return callback(undefined, [message]);
    } catch (error) {
      logger.debug("... template node was not successfully executed.");
      logger.error(`Error while executing template node: ${error}`);
      return callback(error);
    }
  }
}

// var main = new DojotHandler(new DataHandler());
module.exports = { Handler: DataHandler };
