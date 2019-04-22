/* jslint node: true */
"use strict";
var axios = require("axios");
var config = require('./config');
var auth = require('./auth');

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
    console.log(`[redis] Will delete ${tenant + ":" + deviceid} from cache`);
    const key = tenant + ":" + deviceid;

    return this.client.del(key).then(() => {
        console.log(`[redis]${tenant + ":" + deviceid} deleted from cache`);
      }).catch((error) => {
        console.log(error);
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
          console.log(`retriving data related to ${tenant}:${deviceid} from cache`);
          return Promise.resolve(JSON.parse(data));
        }

        console.log(`failingback to retrieve data related to ${tenant}:${deviceid} from device-manager`);
        return this._requestDeviceInfo(tenant, deviceid);
      }).catch(() => {
        console.log(`[redis] Could not get from redis, will request to device manager`);
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
  _requestDeviceInfo(tenant, deviceid) {
    return axios.get(config.deviceManager.url + "/device/" + deviceid,
      {
        'headers': {
          'authorization': "Bearer " + auth.getToken(tenant)
        }
      }).then((response) => {

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
            return Promise.resolve(deviceInfo);
          });
        }
        return Promise.resolve(deviceInfo);
      }).catch((error) => {
        return Promise.reject(error);
      });
  }

  /**
   * Stores list of templates retrieved from device-manager
   * @param  deviceid 
   * @param  tenant 
   * @param  templateList 
   */
  _writeDeviceInfo(tenant, deviceid, deviceInfo) {
    console.log(`[redis] storing device info on cache . . .`);
    const key = tenant + ":" + deviceid;
    return this.client.set(key, JSON.stringify(deviceInfo)).then(() => {
        console.log(`[redis] . . . device info stored successfully`);
        return Promise.resolve();
      }).catch((error) => {
        console.log(error);
        return Promise.reject(error);
      });
  }

  _writeDevicesInfo(devices) {
    console.log(`[redis] storing devices info on cache . . .`);
    return this.client.mset(devices).then(() => {
      console.log(`[redis] . . . devices info stored successfully`);
      return Promise.resolve();
    }).catch((error) => {
      console.log(error);
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
      
      axios.get(`${config.deviceManager.url}/device?page_num=${page}`,
        {
          'headers': {
            'authorization': "Bearer " + auth.getToken(tenant)
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
          return resolve();
        }
      }).catch((error) => {
        console.error('Failed to retrieve the list of available devices: ', error);
        return reject(error);
      });
    });
  }
}

module.exports = { DeviceCache };
