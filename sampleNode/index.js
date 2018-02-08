"use strict";

var os = require('os');
var DojotHandler = require('dojot-node-library');

// Sample node implementation
class DataHandler {
  constructor() {}

  /**
   * Returns full path to html file
   * @return {[string]} [description]
   */
  getNodeRepresentationPath() {
    return "/opt/node/node.html";
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {[type]} [description]
   */
  getMetadata() {
    return {
      // ID can actually be any unique human-friendly string
      // on proper node-red modules it is "$module/$name"
      'id': 'b6b94e0c-0c49-11e8-bf58-1b672af10154',
      // This is usually the name of the node
      'name': 'dummy',
      // This is usually the name of the node (as in npm) module
      'module': 'dummy',
      'version': '0.0.0',
    }
  }

  /**
   * Returns object with locale data (for the given locale)
   * @param  {[string]} locale Locale string, such as "en-US"
   * @return {[object]}        Locale settings used by the module
   */
  getLocaleData(locale) {
    // This is just a sample copied over from node-red-contrib-rpe, as a sample
    // A real implementation might want to parse the contents off a file
    return {
      "rbe": {
        "label": {
          "func": "Mode",
          "start": "Start value",
          "name": "Name"
        },
        "placeholder": {
          "bandgap": "e.g. 10 or 5%",
          "start": "leave blank to use first data received"
        },
        "opts": {
          "rbe": "block unless value changes",
          "deadband": "block unless value change is greater than",
          "deadbandEq": "block unless value change is greater or equal to",
          "narrowband": "block if value change is greater than",
          "narrowbandEq": "block if value change is greater or equal to",
          "in": "compared to last input value",
          "out": "compared to last valid output value"
        },
        "warn": {
          "nonumber": "no number found in payload"
        }
      }
    };
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
    setTimeout(() => {
      let response = message;
      response[os.hostname()] = true;
      callback(undefined, [response]);
    }, 10);
  }
}

var main = new DojotHandler(new DataHandler());
