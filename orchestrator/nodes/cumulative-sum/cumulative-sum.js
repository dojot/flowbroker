var path = require('path');
const logger = require("@dojot/dojot-module-logger").logger;
var dojot = require('@dojot/flow-node');

class DataHandler extends dojot.DataHandlerBase {
  constructor() {
    super();
  }

  /**
   * Returns full path to html file
   * @return {string} String with the path to the node representation file
   */
  getNodeRepresentationPath() {
    return path.resolve(__dirname, 'cumulative-sum.html');
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      'id': 'dojot/cumulative-sum',
      'name': 'cumulative sum',
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
      let eventValue = this._get(config.targetAttribute, message);
      let eventTimestamp = this._get(config.timestamp, message);
      if ( (!eventValue) || isNaN(eventValue) ) {
        logger.warn(`Invalid target attribute ${eventValue}`, { filename: 'cumulative sum' });
        return false;
      }
      if ( (!eventTimestamp) || isNaN(eventTimestamp) ) {
        logger.warn(`Invalid timestamp ${eventValue}`, { filename: 'cumulative sum' });
        return false;
      }
      if ( (!config.timePeriod) || isNaN(config.timePeriod) || (config.timePeriod <= 0) ){
        logger.warn(`Invalid time period ${timePeriod}`, { filename: 'cumulative sum' });
        return false;
      }
      if (!config.output) {
        logger.warn('Undefined output', { filename: 'cumulative sum' });
        return false;
      }
    } catch (error) {
      logger.warn(`Failed to validate parameters. Error: ${error}`, { filename: 'cumulative sum' });
      return false;
    }
    return true;
  }

  handleMessage(config, message, metadata, contextHandler) {
    logger.debug("Executing cumulative sum node...", { filename: 'cumulative sum' });
    if (!this._isParametersValid(config, message)) {
      logger.warn("Invalid parameters.", { filename: 'cumulative sum' });
      return Promise.reject(new Error('Invalid parameters.'));
    }

    let eventValue = this._get(config.targetAttribute, message);
    let eventTimestamp = this._get(config.timestamp, message);
    let period = config.timePeriod * 60000; // transform from minutes to miliseconds

    return contextHandler.wlockAndGetNodeInstanceContext(metadata.tenant, metadata.flowId,
      config.type, config.id, 'data').then((values) => {
        let [contextId, contextContent] = values;
        if (!contextContent.sum) {
          contextContent.sum = 0;
          contextContent.entries = [];
        }

        let threshold = eventTimestamp - period;
        let indexToSlice = contextContent.entries.length;

        if ((indexToSlice > 0) && (contextContent.entries[indexToSlice-1].timestamp > eventTimestamp)) {
          logger.warn('Messy time', { filename: 'cumulative sum' });
          return contextHandler.unlockContext(contextId).then(() => {
            return Promise.reject('Messy time');
          }).catch((error) => {
            logger.error(`Failed to unlock context. Error: ${error}`, { filename: 'cumulative sum' });
            return Promise.reject('Messy time');
          })
        }

        let sum = 0;
        for (let i = 0; i < contextContent.entries.length; i++) {
          let entry = contextContent.entries[i];
          if (entry.timestamp < threshold) {
            sum += entry.value;
          } else {
            indexToSlice = i;
            break;
          }
        }

        contextContent.entries.push({timestamp: eventTimestamp, value: eventValue});
        contextContent.entries = contextContent.entries.slice(indexToSlice);
        contextContent.sum = contextContent.sum - sum + eventValue;

        return contextHandler.saveAndUnlockContext(contextId, contextContent).then(() => {
          this._set(config.output, contextContent.sum, message);
          return Promise.resolve([message]);
        }).catch((error)=> {
          logger.error(`Failed to unlock context. Error: ${error}`, { filename: 'cumulative sum' });
          return Promise.resolve('Failed to unlock context.');
        });
      }).catch((error) => {
        logger.error(`Failed to retrieve context. Error: ${error}`, { filename: 'cumulative sum' });
        return Promise.resolve('Failed to retrieve context.');
      });
  }
}

module.exports = {Handler: DataHandler};
