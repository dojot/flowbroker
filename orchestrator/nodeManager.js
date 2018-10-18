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

var MongoManager = require('./mongodb');

class NodeManager {
  constructor() {
    this.nodes = {};
  }

  upContainers(tenant) {
    this.collection.find().toArray()
      .then((values) => {
        values.forEach(item => {
          this.addRemote(item.image, item.id, tenant, false);
        });
      })
  }

  mongoConnection(tenant) {
    try {
      MongoManager.get().then((client) => {
        this.collection = client.db(`flowbroker_${tenant}`).collection('remoteNode');
        this.upContainers(tenant);
      }).catch((error) => {
        logger.debug("... impossible create a DB connection.");
      });
    } catch (error) {
      logger.debug(`... Something wasn't work with this error ${error}.`);
    }
  }

  addTenant(tenant, kafka) {
    this.mongoConnection(tenant);
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

  async addRemote(image, id, tenant, save = true) {
    const node = await this.collection.findOne({ id: id });
    if (node === null) {
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
              let modelContainer = {};
              modelContainer.id = id;
              modelContainer.image = image;
              modelContainer.target = newNode.target;
              modelContainer.meta = meta;
              if (save) {
                this.collection.insert(modelContainer).then(() => {
                  logger.debug("... remote node was successfully inserted into the database.");
                }).catch((error) => {
                  logger.debug(`... remote node was not inserted into the database. Error is ${error}`);
                });
              }
            });
        });
    } else {
      logger.debug(`... This image already up. Image: ${image}`);
      return Promise.reject(new Error(`... This image already up. Image: ${image}`));
    }
  }

  async delRemote(image, id, tenant) {
    const node = await this.collection.findOne({ id: id });
    if (node) {
      let newNode;
      if (config.deploy.engine === "docker") {
        newNode = new dockerRemote(node.image, tenant + id);
      } else if (config.deploy.engine === "kubernetes") {
        newNode = new k8sRemote(node.image, tenant + id);
      }
      return Promise.resolve()
        .then(() => {
          if (!(tenant in this.nodes)) {
            throw "Tenant not found";
          }
          return newNode.remove(node.target)
            .then(() => {
              this.collection.findOneAndDelete({ id: id });
              logger.debug("... remote node was successfully removed to the database.");
            });
        });
    }
    throw new Error("No such node found");
  }
}

module.exports = { Manager: new NodeManager() };
