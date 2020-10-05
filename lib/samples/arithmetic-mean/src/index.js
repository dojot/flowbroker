"use strict";

const path = require('path')
const dojot = require('@dojot/flow-node');

// Sample node implementation
class DataHandler extends dojot.DataHandlerBase {
  constructor() {
    super();
  }

  /**
   * Returns full path to html file
   * @return {[string]} [description]
   */
  getNodeRepresentationPath() {
    return path.resolve(__dirname, 'arithmeticMean.html');
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
      'id': 'arithmetic-mean',
      // This is usually the name of the node
      'name': 'arithmetic-mean',
      // This is usually the name of the node (as in npm) module
      'module': 'arithmetic-mean-node-module',
      'version': '0.1.0',
    };
  }


  /**
   * Returns full path to locales
   * @returns {String} Path segments into an absolute path.
   */
  getLocalesPath() {
    return path.resolve(__dirname, './locales');
  }

  /**
   * Statelessly handle a single given message, using given node configuration parameters
   *
   * This method should perform all computation required by the node, transforming its inputs
   * into outputs.
   *
   * @param  {[type]}       config   Node configuration to be used for this message
   * @param  {[type]}       message  Message to be processed
   * @return {[Promise]}
   */
  handleMessage(config, message, metadata, contextHandler) {

    let targetValue = 0;
    try {
      targetValue += this._get(config.in, message);
    } catch (e) {
      console.log(`Missing ${config.in} parameter`);
      Promise.reject('Configuration problem');
    }

    return new Promise((resolve, reject) => {
      contextHandler.wlockAndGetNodeInstanceContext(metadata.tenant,
        metadata.flowId, config.type, config.id, 'data').then((values) => {
          let [contextId, contextContent] = values;

          if (!contextContent.hasOwnProperty('counter')) {
            contextContent.counter = 0;
          }
          if (!contextContent.hasOwnProperty('sum')) {
            contextContent.sum = 0;
          }

          contextContent.counter++;
          contextContent.sum += targetValue;

          contextHandler.saveAndUnlockContext(contextId, contextContent).then(() => {
            this._set(config.out, contextContent.sum / contextContent.counter, message);
            return resolve([message]);
          }).catch((error) => {
            console.log(`failed to save the context. Error: ${error}`);
            return reject('failed to save the context');
          });
        }).catch((error) => {
          console.log(`failed to retrieve the context. Error: ${error}`);
          return reject('failed to retrieve the context');
        });
    });
  }
}

var main = new dojot.DojotHandler(new DataHandler());
main.init();
