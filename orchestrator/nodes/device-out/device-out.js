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
    logger.debug("Executing device-out node...");
    if ((config.attrs === undefined) || (config.attrs.length === 0)) {
      logger.debug("... device-out node was not successfully executed.");
      logger.error("Node has no output field set.");
      return Promise.reject(new Error('Invalid data source: field is mandatory'));
    }

    try {
      let output = { attrs: {}, metadata: {} };

      try {
        output.attrs = this._get(config.attrs, message);
      } catch (e) {
        logger.debug("... device-out node was not successfully executed.");
        logger.error(`Error while executing device-out node: ${e}`);
        return Promise.reject(e);
      }

      let devicesIds = this._getDevicesIds(config.device_source,
        config.devices_source_configured,
        config.devices_source_dynamic,
        metadata.originatorDeviceId,
        message);

      if (devicesIds.length === 0) {
        logger.debug("... device-out node was not successfully executed.");
        return Promise.reject(new Error('Could not define target devices'));
      }

      output.metadata.timestamp = Date.now();
      output.metadata.tenant = metadata.tenant;

      logger.debug("Updating device... ");
      logger.debug(`Message is: ${util.inspect(output, { depth: null })}`);

      // avoid send the same event to the same device, it can occurr due to
      // an errouneus configuration
      let devicesSet = new Set(devicesIds);

      for (let deviceId of devicesSet) {
        let event = JSON.parse(JSON.stringify(output));
        event.metadata.deviceid = deviceId;
        this.publisher.publish(event);
      }
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
