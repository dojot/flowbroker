"use strict";

var fs = require('fs');
var util = require('util');
var uuid = require('uuid/v4');

// This should be external - but since it's bugged....
var docker = require('./docker/harbor-master');

var dojot = require('dojot-node-library');
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


class RemoteNode extends dojot.DataHandlerBase {
  constructor(remoteid) {
    super();
    this.remote = remoteid;
    this.target = remoteid.substr(0,12);
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
    let message = {
      command: 'message',
      message: message,
      config: config,
    };
    dispatcher(this.target, message).then((reply) => {
      if (reply.error) {
        callback(error);
      }
      callback(undefined, reply.messages);
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
      let model = {
        Image: image,
        AttachStdin: false,
        AttachStdout: false,
        AttachStderr: true,
        NetworkDisabled: false,
        HostConfig: {
          AutoRemove: true
        },
        Tty: true
      }

      let client = docker.Client({ socket: '/var/run/docker.sock' });

      let options = { name: uuid() };
      client.containers().create(model, options).then((container) => {
        console.log(`[nodes] container ${options.name} was created`);
        client.containers().start(container.Id).then((result) => {
          const network_opt = {
            Container: container.Id
          };
          client.networks().connect('dojot_flowbroker', network_opt).then((result) => {
            console.log(`[nodes] container up: ${options.name}:${container.Id}`);
            let newNode = new RemoteNode(container.Id);
            newNode.init().then(() => {
              let meta = newNode.getMetadata();
              console.log('[nodes] container meta', JSON.stringify(meta));
              this.nodes[meta.name] = newNode;
            }).catch((error) => {
              // TODO remove container
              console.error("[nodes] node initialization failed");
              return reject(new Error('Failed to initialize worker'));
            })

            return resolve();
          }).catch((error) => {
            // TODO remove container
            // console.log('network', error);
            return reject(error);
          })
        }).catch((error) => {
          // TODO remove container
          // console.log('start', error);
          return reject(new Error(error.body.message));
        })
      }).catch((error) => {
        // console.log('create', error);
        return reject(new Error(error.body.message));
      })
    })
  }
}

module.exports = { Manager: new NodeManager() };