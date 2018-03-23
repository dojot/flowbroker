"use strict";

var fs = require('fs');
var util = require('util');

var change = require('./nodes/change/index').Handler;
var edge = require('./nodes/edge/index').Handler;
var email = require('./nodes/email/index').Handler;
var geo = require('./nodes/geo/index').Handler;
var http = require('./nodes/http/index').Handler;
var select = require('./nodes/switch/index').Handler;
var template = require('./nodes/template/index').Handler;
var device_in = require('./nodes/device-in/device-in').Handler;
var device_out = require('./nodes/device-out/device-out').Handler;
var device_tpl = require('./nodes/template-in/template-in').Handler;
var publisher = require('./publisher');

var docker = require('./docker/harbor-master');
var uuid = require('uuid/v4');

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
          console.log(`[nodes] container up: ${options.name}:${container.Id}`);
          return resolve();
        }).catch((error) => {
          console.log('@ inner', error);
          return reject(error);
        })
      }).catch((error) => {
        console.log('@ outer');
        return reject(error);
      })
    })
  }
}

module.exports = { Manager: new NodeManager() };