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

var logger = require("@dojot/dojot-module-logger").logger;

var config = require("./config");
var MongoManager = require('./mongodb');

const TAG={filename:"node-manager"};

class NodeManager {
  constructor() {
    this.nodes = {};
  }
  startContainer(tenant) {
    this.collection.find().toArray()
      .then((values) => {
        values.forEach(item => {
          let newNode;
          if (config.deploy.engine === "docker") {
            newNode = new dockerRemote(item.image, tenant + item.id);
          } else if (config.deploy.engine === "kubernetes") {
            newNode = new k8sRemote(item.image, tenant + item.id);
          }
          newNode.stats(item.target)
            .then(() => {
                logger.debug(`...[remoteNode] container already up with id ${item.target}.`, TAG);
              })
            .catch(() => {
                logger.debug(`...[remoteNode] container not up. Going up container...`, TAG);
                this.addRemote(item.image, item.id, tenant, false);
              });
        });
      })
  }

  createMongoConnection(tenant) {
    logger.debug("Creating a new connection with Mongo...", TAG);
    try {
      MongoManager.get().then((client) => {
        this.collection = client.db(`flowbroker_${tenant}`).collection('remoteNode');
        this.startContainer(tenant);
      }).catch(() => {
          logger.debug("... impossible create a DB connection.", TAG);
        });
    } catch (error) {
      logger.debug(`... could not connect to Mongo.`);
      logger.error(`Could not connect to Mongo: ${error}`);
    }
  }

  addTenant(tenant, kafkaMessenger) {
    this.createMongoConnection(tenant);
    this.nodes[tenant] = {
      "change": new change(),
      "email": new email(),
      "geofence": new geo(),
      "http": new http(),
      "switch": new select(),
      "template": new template(),
      "device in": new device_in(),
      "device out": new device_out(
        new Publisher(kafkaMessenger, config.kafkaMessenger.dojot.subjects.deviceData, tenant)),
      "device template in": new device_tpl(),
      "actuate": new actuate(
        new Publisher(kafkaMessenger, config.kafkaMessenger.dojot.subjects.devices, tenant)),
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
    logger.debug(`Getting HTML for tenant ${tenant}`, {filename:"node-manager"}, TAG);
    let result = "";
    if (!(tenant in this.nodes)) {
      logger.debug("Could not find nodes for this tenant", {filename:"node-manager"}, TAG);
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
      return new Promise(async (resolve, reject) => {
        let newNode, modelContainer = {};

        if (config.deploy.engine === "docker") {
          newNode = new dockerRemote(image, tenant + id);
        } else if (config.deploy.engine === "kubernetes") {
          newNode = new k8sRemote(image, tenant + id);
        }

        if (newNode === undefined) {
          reject('Invalid node');
        } else {
          let continueStart = true;
          if (save) {
            modelContainer.id = id;
            modelContainer.image = image;

            try {
              await this.collection.insertOne(modelContainer);
              logger.debug("... remote node was successfully inserted into the database.", TAG);
              continueStart = true;
            } catch (e) {
              continueStart = false;
              logger.debug(`... remote node was not inserted into the database. Error is ${e}`, TAG);
            }
          }
          if (continueStart === true) {
            newNode.create()
            .then(() => {
              newNode.init()
                .then(() => {
                  let meta = newNode.getMetadata();
                  console.log('[nodes] container meta', JSON.stringify(meta));
                  if (!(tenant in this.nodes)) {
                    this.nodes[tenant] = {};
                  }
                  this.nodes[tenant][meta.name] = newNode;
                  if (save) {
                    this.collection.updateOne({ id: id }, {
                      $set: {
                        target: newNode.target,
                        meta: meta,
                      }
                    });
                  }
                  resolve();
                });
            })
            .catch((err) => {
              try {
                if (err.response.statusCode === 404) {
                  logger.debug(`... Invalid image`, TAG);
                  this.collection.findOneAndDelete({ id: id });
                  reject({ message: 'Invalid image' });
                } else {
                  throw err
                }
              } catch(e) {
                logger.debug(`... Problem to start container. Reason: ${e}`, TAG);
                this.collection.findOneAndDelete({ id: id });
                reject({ message: 'Please, Try again.' });
              }
            });
          } else {
            logger.debug(`... Problem to save in database.`, TAG);
            reject({ message: 'Problem to save in database, please, Try again.' });
          }
        }
      })
    } else {
      logger.debug(`... This image already up. Image: ${image}`, TAG);
      return Promise.reject(new Error(`... This image already up. Image: ${image}`));
    }
  }

  async delRemote(id, tenant) {
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
          for (let n in this.nodes[tenant]) {
            if (n === id) {
              delete this.nodes[tenant][n];
            }
          }
          return newNode.remove(node.target)
            .then(() => {
              this.collection.findOneAndDelete({ id: id });
              logger.debug("... remote node was successfully removed to the database.", TAG);
            });
        });
    }
    throw new Error("No such node found");
  }
}

module.exports = { Manager: new NodeManager() };
