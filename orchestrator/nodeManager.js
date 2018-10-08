"use strict";

var fs = require('fs');

var change = require('./nodes/change/index').Handler;
var email = require('./nodes/email/index').Handler;
var geo = require('./nodes/geo/index').Handler;
var http = require('./nodes/http/index').Handler;
var select = require('./nodes/switch/index').Handler;
var template = require('./nodes/template/index').Handler;
var device_in = require('./nodes/device-in/device-in').Handler;
var device_tpl = require('./nodes/template-in/template-in').Handler;
var actuate = require('./nodes/actuate/actuate').Handler;
var device_out = require('./nodes/device-out/device-out').Handler;
var get_context = require('./nodes/get-context/get-context').Handler;
var dockerRemote = require('./nodes/dockerComposeRemoteNode/index').Handler;
var k8sRemote = require('./nodes/kubernetesRemoteNode/index').Handler;
var Publisher = require('./publisher');
var logger = require('./logger').logger;

var config = require("./config");

var dojotModule = require("@dojot/dojot-module");
var dojotConfig = dojotModule.Config;

class NodeManager {
  constructor() {
    this.nodes = {};
  }

  addTenant(tenant, kafka) {
    this.nodes[tenant] = {
      "change": new change(),
      "email": new email(),
      "geofence": new geo(),
      "http": new http(),
      "switch": new select(),
      "template": new template(),
      "device in": new device_in(),
      "device out": new device_out(
        new Publisher(kafka, dojotConfig.dojot.subjects.deviceData, tenant)),
      "device template in": new device_tpl(),
      "actuate": new actuate(
        new Publisher(kafka, dojotConfig.dojot.subjects.devices, tenant)),
      "get context": new get_context(),
    };
  }

  asJson(tenant) {
    let result = [];
    if (!(tenant in this.nodes)) {
      return result;
    }

    for (let node in this.nodes[tenant]) {
      if (this.nodes[tenant].hasOwnProperty(node)) {
        let data = this.nodes[tenant][node].getMetadata();
        data.enabled = true;
        data.local = true;
        data.types = [data.name];
        result.push(data);
      }
    }
    return result;
  }

  asHtml(tenant) {
    logger.debug(`Getting HTML for tenant ${tenant}`);
    let result = "";
    if (!(tenant in this.nodes)) {
      logger.debug("Could not find nodes for this tenant");
      return "";
    }

    for (let node in this.nodes[tenant]) {
      if (this.nodes[tenant].hasOwnProperty(node)) {
        let data = fs.readFileSync(this.nodes[tenant][node].getNodeRepresentationPath());
        result = result + '\n' + data;
      }
    }
    return result;
  }

  getNode(type, tenant) {
    if (!(tenant in this.nodes)) {
      return null;
    }
    return this.nodes[tenant][type];
  }

  addRemote(image, id, tenant) {
    return Promise.resolve()
      .then(() => {
        let newNode;
    
        if (config.deploy.engine === "docker") {
          newNode = new dockerRemote(image, tenant + id);
        } else if (config.deploy.engine === "kubernetes") {
          newNode = new k8sRemote(image, tenant + id);
        }
    
        if (newNode === undefined) {
          return;
        }
    
        return newNode
          .create()
          .then(() => newNode.init())
          .then(() => {
            let meta = newNode.getMetadata();
            console.log('[nodes] container meta', JSON.stringify(meta));
            if (!(tenant in this.nodes)) {
              this.nodes[tenant] = {};
            }
            this.nodes[tenant][meta.name] = newNode;
          });
      });
  }

  delRemote(image, id, tenant) {
    return Promise.resolve()
      .then(() => {
        if (!(tenant in this.nodes)) {
          throw "Tenant not found";
        }
  
        for (let n in this.nodes[tenant]) {
          if (n === id) {
            return this.nodes[tenant][n]
              .remove()
              .then(() => {
                delete this.nodes[tenant][n];
              });
          }
        }
  
        throw new Error("No such node found");
      });
  }
}

module.exports = { Manager: new NodeManager() };
