"use strict";

const fs = require('fs');

const change = require('./nodes/change/index').Handler;
//disable email node for now
//const email = require('./nodes/email/index').Handler;
const geo = require('./nodes/geo/index').Handler;
const http = require('./nodes/http/index').Handler;
const ftp = require('./nodes/ftp/index').Handler;
const select = require('./nodes/switch/index').Handler;
const template = require('./nodes/template/index').Handler;
const device_in = require('./nodes/device-in/device-in').Handler;
const event_device_in = require('./nodes/event-device-in/event-device-in').Handler;
const event_template_in = require('./nodes/event-template-in/event-template-in').Handler;
const template_in = require('./nodes/template-in/template-in').Handler;
const actuate = require('./nodes/actuate/actuate').Handler;
const multi_actuate = require('./nodes/multi-actuate/multi_actuate').Handler;
const device_out = require('./nodes/device-out/device-out').Handler;
const multi_device_out = require('./nodes/multi-device-out/multi-device-out').Handler;
const publish_ftp = require('./nodes/publish-ftp/index').Handler;
const notification = require('./nodes/notification/index').Handler;
const get_context = require('./nodes/get-context/get-context').Handler;
const cron = require('./nodes/cron/cron').Handler;
const cron_batch = require('./nodes/cron-batch/cron-batch').Handler;
const dockerRemote = require('./nodes/dockerComposeRemoteNode/index').Handler;
const k8sRemote = require('./nodes/kubernetesRemoteNode/index').Handler;
const cumulative_sum = require('./nodes/cumulative-sum/cumulative-sum').Handler;
const merge_data = require('./nodes/merge-data/merge-data').Handler;
const Publisher = require('./publisher');
const logger = require("@dojot/dojot-module-logger").logger;

const config = require("./config");
const MongoManager = require('./mongodb');

const TAG = { filename: 'nodeMngr' };

class NodeManager {

