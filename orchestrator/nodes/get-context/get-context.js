"use strict";

var path = require('path');
var dojot = require('@dojot/flow-node');

// Sample node implementation
class DataHandler extends dojot.DataHandlerBase {
  constructor() {
    console.log('Constructor');
    super();
  }

  /**
   * Returns full path to html file
   * @return {[string]} [description]
   */
  getNodeRepresentationPath() {
    return path.resolve(__dirname, 'get-context.html');
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
      'id': 'dojot/get-context',
      // This is usually the name of the node
      'name': 'get context',
      // This is usually the name of the node (as in npm) module
      'module': 'dojot',
      'version': '1.0.0'
    };
  }

    /**
     * Returns full path to locales
     * @returns String
     */
    getLocalesPath() {
        return path.resolve(__dirname, './locales');
    }

  handleMessage(config, message, metadata, contextHandler) {
    return new Promise ( (resolve, reject) => {
      let getContextPromise;
      let contextName = config.contextName;

      if (config.contextNameType === 'msg') {
        contextName = this._get(config.contextName, message);
      }

      if (config.contextLayer === 'tenant') {
        getContextPromise = contextHandler.getTenantContext(metadata.tenant, contextName);
      } else { // flow layer
        getContextPromise = contextHandler.getFlowContext(metadata.tenant, metadata.flowId, contextName);
      }

      getContextPromise.then( (contextContent) => {
        try {
          this._set(config.contextContent, contextContent, message);
          return resolve([message]);
        } catch (error) {
          return reject(error);
        }
      }).catch((error) => {
        return reject(error);
      });
    });
  }
}

module.exports = { Handler: DataHandler };
