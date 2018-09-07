/* jslint node: true */
"use strict";
var axios = require("axios");
var config = require('./config');
var auth = require('./auth');

/**
 * Client for REDIS database
 */
class ClientWrapper {

  constructor(client) {
    this.client = client;
  }

  /**
   * Returns device info of a device. Search for it on cache, if it's not, requests device manager
   * and then stores on cache.
   * @param {string} deviceid
   * @param {string} tenant
   * @param {string} redisState
   */
  getDeviceInfo(tenant, deviceid, redisState) {
    return new Promise((resolve, reject) => {
      if (redisState === 'Connected') {
        this.client.get(tenant + ":" + deviceid).then((data) => {

          if (data != null) {
            resolve(JSON.parse(data));
            return;
          }

          this.requestDeviceInfo(tenant, deviceid, resolve, reject, redisState);
        }).catch(() => {
          console.log(`[redis] Could not get from redis, will request to device manager`);
          this.requestDeviceInfo(tenant, deviceid, resolve, reject, redisState);
          return;
        });
      } else {
        this.requestDeviceInfo(tenant, deviceid, resolve, reject, redisState);
      }
    });
  }

  /**
   * Requests device info to devicemanager.
   * @param {string} deviceid
   * @param {string} tenant
   * @param {callback} resolve
   * @param {callback} reject
   */
  requestDeviceInfo(tenant, deviceid, resolve, reject, redisState) {
    axios.get(config.deviceManager.url + "/device/" + deviceid,
      {
        'headers': {
          'authorization': "Bearer " + auth.getToken(tenant)
        }
      }).then((response) => {
        let deviceInfo = { "templates": response.data.templates, "staticAttrs": this.addStaticAttrs(response.data.attrs) };
        if (redisState === 'Connected') {
          this.setDeviceInfo(tenant, deviceid, deviceInfo);
        }
        resolve(deviceInfo);
        return;
      }).catch((error) => {
        reject(error);
        return;
      });
  }

  /**
   * Stores list of templates retrieved from device-manager
   * @param  deviceid
   * @param  tenant
   * @param  templateList
   */
  setDeviceInfo(tenant, deviceid, deviceInfo) {
    console.log(`[redis] storing device info on cache . . .`);
    const key = tenant + ":" + deviceid;

    this.client.set(key, JSON.stringify(deviceInfo)).then(() => {
      console.log(`[redis] . . . device info stored successfully`);
    }).catch((error) => {
      console.log(error);
    })
  }

  /**
   * Deletes a given device from te cache. This function will be called
   * when the information stored on cache isn't the same from device-manager
   * anymore, i.e. when the device info of the device is updated.
   * @param {*} deviceid
   * @param {*} tenant
   */
  deleteDevice(tenant, deviceid) {
    console.log(`[redis] Will delet ${tenant + ":" + deviceid} from cache`);
    const key = tenant + ":" + deviceid;
    this.client.del(key).then(() => {
      console.log(`[redis]${tenant + ":" + deviceid} deleted from cache`);
    }).catch((error) => {
      console.log(error);
    });
  }

  /**
   * Gets all static attrs of the device and puts it in an object that will be assigned
   * to a key to be stored on Redis
   * @param {object} attrs
   */
  addStaticAttrs(attrs) {
    let deviceStaticAtrrs = {};
    for (let template in attrs) {
      attrs[template].forEach(attr => {
        if (attr.type === 'static') {
          if (attr.value_type === 'float' || attr.value_type === 'integer') {
            deviceStaticAtrrs[attr.label] = Number(attr.static_value);
          } else {
            deviceStaticAtrrs[attr.label] = attr.static_value;
          }
        }
      });
    }
    return deviceStaticAtrrs;
  }
}

module.exports = { ClientWrapper };
