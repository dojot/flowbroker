"use strict";

var path = require('path')
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
   * Returns object with locale data (for the given locale)
   * @param  {[string]} locale Locale string, such as "en-US"
   * @return {[object]}        Locale settings used by the module
   */
  getLocaleData(/*locale*/) {
    return {};
  }

  handleMessage(config, message, callback, metadata, contextHandler) {
    
    let getContextPromise;

    if (config.contextLayer === 'tenant') {
      getContextPromise = contextHandler.getTenantContext(metadata.tenant, config.contextName); 
    } else { // flow layer
      getContextPromise = contextHandler.getFlowContext(metadata.tenant, metadata.flowId, config.contextName);
    }

    getContextPromise.then( (results) => {
      let [contextId, contextContent] = results;

      contextHandler.saveContext(contextId, contextContent).then( () => {
        try {
          this._set(config.contextContent, contextContent, message);
          callback(undefined, [message]);
        } catch (error) {
          callback(error);
        }
      }).catch((error) => {
        callback(error);
      })
    }).catch((error) => {
      callback(error);
    });
  }  
}

module.exports = { Handler: DataHandler };