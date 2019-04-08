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
var multi_actuate = require('./nodes/multi-actuate/multi_actuate').Handler;
var device_out = require('./nodes/device-out/device-out').Handler;
var notification = require('./nodes/notification/index').Handler;
var get_context = require('./nodes/get-context/get-context').Handler;
var dockerRemote = require('./nodes/dockerComposeRemoteNode/index').Handler;
var k8sRemote = require('./nodes/kubernetesRemoteNode/index').Handler;
var Publisher = require('./publisher');
var logger = require('./logger').logger;

var config = require("./config");
var MongoManager = require('./mongodb');

class NodeManager {
  constructor(engine, options) {
    this.nodes = {};
    this.collection = {};
    this.engine = engine;

    switch (engine) {
      case "docker":
        if (!options.socketPath) {
          logger.error(`Missing docker socket path configuration.`);
          throw new Error('Missing socketPath configuration');
        }
        this.socketPath = options.socketPath;
        if (!options.network) {
          logger.error(`Missing docker network configuration.`);
          throw new Error('Missing network configuration');
        }
        this.network = options.network;
      break;
      case "kubernetes":
        // for now there is not option for kubernetes
      break;
      default:
        throw new Error('invalid engine: ' + engine);
    }

    logger.debug('Node manager is using the ' + engine + ' engine');

  }

  startContainer(tenant) {
    this.collection[tenant].find().toArray()
      .then((values) => {
        values.forEach(item => {
          let newNode;
          if (config.deploy.engine === "docker") {
            newNode = new dockerRemote(item.image, tenant + item.id, this.socketPath, this.network);
          } else if (config.deploy.engine === "kubernetes") {
            newNode = new k8sRemote(item.image, tenant + item.id);
          }
          newNode.stats(item.target)
            .then(async () => {
              try {
                await newNode.remove(item.target);
                await newNode.create();
                await newNode.init();
                this.collection[tenant].updateOne({ id: item.id }, {
                  $set: {
                    target: newNode.serverAddress,
                  }
                });
                this.nodes[tenant][item.meta.name] = newNode;
                logger.debug(`... This image already up. Image: ${item.image}`);
              } catch (e) {
                logger.debug("... Failed to start a container.");
                this.collection[tenant].findOneAndDelete({ id: id });
                logger.debug("... remote node was successfully removed to the database.");
              }
            })
            .catch(() => {
              logger.debug(`...[remoteNode] container not up. Going up container...`);
              this.addRemote(item.image, item.id, tenant, false);
            });
        });
      })
  }

  createMongoConnection(tenant) {
    try {
      MongoManager.get().then((client) => {
        this.collection[tenant] = client.db(`flowbroker_${tenant}`).collection('remoteNode');
        this.startContainer(tenant);
      }).catch(() => {
        logger.debug("... impossible create a DB connection.");
      });
    } catch (error) {
      logger.debug(`... Something wasn't work with this error ${error}.`);
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
        "notification": new notification(
            kafkaMessenger, config.kafkaMessenger.dojot.subjects.notification, tenant),
        "device template in": new device_tpl(),
        "actuate": new actuate(
          new Publisher(kafkaMessenger, config.kafkaMessenger.dojot.subjects.devices, tenant)),
        "multi actuate": new multi_actuate(kafkaMessenger, config.kafkaMessenger.dojot.subjects.devices),
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
    const node = await this.collection[tenant].findOne({ id: id });
    let newNode = {};

    if (this.engine === "docker") {
      newNode = new dockerRemote(image, tenant + id, this.socketPath, this.network);
    } else if (this.engine === "kubernetes") {
      newNode = new k8sRemote(image, tenant + id);
    }
    if (node === null) {
      return new Promise(async (resolve, reject) => {
        if (newNode === undefined) {
          reject('Invalid node');
        } else {
          let continueStart = true;
          if (save) {
            let modelContainer = {};
            modelContainer.id = id;
            modelContainer.image = image;

            try {
              await this.collection[tenant].insertOne(modelContainer);
              logger.debug("... remote node was successfully inserted into the database.");
              continueStart = true;
            } catch (e) {
              continueStart = false;
              logger.debug(`... remote node was not inserted into the database. Error is ${e}`);
            }
          }
          if (continueStart === true) {
            newNode.create()
              .then(() => {
                newNode.init()
                  .then(() => {
                    let meta = newNode.getMetadata();
                    if (!(tenant in this.nodes)) {
                      this.nodes[tenant] = {};
                    }
                    this.nodes[tenant][meta.name] = newNode;
                    if (save) {
                      this.collection[tenant].updateOne({ id: id }, {
                        $set: {
                          target: newNode.serverAddress,
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
                    logger.debug(`... Invalid image`);
                    this.collection[tenant].findOneAndDelete({ id: id });
                    reject({ message: 'Invalid image' });
                  } else {
                    throw err
                  }
                } catch (e) {
                  logger.debug(`... Problem to start container. Reason: ${e}`);
                  this.collection[tenant].findOneAndDelete({ id: id });
                  reject({ message: 'Please, Try again.' });
                }
              });
          } else {
            logger.debug(`... Problem to save in database.`);
            reject({ message: 'Problem to save in database, please, Try again.' });
          }
        }
      })
    } else {
      logger.debug(`... This image already up. Image ${image}`);
      return Promise.reject(new Error(`... This image already up. Image: ${image}`));
    }
  }

  async delRemote(id, tenant) {
    const node = await this.collection[tenant].findOne({ id: id });
    if (node) {
      let newNode;
      if (this.engine === "docker") {
        newNode = new dockerRemote(node.image, tenant + id, this.socketPath, this.network);
      } else if (this.engine === "kubernetes") {
        newNode = new k8sRemote(node.image, tenant + id);
      }
      return Promise.resolve()
        .then(() => {
          if (!(tenant in this.nodes)) {
            throw "Tenant not found";
          }
          for (let n in this.nodes[tenant]) {
            if (n === id) {
              this.nodes[tenant][n].deinit();
              delete this.nodes[tenant][n];
            }
          }
          return newNode.remove(node.target)
            .then(() => {
              this.collection[tenant].findOneAndDelete({ id: id });
              logger.debug("... remote node was successfully removed to the database.");
            });
        });
    }
    throw new Error("No such node found");
  }
}

let options = {};
if (config.deploy.engine === "docker") {
  options.socketPath = config.deploy.docker.socketPath;
  options.network = config.deploy.docker.network;
}
let instance = new NodeManager(config.deploy.engine, options);

module.exports = { Manager: instance };
