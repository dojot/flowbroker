"use strict";

let fs = require('fs');
let path = require('path');
var dojot = require('@dojot/flow-node');

var geolib = require('geolib');

// Sample node implementation
class DataHandler {
  constructor() {
  }

  /**
   * Returns full path to html file
   * @return {string} String with the path to the node representation file
   */
  getNodeRepresentationPath() {
    return path.resolve(__dirname, 'geo.html');
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      'id': 'dojot/geofence',
      'name': 'geofence',
      'module': 'dojot',
      'version': '1.0.0',
    }
  }

  /**
   * Returns object with locale data (for the given locale)
   * @param  {[string]} locale Locale string, such as "en-US"
   * @return {[object]}        Locale settings used by the module
   */
  getLocaleData(locale) {

    let filepath = path.join(__dirname, "locales/" + locale + "/geo.json");
    if (fs.existsSync(filepath)) {
      return require(filepath);
    } else {
      return null
    }

  }

  /**
   * Check if the node configuration is valid
   * @param {object} config  Configuration data for the node
   * @return {[boolean, object]} Boolean variable stating if the configuration is valid or not and error message
   */
  checkConfig(config) {

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

    let loc = undefined;
    for (let attr in message.payload) {
      try {
        let parsed = (message.payload[attr]).match(/([+-]?\d+(.\d+)?)[ ]*,[ ]*([+-]?\d+(.\d+)?)/);
        if (parsed) {
          loc = {
            latitude: parsed[1],
            longitude: parsed[3]
          }
          break;
        }
      } catch (error) {}
    }

    if (loc) {
      let inout = geolib.isPointInside(loc, config.points);
      if (inout && (config.filter === "inside")) {
        if (config.name) {
          if (!message.location) {
            message.location = {};
          }
          message.location.isat = message.location.isat || [];
          message.location.isat.push(config.name);
        }
        return callback(undefined, [message]);
      }

      if (!inout && (config.filter === "outside")) {
        return callback(undefined, [message]);
      }

      return callback(undefined, []);
    }

    callback(new Error("Message has no geographic position attached"));
  }
}

// var main = new DojotHandler(new DataHandler());
module.exports = { Handler: DataHandler };
