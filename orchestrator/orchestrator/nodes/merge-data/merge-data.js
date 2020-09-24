var path = require('path');
const logger = require("@dojot/dojot-module-logger").logger;
var dojot = require('@dojot/flow-node');
var lodash = require('lodash');

class DataHandler extends dojot.DataHandlerBase {
  constructor() {
    super();
  }

  /**
   * Returns full path to html file
   * @return {string} String with the path to the node representation file
   */
  getNodeRepresentationPath() {
    return path.resolve(__dirname, 'merge-data.html');
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      'id': 'dojot/merge-data',
      'name': 'merge data',
      'module': 'dojot',
      'version': '1.0.0',
    };
  }

  /**
   * Returns full path to locales
   * @returns String
   */
  getLocalesPath() {
    return path.resolve(__dirname, './locales');
  }

  _isParametersValid(config, message) {
    try {
      let targetData = this._get(config.targetData, message);
      if ( (!targetData) || !(targetData instanceof Object) ) {
        logger.error(`Invalid target data: ${targetData}`);
        return false;
      }
      if (!config.mergedData) {
        logger.error('Undefined output');
        return false;
      }
    } catch (error) {
      logger.error(`Failed to validate parameters. Error: ${error}`, { filename: 'merge data' });
      return false;
    }
    return true;
  }

  handleMessage(config, message, metadata, contextHandler) {
    logger.debug("Executing merge data node...", { filename: 'merge data' });
    if (!this._isParametersValid(config, message)) {
      logger.error("Invalid parameters.", { filename: 'merge data' });
      return Promise.reject(new Error('Invalid parameters.'));
    }

    let targetData = this._get(config.targetData, message);

    return contextHandler.wlockAndGetNodeInstanceContext(metadata.tenant, metadata.flowId,
      config.type, config.id, 'data').then((values) => {
        let [contextId, contextContent] = values;
        if (!contextContent) {
          contextContent = {};
        }

        let mergedData = lodash.merge(contextContent, targetData);

        return contextHandler.saveAndUnlockContext(contextId, mergedData).then(() => {
          this._set(config.mergedData, mergedData, message);
          return Promise.resolve([message]);
        }).catch((error)=> {
          logger.error(`Failed to unlock context. Error: ${error}`, { filename: 'merge data' });
          return Promise.resolve('Failed to unlock context.');
        });
      }).catch((error) => {
        logger.error(`Failed to retrieve context. Error: ${error}`, { filename: 'merge data' });
        return Promise.resolve('Failed to retrieve context.');
      });
  }
}

module.exports = {Handler: DataHandler};
