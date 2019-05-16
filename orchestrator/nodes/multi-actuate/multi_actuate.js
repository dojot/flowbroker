var path = require('path');
var util = require('util');
var logger = require("../../logger").logger;
var dojot = require('@dojot/flow-node');

class DataHandler extends dojot.DataHandlerBase {
  constructor(kafkaMessenger, subject) {
    super();
    this.kafkaMessenger = kafkaMessenger;
    this.subject = subject;
  }

  /**
     * Returns full path to html file
     * @return {string} String with the path to the node representation file
     */
  getNodeRepresentationPath() {
    return path.resolve(__dirname, 'multi_actuate.html');
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      'id': 'dojot/multi-actuate',
      'name': 'multi actuate',
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

  _getDevicesIds(deviceSource, configuredDevices, dynamicDevices, originatorDeviceId, message) {
    let devicesIds = [];
    switch (deviceSource) {
      case 'configured':
        if ((configuredDevices === undefined) || (configuredDevices.length === 0) ) {
          logger.debug("Empty configured devices");
          return [];
        }
        devicesIds = configuredDevices;
      break;
      case 'self':
        devicesIds.push(originatorDeviceId);
      break;
      case 'dynamic':
        if ((dynamicDevices === undefined) || (dynamicDevices.length === 0)) {
          logger.debug("Empty dynamic devices");
          return [];
        }
        try {
          let devices = this._get(dynamicDevices, message);
          if (Array.isArray(devices)) {
            devicesIds = devices;
          } else {
            if (devices === undefined) {
              logger.debug('Dynamic devices is undefined');
              return [];
            }
            devicesIds.push(devices);
          }
        } catch (error) {
          logger.error(`Error while executing device out node: ${error}`);
          return [];
        }
      break;
      default:
        logger.error(`Invalid device source ${deviceSource}`);
        return [];
    }

    return devicesIds;
  }

  handleMessage(config, message, metadata) {
    logger.debug("Executing multi actuate node...");
    if ((config.attrs === undefined) || (config.attrs.length === 0)) {
      logger.debug("... actuate node was not successfully executed.");
      logger.error("Node has no output field set.");
      return Promise.reject(new Error('Invalid data source: field is mandatory'));
    }

    try {
      let output = { 
        event: 'configure',
        data: {
          attrs: {},
        },
        meta: {
          service: metadata.tenant,
          timestamp: Date.now()
        }
      };

      try {
        output.data.attrs = this._get(config.attrs, message);
      } catch (e) {
        logger.debug("... multi actuate node was not successfully executed.");
        logger.error(`Error while executing multi actuate node: ${e}`);
        return Promise.reject(e);
      }

      let devicesIds = this._getDevicesIds(config.device_source,
        config.devices_source_configured,
        config.devices_source_dynamic,
        metadata.originatorDeviceId,
        message);

      if (devicesIds.length === 0) {
        logger.debug("... multi actuate node was not successfully executed.");
        return Promise.reject(new Error('Could not define target devices'));
      }

      logger.debug("Sending message to device(s)... ");
      logger.debug(`Message is: ${util.inspect(output, { depth: null })}`);

      // avoid send the same event to the same device, it can occurr due to
      // an errouneus configuration
      let devicesSet = new Set(devicesIds);

      for (let deviceId of devicesSet) {
        let event = JSON.parse(JSON.stringify(output));
        event.data.id = deviceId;

        this.kafkaMessenger.publish(this.subject, metadata.tenant, JSON.stringify(event));
      }
      logger.debug("... message sent.");
      logger.debug("... multi actuate node was successfully executed.");
      return Promise.resolve();
    } catch (error) {
      logger.debug("... multi actuate node was not successfully executed.");
      logger.error(`Error while executing multi actuate node: ${error}`);
      return Promise.reject(error);
    }
  }
}

module.exports = {Handler: DataHandler};
