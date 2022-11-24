/* jslint node: true */
"use strict";
var axios = require("axios");
var config = require('./config');
var auth = require('./auth');
const logger = require("@dojot/dojot-module-logger").logger;

/**
 * Client for REDIS database that implements a cache to the devices
 */
class DeviceCache {

  constructor(client) {
    this.client = client;
  }

  async populate(tenants) {
    let devices = {};
    let promises = [];

    for (let tenant of tenants) {
      promises.push(this._getAllDevices(tenant, 1, devices));
    }

    return Promise.all(promises).then(() => {
      if (Object.keys(devices).length === 0) {
        return Promise.resolve();
      }
      return this._writeDevicesInfo(devices);
    });
  }

  addDevice(creationEvent) {

    let deviceInfo = {
      "templates": creationEvent.data.templates,
      "staticAttrs": this._addStaticAttrs(creationEvent.data.attrs)
    };

    return this._writeDeviceInfo(creationEvent.metadata.tenant, creationEvent.data.id,
      deviceInfo);
  }

  /**
   * Deletes a given device from te cache. This function will be called
   * when the information stored on cache isn't the same from device-manager
   * anymore, i.e. when the device info of the device is updated.
   * @param {*} deviceid 
   * @param {*} tenant 
   */
  deleteDevice(tenant, deviceid) {
    logger.debug(`Will delete ${tenant + ":" + deviceid} from cache`, { filename: 'dev cache' });
    const key = tenant + ":" + deviceid;

    return this.client.del(key).then(() => {
        logger.debug(`${tenant + ":" + deviceid} deleted from cache`, { filename: 'dev cache' });
      }).catch((error) => {
        logger.error(error, { filename: 'dev cache' });
      });
  }

  /**
   * Returns device info of a device. Search for it on cache, if it's not, requests device manager
   * and then stores on cache.
   * @param {string} deviceid
   * @param {string} tenant 
   */
  getDeviceInfo(tenant, deviceid) {    
    if (this.client.status === 'ready') {
      return this.client.get(tenant + ":" + deviceid).then((data) => {

        if (data) {
          logger.debug(`retriving data related to ${tenant}:${deviceid} from cache`, { filename: 'dev cache' });
          return Promise.resolve(JSON.parse(data));
        }

        logger.debug(`failingback to retrieve data related to ${tenant}:${deviceid} from device-manager`, { filename: 'dev cache' });
        return this._requestDeviceInfo(tenant, deviceid);
      }).catch(() => {
        logger.debug(`[redis] Could not get from redis, will request to device manager`, { filename: 'dev cache' });
        return this._requestDeviceInfo(tenant, deviceid);
      });
    } else {
      return this._requestDeviceInfo(tenant, deviceid);
    }
    
  }

  /**
   * Requests device info to devicemanager.
   * @param {string} deviceid 
   * @param {string} tenant 
   */
  async _requestDeviceInfo(tenant, deviceid) {
    let tenantSession;
    let response;
    try {
      tenantSession = await auth.getSession(tenant);
      response = await axios.get(config.deviceManager.url + "/device/" + deviceid,
      {
        'headers': {
          'authorization': "Bearer " + tenantSession.getTokenSet().access_token,
        }
      });
      tenantSession.close()
    } catch (error) {
      tenantSession.close()
      logger.error(error);
      throw error;
    }

    let templates = [];
    for (let templateId of response.data.templates) {
      templates.push(templateId.toString());
    }

    let deviceInfo = {
      "templates": templates,
      "staticAttrs": this._addStaticAttrs(response.data.attrs)
    };
    if (this.client.status === 'ready') {
      return this._writeDeviceInfo(tenant, deviceid, deviceInfo).then(() => {
        tenantSession.close();
        return Promise.resolve(deviceInfo);
      });
    }

    return deviceInfo
  }

  /**
   * Stores list of templates retrieved from device-manager
   * @param  deviceid 
   * @param  tenant 
   * @param  templateList 
   */
  _writeDeviceInfo(tenant, deviceid, deviceInfo) {
    logger.debug(`storing device info on cache . . .`, { filename: 'dev cache' });
    const key = tenant + ":" + deviceid;
    return this.client.set(key, JSON.stringify(deviceInfo)).then(() => {
        logger.debug(`. . . device info stored successfully`, { filename: 'dev cache' });
        return Promise.resolve();
      }).catch((error) => {
        logger.error(`Failed to write device info into cache: ${error}`, { filename: 'dev cache' });
        return Promise.reject(error);
      });
  }

  _writeDevicesInfo(devices) {
    logger.debug(`storing devices info on cache . . .`, { filename: 'dev cache' });
    return this.client.mset(devices).then(() => {
      logger.debug(`. . . devices info stored successfully`, { filename: 'dev cache' });
      return Promise.resolve();
    }).catch((error) => {
      logger.error(`Failed to write devices indo into cache ${error} `, { filename: 'dev cache' });
      return Promise.reject(error);
    });
  }

  /**
   * Gets all static attrs of the device and puts it in an object that will be assigned
   * to a key to be stored on Redis
   * @param {object} attrs 
   */
  _addStaticAttrs(attrs) {
    let deviceStaticAtrrs = {};
    for (let template in attrs) {
      for (let attr of attrs[template]) {
        if ( (attr.type === 'static') && (attr.static_value) ) {          
          deviceStaticAtrrs[attr.label] = {
            value: attr.static_value,
            specialized: attr.specialized? true:false
          };
        }
      }
    }
    return deviceStaticAtrrs;
  }

  _getAllDevices(tenant, page, devices) {
    return new Promise( (resolve, reject) => {
      if (!page) {
        page = 1;
      }

      auth.getSession(tenant).then((tenantSession) => {
        axios.get(`${config.deviceManager.url}/device?page_num=${page}`,
          {
            'headers': {
              'authorization': "Bearer " + tenantSession.getTokenSet().access_token,
            }
          }
        ).then((response) => {
          for (let device of response.data.devices) {
            // this is only a hotfix, because the api returns templates as int instead string
            let templates = [];
            for (let templateId of device.templates) {
              templates.push(templateId.toString());
            }

            devices[`${tenant}:${device.id}`] = JSON.stringify({
              "templates": templates,
              "staticAttrs": this._addStaticAttrs(device.attrs)
            });
          }
          if (response.data.pagination.has_next) {
            return this._getAllDevices(tenant, response.data.pagination.next_page, devices).then(() => {
              return resolve();
            });
          } else {
            tenantSession.close();
            return resolve();
          }
        }).catch((error) => {
          logger.error(`Failed to retrieve the list of available devices: ${error}`, { filename: 'dev cache' });
          tenantSession.close();
          return reject(error);
        });
      });
    });
  }
}

module.exports = { DeviceCache };