  /**
   * Cosntructor
   * @param {*} engine docker container manager (docker or kubernetes)
   * @param {*} options
   */
  constructor(engine, options) {
    // processing nodes (by tenant)
    this.nodes = {};
    // mongodb collections for persisting remote nodes' metadata (by tenant)
    this.collection = {};
    // engine: docker or kubernetes
    this.engine = engine;

    switch (engine) {
      case "docker":
        if (!options.socketPath) {
          logger.error(`Missing docker socket path configuration.`, TAG);
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

    logger.debug(`aaNode manager is using the ${engine} engine`, TAG);
  }

  /**
   * Creates a mongodb collection for persinting remote node configurations (promise).
   *
   * @param {*} tenant identifier of the tenant.
   */
  _createMongoDBCollection(tenant) {
    return MongoManager.get().then((client) => {
      let collection = client.db(`flowbroker_${tenant}`).collection('remoteNode');
      return collection;
    }).catch(() => {
      throw new Error(`Failed to create mongoDB collection for tenant ${tenant}.`);
    });
  }

  /**
   * Loads remote nodes for the given tenant.
   *
   * @param {*} tenant identifier of the tenant.
   */
  _loadRemoteNodes(tenant) {
    return new Promise((resolve, reject) => {
      logger.debug(`Loading remote nodes for tenant ${tenant} ...`, TAG);
      this.collection[tenant].find().toArray()
        .then((values) => {
          values.forEach(async (item) => {
            logger.debug(`Loading remote node ${JSON.stringify(item)}.`, TAG);
            let node;
            if (config.deploy.engine === "docker") {
              node = new dockerRemote(item.image, tenant + item.id,
                this.socketPath, this.network, item.containerId);
            }
            else if (config.deploy.engine === "kubernetes") {
              node = new k8sRemote(item.image, tenant + item.id);
            }

            if (!node) {
              return reject(new Error('Failed to instantiate handler for remote node ${item.id}.'));
            }

            //Note: The current implementation is very naive, it tries to remove/create
            //      existing remote nodes. Nevertheless, the most appropriate solution is to handle
            //      them according to the status of their containers. This demands changes
            //      in the docker-compose and kubernetes libraries.
            node.deinit();
            if (config.deploy.engine === "docker") {
              try {
                logger.debug(`Trying to remove docker container ${item.containerId}`, TAG);
                await node.remove(item.containerId);
                logger.debug(`Succeeded to remove container.`, TAG);
              }
              catch (error) {
                logger.error(`Failed to remove container (${JSON.stringify(error)}). Keep going ...`, TAG);
              }
            }

            // re-create container
            let containerId;
            try {
              containerId = await node.create();
              await node.init();
              // update map
              this.nodes[tenant][item.id] = node;
              //update database
              await this.collection[tenant].updateOne({ _id: item._id },
                { $set: { containerId: containerId } });
            }
            catch (error) {
              logger.error(`Failed to load remote node ${tenant}/${item.id} (${JSON.stringify(error)})`, TAG);
              // rollback
              if (containerId) {
                try {
                  await this.delRemoteNode(containerId,tenant);
                }
                catch (error) {
                  logger.error(`(Rollback) Failed to remove remote node ${tenant}/${item.id} (${error}). keep going ..`, TAG);
                }
              }
              return reject(new Error(`Failed to load remote node ${tenant}/${item.id}.`));
            }
          });
          logger.debug(`...Loaded remote nodes for tenant ${tenant}.`, TAG);
          return resolve();
        }).catch((error) => {
          logger.error(`Failed to get remote nodes from database ${error}`, TAG);
          return reject(new Error('Failed to get remote nodes from database.'));
        });
    });
  }

  getAll(tenant) {
    return new Promise((resolve, reject) => {
      try {
        resolve(this.collection[tenant].find().toArray());
      } catch (e) {
        reject(e);
      }
    });
  }


  /**
   * Sets the manager to handle processing nodes for the given tenant
   * @param {*} tenant identifier of the tenant.
   * @param {*} kafkaMessenger instance of dojot kafka messenger. Required for some types of nodes.
   */
  addTenant(tenant, kafkaMessenger) {
    return new Promise((resolve, reject) => {
      this._createMongoDBCollection(tenant).then((collection) => {

        this.collection[tenant] = collection;

        // load remote nodes from database ...
        this._loadRemoteNodes(tenant).then(() => {
          // local nodes
          this.nodes[tenant] = {
            "change": new change(),
            //disable email node for now
            //"email": new email(),
            "geofence": new geo(),
            "http": new http(),
            "ftp": new ftp(),
            "switch": new select(),
            "template": new template(),
            "event device in": new event_device_in(),
            "device in": new device_in(),
            "device out": new device_out(
              new Publisher(kafkaMessenger, config.kafkaMessenger.dojot.subjects.deviceData, tenant)),
            "multi device out": new multi_device_out(kafkaMessenger, config.kafkaMessenger.dojot.subjects.deviceData),
            "publish-ftp": new publish_ftp(kafkaMessenger, config.kafkaMessenger.dojot.subjects.ftp),
            "notification": new notification(kafkaMessenger, config.kafkaMessenger.dojot.subjects.notification, tenant),
            "event template in": new event_template_in(),
            "device template in": new template_in(),
            "actuate": new actuate(
              new Publisher(kafkaMessenger, config.kafkaMessenger.dojot.subjects.devices, tenant)),
            "multi actuate": new multi_actuate(kafkaMessenger, config.kafkaMessenger.dojot.subjects.devices),
            "get context": new get_context(),
            "cron": new cron(),
            "cron-batch": new cron_batch(),
            "cumulative sum": new cumulative_sum(),
            "merge data": new merge_data(),
          };

          logger.debug(`Succeeded to set manager to handle processing nodes for tenant ${tenant}`, TAG);
          return resolve();
        }).catch((error) => {
          logger.error(`Failed to load remote nodes (${error})`, TAG);
          return reject(new Error('Failed to load remote nodes.'));
        });
      }).catch(error => {
        logger.error(`Failed to create mongodb collection (${error}).`, TAG);
        return reject(new Error('Failed to create mongodb collection.'));
      });
    });
  }

  /**
   * This method instantiates a remote node (promise).
   *
   * @param {*} image a docker image available to download from a docker registry.
   * @param {*} id identifier of the remote node must be equal to the name value in the metadata.
   * @param {*} tenant identifier of the tenant.
   */
  addRemoteNode(image, id, tenant) {
    return new Promise((resolve, reject) => {

      // Step 1: Checks if the 'remote node' exists
      if (this.nodes.hasOwnProperty(tenant)) {
        if (this.nodes[tenant].hasOwnProperty(id)) {
          return reject(new Error(`A remote node with id ${id} already exists.`));
        }
      }
      else {
        return reject(new Error(`Tenant ${tenant} has not been initialized.`));
      }

      // Step 2: Create the remote node
      let node;
      if (this.engine === "docker") {
        node = new dockerRemote(image, tenant + id, this.socketPath, this.network);
      }
      else if (this.engine === "kubernetes") {
        node = new k8sRemote(image, tenant + id);
      }

      if (node) {
        node.create().then((containerId) => {
          node.init().then(() => {

            let metadata = node.getMetadata();
            if (id !== metadata.name) {
              this.delRemoteNode(id,tenant).catch((error) => {
                logger.error(`Failed to remove remote node
                ${tenant}/${id} (${error}). keep going ..`, TAG);
              });
              return reject(new Error(`The remote node id (${id}) differs from its name (${metadata.name}).`));
            }

	    this.nodes[tenant][id] = node;

            // Step 3: Persist remote node
            let nodeDbEntry = {
              id: id,
              image: image,
              containerId: containerId,
              metadata: metadata
            }
            this.collection[tenant].insertOne(nodeDbEntry).then(() => {
              logger.debug(`Succeeded to add remote node with id ${id}`, TAG);
              resolve();
            }).catch((error) => {
              this.delRemoteNode(containerId).catch((error) => {
                logger.error(`Failed to remove remote node
                ${tenant}/${id} (${error}). keep going ..`, TAG);
              });
              logger.error(`Failed to persist configuration for
              remote node ${tenant}/${id} (${error}).`, TAG);
              return reject(new Error(`Failed to persist remote node configuration.`));
            });
          }).catch((error) => {
            this.delRemoteNode(containerId).catch((error) => {
              logger.error(`Failed to remove remote node
              ${tenant}/${id} (${error}). keep going ..`, TAG);
            });
            logger.error(`Failed to initiate docker container for
            remote node ${tenant}/${id} (${error}).`, TAG);
            return reject(new Error('Failed to initiate docker container.'));
          });
        }).catch((error) => {
          logger.error(`Failed to create docker container for
          remote node ${tenant}/${id} (${JSON.stringify(error)}).`, TAG);
          return reject(new Error('Failed to create docker container.'));
        });
      }
      else {
        return reject(new Error('Failed to instantiate remote node.'));
      }
    });
  }

  /**
   * This method removes a remote node (promise).
   *
   * @param {*} id identifier of the remote node.
   * @param {*} tenant identifier of the tenant.
   */
  delRemoteNode(id, tenant) {
    return new Promise(async (resolve, reject) => {

      // Step 1: Checks if the 'remote node' exists
      if (this.collection.hasOwnProperty(tenant)) {
        if (this.nodes[tenant].hasOwnProperty(id)) {

          // Step 2: Remove docker container
          let node = this.nodes[tenant][id];
          node.deinit();
          try {
            logger.debug(`Trying to remove docker container ${node.containerId}`, TAG);
            await node.remove(node.containerId);
            logger.debug(`Succeeded to remove container.`, TAG);
          }
          catch (error) {
            logger.error(`Failed to remove container (${JSON.stringify(error)}). Keep going ...`, TAG);
          }
          finally {
            delete this.nodes[tenant][id];
            // Step 3: Remove remote node configuration from database
            this.collection[tenant].findOneAndDelete({ id: id }).then(() => {
              logger.debug(`Succeeded to delete remote node with id ${id} for tenant ${tenant}.`, TAG);
              return resolve();
            }).catch((error) => {
              logger.error(`Failed to remove configuration from database
              for remote node ${temant}/${id} (${error}).`, TAG);
              return reject(new Error('Failed to remove remote node configuration from database.'));
            });
          }
        }
        else {
          return reject(new Error(`Not found remote node with id ${id}.`));
        }
      }
      else {
        return reject(new Error(`Tenant ${tenant} has not been initialized.`));
      }
    });
  }

  /**
   * Gets remote nodes representation (JSON).
   * @param {*} tenant identifier of the tenant.
   */
  asJson(tenant) {
    let result = [];
    if (this.nodes.hasOwnProperty(tenant)) {
      for (const id of Object.keys(this.nodes[tenant])) {
        let metadata = this.nodes[tenant][id].getMetadata();
        metadata.enabled = true;
        metadata.local = true;
        metadata.types = [metadata.name];
        result.push(metadata);
      }
    }
    return result;
  }

  /**
   * Gets remote nodes representation (HTML).
   * @param {*} tenant identifier of the tenant.
   */
  asHtml(tenant) {
    let result = "";
    if (this.nodes.hasOwnProperty(tenant)) {
      for (const id of Object.keys(this.nodes[tenant])) {
        let data = fs.readFileSync(this.nodes[tenant][id].getNodeRepresentationPath());
        result = result + '\n' + data;
      }
    }
    return result;
  }

  /**
   * Gets node.
   *
   * @param {*} id identifier of the remote node.
   * @param {*} tenant identifier of the tenant.
   */
  getNode(id, tenant) {
    let node = null;
    if (this.nodes.hasOwnProperty(tenant)) {
      if (this.nodes[tenant].hasOwnProperty(id)) {
        node = this.nodes[tenant][id];
      }
    }
    return node;
  }

}

let options = {};
if (config.deploy.engine === "docker") {
  options.socketPath = config.deploy.docker.socketPath;
  options.network = config.deploy.docker.network;
}
let instance = new NodeManager(config.deploy.engine, options);

module.exports = { Manager: instance };
