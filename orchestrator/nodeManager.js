"use strict";

var fs = require('fs');
var util = require('util');
var uuid = require('uuid/v4');

// This should be external - but since it's bugged....
var docker = require('./docker/harbor-master');

var dojot = require('@dojot/flow-node');
var dispatcher = require('./dispatcher');

var change = require('./nodes/change/index').Handler;
var edge = require('./nodes/edge/index').Handler;
var email = require('./nodes/email/index').Handler;
var geo = require('./nodes/geo/index').Handler;
var http = require('./nodes/http/index').Handler;
var select = require('./nodes/switch/index').Handler;
var template = require('./nodes/template/index').Handler;
var device_in = require('./nodes/device-in/device-in').Handler;
var device_tpl = require('./nodes/template-in/template-in').Handler;

var device_out = require('./nodes/device-out/device-out').Handler;
var publisher = require('./publisher');

function makeId(length) {
  var text = "";
  var possible = "abcdef0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

class RemoteNode extends dojot.DataHandlerBase {
  constructor(image, id) {
    super();
    this.info = {
      userid: id,
      image: image,
      enabled: false
    }

    // TODO: socket path should be configurable
    this.client = docker.Client({ socket: '/var/run/docker.sock' });
  }

  getNetwork() {
    return new Promise((resolve, reject) => {
      if (this.targetNetwork) {
        return resolve(this.targetNetwork);
      }

      this.client.networks().list().then((results) => {
        for (let result of results) {
          let name = result.Name.match(/.+?_flowbroker/);
          if (name) {
            this.targetNetwork = name;
            return resolve(name);
          }
        }
      }).catch((error) => {
        console.error("failed to acquire target network", error);
      })
    })
  }

  create() {
    return new Promise((resolve, reject) => {
      let model = {
        Image: this.info.image,
        AttachStdin: false,
        AttachStdout: false,
        AttachStderr: true,
        NetworkDisabled: false,
        HostConfig: {
          AutoRemove: true
        },
        Tty: true
      };

      const options = { name: 'flowbroker.' + makeId(7) };
      const imageOptions = { fromImage: this.info.image };
      this.client.images().create(imageOptions).then((image) => {
        console.log(`[nodes] image ${this.info.image} created`, image);
        this.client.containers().create(model, options).then((container) => {
          console.log(`[nodes] container ${options.name} was created`);
          this.client.containers().start(container.Id).then((result) => {
            // TODO alias config is not working
            const network_opt = {
              Container: container.Id
            };
            this.info.container = container.Id;
            this.target = container.Id.substr(0,12);
            this.getNetwork().then((network) => {
              this.client.networks().connect(network, network_opt).then((result) => {
                console.log(`[nodes] container up: ${options.name}:${container.Id}`);
                return resolve();
              }).catch((error) => {
                this.remove();
                return reject(error);
              })
            })
          }).catch((error) => {
            this.remove();
            return reject(new Error(error.body.message));
          })
        }).catch((error) => {
          return reject(error);
        })
      }).catch((error) => {
        return reject(error);
      })
    });
  }

  remove() {
    return new Promise((resolve, reject) => {
      this.client.containers().remove(this.info.container, {force: true}).then((results) => {
        return resolve();
      }).catch((error) => {
        return reject(error);
      })
    })
  }

  update() {
    // TODO
  }

  init() {
    // Fetch all meta information from newly created remote impl
    return new Promise((resolve, reject) => {
      dispatcher(this.target, {command: 'metadata'}).then((meta) => {
        this.metadata = meta.payload;
        dispatcher(this.target, { command: 'html' }).then((html) => {
          this.html = '/tmp/' + this.remote;
          fs.writeFileSync(this.html, html.payload);
          dispatcher(this.target, { command: 'locale', locale: 'en-US' }).then((reply) => {
            this.locale = reply.payload;
            return resolve();
          }).catch((error) => { return reject(error); });
        }).catch((error) => { return reject(error); });
      }).catch((error) => { return reject(error); });
    });
  }

  getNodeRepresentationPath() {
    return this.html;
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return this.metadata;
  }

  /**
   * Returns object with locale data (for the given locale)
   * @param  {[string]} locale Locale string, such as "en-US"
   * @return {[object]}        Locale settings used by the module
   */
  getLocaleData(locale) {
    return this.locale;
  }

  handleMessage(config, message, callback, tenant) {
    // invoke remote
    let command = {
      command: 'message',
      message: message,
      config: config,
    };
    dispatcher(this.target, command).then((reply) => {
      if (reply.error) {
        return callback(reply.error);
      }

      if (Array.isArray(reply)){
        return callback(undefined, reply);
      }

      return callback(new Error("Invalid response received from node"));
    }).catch((error) => {
      callback(error);
    })
  }
}

class NodeManager {
  constructor() {
    this.nodes = {
      "change": new change(),
      "email": new email(),
      "geofence": new geo(),
      "http": new http(),
      "switch": new select(),
      "template": new template(),
      "device in": new device_in,
      "device out": new device_out(publisher),
      "device template in": new device_tpl()
    };
  }

  asJson() {
    let result = [];
    for (let node in this.nodes) {
      let data = this.nodes[node].getMetadata();
      data.enabled = true;
      data.local = true;
      data.types = [data.name];
      result.push(data);
    }
    return result;
  }

  asHtml() {
    let result = "";
    for (let node in this.nodes) {
      let data = fs.readFileSync(this.nodes[node].getNodeRepresentationPath());
      result = result + '\n' + data;
    }
    return result;
  }

  getNode(type) {
    return this.nodes[type];
  }

  addRemote(image, id) {
    return new Promise((resolve, reject) => {
      let newNode = new RemoteNode(image, id);
      newNode.create().then(() => {
        newNode.init().then(() => {
          let meta = newNode.getMetadata();
          console.log('[nodes] container meta', JSON.stringify(meta));
          this.nodes[meta.name] = newNode;
          resolve();
        }).catch((error) => {
          reject(error);
        })
      }).catch((error) => {
        reject(error);
      });
    });
  }

  delRemote(image, id) {
    return new Promise((resolve, reject) => {
      let node = null;
      for (let n in this.nodes) {
        if (this.nodes[n].hasOwnProperty('info')) {
          if (this.nodes[n].info.userid == id) {
            this.nodes[n].remove().then(() => {
              delete this.nodes[n];
              return resolve();
            }).catch((error) => {
              return reject(error);
            })
            return;
          }
        }
      }

      reject(new Error("No such node found"));
    })
  }
}

module.exports = { Manager: new NodeManager() };