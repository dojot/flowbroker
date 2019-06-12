var path = require('path');
var util = require('util');
const logger = require("@dojot/dojot-module-logger").logger;
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
    return path.resolve(__dirname, 'multi-device-out.html');
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      'id': 'dojot/multi-device-out',
      'name': 'multi device out',
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
          logger.debug("Empty configured devices", { filename: 'multi device out' });
          return [];
        }
        devicesIds = configuredDevices;
      break;
      case 'self':
        devicesIds.push(originatorDeviceId);
      break;
      case 'dynamic':
        if ((dynamicDevices === undefined) || (dynamicDevices.length === 0)) {
          logger.debug("Empty dynamic devices", { filename: 'multi device out' });
          return [];
        }
        try {
          let devices = this._get(dynamicDevices, message);
          if (Array.isArray(devices)) {
            devicesIds = devices;
          } else {
            if (devices === undefined) {
              logger.debug('Dynamic devices is undefined', { filename: 'multi device out' });
              return [];
            }
            devicesIds.push(devices);
          }
        } catch (error) {
          logger.error(`Error while executing multi device out node: ${error}`, { filename: 'multi device out' });
          return [];
        }
      break;
      default:
        logger.error(`Invalid device source ${deviceSource}`, { filename: 'multi device out' });
        return [];
    }

    return devicesIds;
  }

  handleMessage(config, message, metadata) {
    logger.debug("Executing multi-device-out node...", { filename: 'multi device out' });
    if ((config.attrs === undefined) || (config.attrs.length === 0)) {
      logger.debug("... multi-device-out node was not successfully executed.", { filename: 'multi device out' });
      logger.error("Node has no output field set.");
      return Promise.reject(new Error('Invalid data source: field is mandatory'));
    }

    try {
      let output = { attrs: {}, metadata: {} };

      try {
        output.attrs = this._get(config.attrs, message);
      } catch (e) {
        logger.debug("... multi-device-out node was not successfully executed.", { filename: 'multi device out' });
        logger.error(`Error while executing multi-device-out node: ${e}`, { filename: 'multi device out' });
        return Promise.reject(e);
      }

      let devicesIds = this._getDevicesIds(config.device_source,
        config.devices_source_configured,
        config.devices_source_dynamic,
        metadata.originatorDeviceId,
        message);

      if (devicesIds.length === 0) {
        logger.debug("... multi-device-out node was not successfully executed.", { filename: 'multi device out' });
        return Promise.reject(new Error('Could not define target devices'));
      }

      output.metadata.timestamp = Date.now();
      output.metadata.tenant = metadata.tenant;

      logger.debug("Updating device... ", { filename: 'multi device out' });
      logger.debug(`Message is: ${util.inspect(output, { depth: null })}`, { filename: 'multi device out' });

      // avoid send the same event to the same device, it can occurr due to
      // an errouneus configuration
      let devicesSet = new Set(devicesIds);

      for (let deviceId of devicesSet) {
        let event = JSON.parse(JSON.stringify(output));
        event.metadata.deviceid = deviceId;

        this.kafkaMessenger.publish(this.subject, metadata.tenant, JSON.stringify(event));
      }
      logger.debug("... device was updated.", { filename: 'multi device out' });
      logger.debug("... multi-device-out node was successfully executed.", { filename: 'multi device out' });
      return Promise.resolve();
    } catch (error) {
      logger.debug("... multi-device-out node was not successfully executed.", { filename: 'multi device out' });
      logger.error(`Error while executing multi-device-out node: ${error}`, { filename: 'multi device out' });
      return Promise.reject(error);
    }
  }
}

module.exports = {Handler: DataHandler};
