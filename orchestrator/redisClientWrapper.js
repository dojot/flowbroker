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
   * Returns template list of a device. Search for it on cache, if it's not, requests device manager
   * and then stores on cache.
   * @param {string} deviceid
   * @param {string} tenant 
   * @param {string} redisState
   */
  getTemplateList(tenant, deviceid, redisState) {
    return new Promise((resolve, reject) => {
      if (redisState === 'Connected') {
        this.client.get(tenant + ":" + deviceid).then((data) => {

          if (data != null) {
            resolve(JSON.parse(data));
            return;
          }

          this.requestTemplateList(tenant, deviceid, resolve, reject, redisState);
        }).catch(() => {
          console.log(`[redis] Could not get from redis, will request to device manager`);
          this.requestTemplateList(tenant, deviceid, resolve, reject, redisState);
          return;
        });
      } else {
        this.requestTemplateList(tenant, deviceid, resolve, reject, redisState);
      }
    });
  }

  /**
   * Requests template list to devicemanager.
   * @param {string} deviceid 
   * @param {string} tenant 
   * @param {callback} resolve 
   * @param {callback} reject 
   */
  requestTemplateList(tenant, deviceid, resolve, reject, redisState) {
    axios.get(config.deviceManager.url + "/device/" + deviceid,
      {
        'headers': {
          'authorization': "Bearer " + auth.getToken(tenant)
        }
      }).then((response) => {

        if (redisState === 'Connected') {
          this.setTemplateList(tenant, deviceid, response.data.templates);
        }

        resolve({ "templates": response.data.templates });
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
  setTemplateList(tenant, deviceid, templateList) {
    console.log(`[redis] storing template list on cache . . .`);
    const key = tenant + ":" + deviceid;
    const value = { "templates": templateList };

    this.client.set(key, JSON.stringify(value)).then(() => {
      console.log(`[redis] . . . template list stored successfully`);
    }).catch((error) => {
      console.log(error);
    })
  }

  /**
   * Deletes a given device from te cache. This function will be called
   * when the information stored on cache isn't the same from device-manager
   * anymore, i.e. when the template list of the device is updated.
   * @param {*} deviceid 
   * @param {*} tenant 
   */
  deleteDevice(tenant, deviceid) {
    console.log(`[redis] Will delet ${tenant + ":" + deviceid} from cache`);
    const key = tenant + ":" + deviceid;
    this.client.del(key).then(() => {
      console.log(`[redis] Deleted from cache`);
    }).catch((error) => {
      console.log(error);
    });
  }
}

module.exports = { ClientWrapper };
