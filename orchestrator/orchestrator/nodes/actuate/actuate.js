var path = require('path');
var dojot = require('@dojot/flow-node');
const logger = require("@dojot/dojot-module-logger").logger;
var util = require("util");

class DataHandler extends dojot.DataHandlerBase {
  constructor(publisher) {
    super();
    this.publisher = publisher;
  }

  /**
     * Returns full path to html file
     * @return {string} String with the path to the node representation file
     */
  getNodeRepresentationPath() {
    return path.resolve(__dirname, 'actuate.html');
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      'id': 'dojot/actuate',
      'name': 'actuate',
      'module': 'dojot',
      'version': '1.1.0',
    };
  }

    /**
     * Returns full path to locales
     * @returns String
     */
    getLocalesPath() {
        return path.resolve(__dirname, './locales');
    }

  handleMessage(config, message, metadata) {

    logger.debug("Executing actuate node...", { filename: 'actuate' });
    if ((config.attrs === undefined) || (config.attrs.length === 0)) {
      logger.debug("... actuate node was not successfully executed.", { filename: 'actuate' });
      logger.error("Missing data source.", { filename: 'actuate' });
      return Promise.reject(new Error('Invalid data source: field is mandatory'));
    }

    let deviceId;
    switch (config.device_source) {
      case 'configured':
        if (config._device_id === undefined) {
          logger.debug("... actuate node was not successfully executed.", { filename: 'actuate' });
          logger.error("There is not device configured to actuate", { filename: 'actuate' });
          return Promise.reject(new Error('Invalid Device id'));
        }
        deviceId = config._device_id;
      break;
      case 'self':
        deviceId = metadata.originatorDeviceId;
      break;
      case 'dynamic':
        if ((config.device_source_msg === undefined) || (config.device_source_msg.length === 0)) {
          logger.debug("... actuate node was not successfully executed.", { filename: 'actuate' });
          logger.error("Missing device source msg.", { filename: 'actuate' });
          return Promise.reject(new Error('Invalid device source msg: field is mandatory'));
        }
        try {
          deviceId = this._get(config.device_source_msg, message);
        } catch (error) {
          logger.debug("... actuate node was not successfully executed.", { filename: 'actuate' });
          logger.error(`Error while executing actuate node: ${error}`, { filename: 'actuate' });
          return Promise.reject(error);
        }
      break;
      default:
        return Promise.reject(new Error('Invalid device source'));
    }

    try {
      let output = {
        meta: {
          deviceid: deviceId,
          service: metadata.tenant,
          timestamp: Date.now()
        },
        metadata: {
          tenant: metadata.tenant
        },
        event: 'configure',
        data: {
          attrs: this._get(config.attrs, message),
          id: deviceId
        }
      };
      logger.debug(`Sending message... `, { filename: 'actuate' });
      logger.debug(`Message is: ${util.inspect(output, { depth: null })}`, { filename: 'actuate' });
      this.publisher.publish(output);
      logger.debug(`... message was sent.`, { filename: 'actuate' });
      logger.debug("... actuate node was successfully executed.", { filename: 'actuate' });
      return Promise.resolve();
    } catch (error) {
      logger.debug("... actuate node was not successfully executed.", { filename: 'actuate' });
      logger.error(`Error while executing actuate node: ${error}`, { filename: 'actuate' });
      return Promise.reject(error);
    }
  }
}

module.exports = {Handler: DataHandler};
