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
   * @param deviceid 
   */

  getTemplateList(deviceid, tenant) {
    return new Promise((resolve, reject) => {
      this.client.get(deviceid + ":" + tenant, (error, data) => {
        if (error) {
          reject(error);
          return;
        }

        if (data != null) {
          resolve(JSON.parse(data));
          return;
        }

        axios.get(config.deviceManager.url + "/device/" + deviceid,
          {
            'headers': {
              'authorization': "Bearer " + auth.getToken(tenant)
            }
          }).then((response) => {
            this.setTemplateList(deviceid, tenant, response.data.templates);
            resolve({ "templates": response.data.templates });
            return;
          }).catch((error) => {
            reject(error);
            return;
          })
      });
    });
  }
  /**
   * Stores list of templates retrieved from device-manager
   * @param  deviceid 
   * @param  tenant 
   * @param  templateList 
   */
  setTemplateList(deviceid, tenant, templateList) {
    console.log(`[redis] storing template list on cache . . .`);
    const key = deviceid + ":" + tenant;
    const value = { "templates": templateList };
    this.client.set(key, JSON.stringify(value));
    console.log(`[redis] . . . template list stored successfully`);
  }
  /**
   * Deletes a given device from te cache. This function will be called
   * when the information stored on cache isn't the same from device-manager
   * anymore, i.e. when the template list of the device is updated.
   * @param {*} deviceid 
   * @param {*} tenant 
   */
  deleteDevice(deviceid, tenant){
    console.log(`[redis] Will delet ${deviceid + ":" + tenant} from cache`);
    const key = deviceid + ":" + tenant;    
    this.client.del(key);
  }
}

module.exports = { ClientWrapper };
