"use strict";

let fs = require('fs');
var logger = require("../../logger").logger;
let path = require('path');
var dojot = require('@dojot/flow-node');

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
    return path.resolve(__dirname, 'change.html');
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      'id': 'dojot/change',
      'name': 'change',
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
    let filepath = path.join(__dirname, "locales/" + locale + "/change.json");
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
  checkConfig(config) {

    let jsonata = require("jsonata");
    let rule;

    for (let i = 0; i < config.rules.length; i++) {
      rule = config.rules[i];
      // Migrate to type-aware rules
      if (!rule.pt) {
        rule.pt = "msg";
      }
      if (rule.t === "change" && rule.re) {
        rule.fromt = 're';
        delete rule.re;
      }
      if (rule.t === "set" && !rule.tot) {
        if (rule.to.indexOf("msg.") === 0 && !rule.tot) {
          rule.to = rule.to.substring(4);
          rule.tot = "msg";
        }
      }
      if (!rule.tot) {
        rule.tot = "str";
      }
      if (!rule.fromt) {
        rule.fromt = "str";
      }
      if (rule.t === "change" && rule.fromt !== 'msg' && rule.fromt !== 'flow' && rule.fromt !== 'global') {
        rule.fromRE = rule.from;
        if (rule.fromt !== 're') {
          rule.fromRE = rule.fromRE.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        }
        try {
          rule.fromRE = new RegExp(rule.fromRE, "g");
        } catch (e) {

          return [false, {
            error_type: "change.errors.invalid-from",
            error_data: {
              error: e.message
            }
          }];
        }
      }

      if (rule.tot === 'num') {
        rule.to = Number(rule.to);
      } else if (rule.tot === 'json') {
        try {
          // check this is parsable JSON
          JSON.parse(rule.to);
        } catch (e2) {

          return [false, {
            error_type: "change.errors.invalid-json",
            error_data: {}
          }];
        }
      } else if (rule.tot === 'bool') {
        rule.to = /^true$/i.test(rule.to);
      } else if (rule.tot === 'jsonata') {
        try {
          rule.to = jsonata(rule.to);
        } catch (e) {
          return [false, {
            error_type: "change.errors.invalid-from",
            error_data: {
              error: e.message
            }
          }];
        }
      }
    }

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
    logger.debug("Executing change node...");
    try {
      for (let rule of config.rules) {
        if (rule.t === "set") {
          let v2;
          switch (rule.tot) {
            case "str":
              this._set(rule.p, rule.to, message);
              break;
            case "num":
              this._set(rule.p, Number(rule.to), message);
              break;
            case "boolean":
              v2 = ['1', 'true'].includes(rule.to.tolowercase());
              this._set(rule.p, v2, message);
              break;
            case "msg":
              try {
                // This function might throw an exception
                v2 = this._get(rule.to, message);
                this._set(rule.p, v2, message);
              } catch (e) {
                logger.error("... change node was not successfully executed.");
                logger.error(`Error while executing change node: ${e}`);
                return callback(e);
              }
              break;
            default:
              logger.debug("... change node was not successfully executed.");
              logger.error(`Change node has invalid value type: ${rule.tot}`);
              return callback(new Error('Invalid value type: ' + rule.tot));
          }
        }
      }
      logger.debug("... change node was successfully executed.");
      return callback(undefined, [message]);
    } catch (error) {
      logger.debug("... change node was not successfully executed.");
      logger.error(`Error while executing change node: ${error}`);
      return callback(error);
    }
  }
}

// var main = new DojotHandler(new DataHandler());
module.exports = { Handler: DataHandler };
