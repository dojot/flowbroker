var path = require('path');
var util = require('util');
var logger = require("../../logger").logger;
var dojot = require('@dojot/flow-node');

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
    return path.resolve(__dirname, 'device-out.html');
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      'id': 'dojot/device-out',
      'name': 'device out',
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

  handleMessage(config, message, metadata) {
    logger.debug("Executing device-out node...");
    if ((config.attrs === undefined) || (config.attrs.length === 0)) {
      logger.debug("... device-out node was not successfully executed.");
      logger.error("Node has no output field set.");
      return Promise.reject(new Error('Invalid data source: field is mandatory'));
    }

    let deviceId;
    switch (config.device_source) {
      case 'configured':
        if (config._device_id === undefined) {
          logger.debug("... actuate node was not successfully executed.");
          logger.error("There is not device configured to actuate");
          return Promise.reject(new Error('Invalid Device id'));
        }
        deviceId = config._device_id;
      break;
      case 'self':
        deviceId = metadata.originatorDeviceId;
      break;
      case 'dynamic':
        if ((config.device_source_msg === undefined) || (config.device_source_msg.length === 0)) {
          logger.debug("... actuate node was not successfully executed.");
          logger.error("Missing device source msg.");
          return Promise.reject(new Error('Invalid device source msg: field is mandatory'));
        }
        try {
          deviceId = this._get(config.device_source_msg, message);
        } catch (error) {
          logger.debug("... actuate node was not successfully executed.");
          logger.error(`Error while executing actuate node: ${error}`);
          return Promise.reject(error);
        }
      break;
      default:
        return Promise.reject(new Error('Invalid device source'));
    }

    try {
      let output = {
        metadata: {
          deviceid: deviceId,
          tenant: metadata.tenant,
          timestamp: Date.now()
        },
        attrs: this._get(config.attrs, message)
      };
      logger.debug(`Updating device... `);
      logger.debug(`Message is: ${util.inspect(output, { depth: null })}`);
      this.publisher.publish(output);
      logger.debug("... device was updated.");
      logger.debug("... device-out node was successfully executed.");
      return Promise.resolve();
    } catch (error) {
      logger.debug("... device-out node was not successfully executed.");
      logger.error(`Error while executing device-out node: ${error}`);
      return Promise.reject(error);
    }
  }
}

module.exports = {Handler: DataHandler};
