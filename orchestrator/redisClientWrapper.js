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
      this.client.get(deviceid, (error, data) => {
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
            this.setTemplateList(deviceid, response.data.templates);
            resolve({ "templates": response.data.templates });
            return;
          }).catch((error) => {
            reject(error);
            return;
          })
      });
    });
  }

  setTemplateList(deviceid, templateList) {
    console.log(`[redis] storing template list on cache . . .`);
    const key = { "templates": templateList };
    this.client.set(deviceid, JSON.stringify(key));
    console.log(`[redis] . . . template list stored successfully`);
  }

}

module.exports = { ClientWrapper };
