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
   * Returns object with locale data (for the given locale)
   * @param  {[string]} locale Locale string, such as "en-US"
   * @return {[object]}        Locale settings used by the module
   */
  getLocaleData() {
    return {};
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

      let devicesIds = [];
      switch (config.device_source) {
        case 'configured':
          if ((config.devices_source_configured === undefined) ||
            (config.devices_source_configured.length === 0) ) {
            logger.debug("... device-out node was not successfully executed.");
            logger.error("There is not device configured to device out");
            return Promise.reject(new Error('Invalid Device id'));
          }
          devicesIds = config.devices_source_configured;
        break;
        case 'self':
          devicesIds.push(metadata.originatorDeviceId);
        break;
        case 'dynamic':
          if ((config.devices_source_dynamic === undefined) ||
            (config.devices_source_dynamic.length === 0)) {
            logger.debug("... device-out node was not successfully executed.");
            logger.error("Missing device source msg.");
            return Promise.reject(new Error('Invalid device source msg: field is mandatory'));
          }
          try {
            let devices = this._get(config.devices_source_dynamic, message);
            if (Array.isArray(devices)) {
              devicesIds = devices;
            } else {
              if (devices === undefined) {
                throw Error('devices is undefines');
              }
              devicesIds.push(devices);
            }
          } catch (error) {
            logger.debug("... device-out node was not successfully executed.");
            logger.error(`Error while executing device out node: ${error}`);
            return Promise.reject(error);
          }
        break;
        default:
          return Promise.reject(new Error('Invalid device source'));
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