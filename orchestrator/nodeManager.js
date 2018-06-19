"use strict";

var fs = require('fs');

// This should be external - but since it's bugged....
var docker = require('./docker/harbor-master');

var dojot = require('@dojot/flow-node');
var dispatcher = require('./dispatcher');

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
var Publisher = require('./publisher');

var config = require("./config");
const k8s = require("kubernetes-client");
const util = require("util");

function makeId(length) {
  var text = "";
  var possible = "abcdef0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}



class KubernetesRemoteNode extends dojot.DataHandlerBase {
  constructor(image, id) {
    super();
    console.log("Using kubernetes driver.");
    this.image = image;
    this.id = id;
    console.log(`Selected engine: ${config.deploy.engine} `);
    console.log(`Kubernetes config: ${util.inspect(config.deploy.kubernetes, {depth: null})}`);
    if (config.deploy.engine === "kubernetes" && config.deploy.kubernetes) {
      this.host = config.deploy.kubernetes.url;
      this.token = fs.readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/token")
      let options = this.getDefaultGroupOptions();
      options.version = "v1";
      this.api = new k8s.Core(options);
      options.version = "v1beta1";
      this.ext = new k8s.Extensions(options);
      this.retrieveDeployments();
    }
    else {
      // Throw exception or return error
      this.token = "";
      this.host = "";
      this.api = null;
      this.ext = null;
    }
    // This will be filled by retrieveDeployment function
    this.deployTemplate = {
      "apiVersion": "extensions/v1beta1",
      "kind": "Deployment",
      "metadata": {
        "labels": {
          "name": ""
        },
        "name": ""
      },
      "spec": {
        "replicas": 1,
        "template": {
          "metadata": {
            "labels": {
              "name": ""
            }
          },
          "spec": {
            "containers": [],
            "restartPolicy": "Always"
          }
        }
      }
    };
    this.serviceTemplate = {
      "apiVersion": "v1",
      "kind": "Service",
      "metadata": {
        "name": ""
      },
      "spec": {
        "selector": {
          "name": ""
        },
        "ports": [
          { "protocol": "TCP", "port": 5555, "targetPort": 5555 }
        ]
      }
    };
    this.scaledownTemplate = {
      "apiVersion": "extensions/v1beta1",
      "kind": "Deployment",
      "metadata": {
        "name": ""
      },
      "spec": {
        "replicas": 0
      }
    };
    this.deploymentNames = [];
    this.target = "";
    this.html = "";

  }
  getDefaultGroupOptions() {
    return {
      url: this.host,
      version: 'v1beta1',
      auth: {
        bearer: this.token
      },
      insecureSkipTlsVerify: true
    };
  }
  // This might be removed soon
  retrieveDeployments() {
    return new Promise((resolve, reject) => {
      if (this.ext == null) {
        reject(500);
        return;
      }
      console.log(`Retrieving current deployment...`);
      console.log(`Sending request to server...`);
      this.ext.namespaces("dojot").deployments("").get().then((value) => {
        let tempDeploymentNames = [];
        for (let deployment of value.items) {
          tempDeploymentNames.push(deployment.metadata.name);
        }
        // Get only those ones created by flowbroker
        this.deploymentNames = tempDeploymentNames.filter((name) => (name.match(/^flownode-.*/) != null));
        console.log(`Deployments: ${util.inspect(value, { depth: null })}`);
        resolve(200);
      }).catch((value) => {
        console.log(`Error: ${util.inspect(value, { depth: null })}`);
        reject(404);
      });
      console.log(`... request was sent to the server.`);
    });
  }
  create() {
    return new Promise((resolve, reject) => {
      this.retrieveDeployments().then(() => {
        try {
          console.log(`Building deployment creation request...`);
          let deployment = JSON.parse(JSON.stringify(this.deployTemplate));
          let deploymentName = `flownode-${this.id}`;
          deployment.metadata.labels.name = deploymentName;
          deployment.metadata.name = deploymentName;
          deployment.spec.template.metadata.labels.name = deploymentName;
          console.log(`Adding all containers...`);
          console.log(`Adding container ${this.image} to the set...`);
          let containerTemplate = {
            name: this.id,
            image: this.image,
            imagePullPolicy: "Never",
            ports: [
              { name: "amqp", port: 5555, containerPort: 5555 }
            ]
          };
          deployment.spec.template.spec.containers.push(containerTemplate);
          console.log(`... container ${this.id} was added to the set.`);
          console.log(`... deployment creation request was built.`);
          console.log("... all containers were added to the set.");
          console.log(`Deployment is:`);
          console.log(util.inspect(deployment, { depth: null }));
          this.target = deploymentName;
          this.createDeployment(deployment, resolve, reject);
        }
        catch (error) {
          console.log(`Exception: ${error}`);
          reject(404);
        }
      }).catch((error) => {
        console.log("Could not retrieve current deployments");
        console.log(`Error is: ${error}`);
      });
    });
  }
  remove() {
    return new Promise((resolve, reject) => {
      this.retrieveDeployments().then(() => {
        let namespace = "flownode-" + this.id;
        console.log(`Removing deployment ${this.id}...`);
        if (!this.deploymentNames.find((name) => name == namespace)) {
          console.log(`Could not find deployment ${namespace}.`);
          reject("Could not find this deployment");
          return;
        }
        console.log(`Removing container ${this.id} from the set`);
        let tempList = this.deploymentNames.filter((name) => name != namespace);
        this.deploymentNames = tempList;
        console.log(`Current container list is ${this.deploymentNames}`);
        this.removeDeployment(namespace, resolve, reject);
      }).catch((error) => {
        console.log("Could not retrieve current deployments");
        console.log(`Error is: ${error}`);
      });
    });
  }
  createDeployment(deployment, resolve, reject) {
    if (this.ext == null || this.api == null) {
      reject(500);
      return;
    }
    console.log(`Sending request to server...`);
    this.ext.namespaces("dojot").deployments.post({ body: deployment }).then((value) => {
      console.log(`Deployment created:  ${util.inspect(value, { depth: null })}`);
      console.log('Creating service for this deployment...');
      let service = JSON.parse(JSON.stringify(this.serviceTemplate));
      service.metadata.name = `${deployment.metadata.name}`;
      service.spec.selector.name = deployment.metadata.name;
      console.log(`Service to be created: ${util.inspect(service, { depth: null })}`);
      this.api.namespaces("dojot").services.post({ body: service }).then((value) => {
        console.log(`... service for deployment created:  ${util.inspect(value, { depth: null })}`);
        resolve(200);
      }).catch((error) => {
        console.log(`Error while creating service for deployment: ${error}`);
        resolve(404);
      });
    }).catch((error) => {
      console.log(`Error while creating deployment: ${error}`);
      resolve(404);
    });
    console.log(`... request was sent to the server.`);
  }
  removeDeployment(deploymentName, resolve, reject) {
    if (this.ext == null) {
      reject(500);
      return;
    }
    const options = {
      qs: ""
    };
    let config = this.getDefaultGroupOptions();
    config.version = "v1";
    let core = new k8s.Core(config);
    console.log(`Scaling down deployment ${deploymentName}...`);
    let scaleTemplate = JSON.parse(JSON.stringify(this.scaledownTemplate));
    scaleTemplate.metadata.name = deploymentName;
    this.ext.namespaces("dojot").deployments(deploymentName).patch({ body: scaleTemplate }).then((value) => {
      console.log(`... deployment ${deploymentName} was scaled down.`);
      console.log(`Removing deployment ${deploymentName}...`);
      this.ext.namespaces("dojot").deployments(deploymentName).delete(options).then((value) => {
        console.log(`... deployment ${deploymentName} was removed.`);
        console.log('Removing service for this deployment...');
        let serviceName = `${deploymentName}`;
        core.namespaces("dojot").services(serviceName).delete(options).then((value) => {
          console.log(`... Service for deployment removed:  ${util.inspect(value, { depth: null })}`);
          resolve(200);
        }).catch((error) => {
          console.log(`Error while removing service for deployment: ${error}`);
          resolve(404);
        });
      }).catch((error) => {
        console.log(`Error while removing deployment: ${error}`);
        resolve(404);
      });
      console.log(`... deployment removal request was sent to the server.`);
    });
    console.log(`... deployment scale down request was sent to the server.`);
  }

  update() {

  }


  init() {
    // Fetch all meta information from newly created remote impl
    return new Promise((resolve, reject) => {
      dispatcher(this.target, {command: 'metadata'}).then((meta) => {
        this.metadata = meta.payload;
        dispatcher(this.target, { command: 'html' }).then((html) => {
          this.html = '/tmp/' + this.target;
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
  getLocaleData() {
    return this.locale;
  }

  handleMessage(config, message, callback) {
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
    });
  }
}

class DockerRemoteNode extends dojot.DataHandlerBase {
  constructor(image, id) {
    super();
    this.info = {
      userid: id,
      image: image,
      enabled: false
    };

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
        return reject(error);
      });
    });
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
      this.client.images().create(imageOptions).then(() => {
        console.log(`[nodes] image ${this.info.image} created`);
        this.client.containers().create(model, options).then((container) => {
          console.log(`[nodes] container ${options.name} was created`);
          this.client.containers().start(container.Id).then(() => {
            // TODO alias config is not working
            const network_opt = {
              Container: container.Id
            };
            this.info.container = container.Id;
            this.target = container.Id.substr(0,12);
            console.log(`Target: ${this.target}`);
            this.getNetwork().then((network) => {
              this.client.networks().connect(network, network_opt).then(() => {
                console.log(`[nodes] container up: ${options.name}:${container.Id}`);
                return resolve();
              }).catch((error) => {
                this.remove();
                return reject(error);
              });
            });
          }).catch((error) => {
            this.remove();
            return reject(new Error(error.body.message));
          });
        }).catch((error) => {
          return reject(error);
        });
      }).catch((error) => {
        return reject(error);
      });
    });
  }

  remove() {
    return new Promise((resolve, reject) => {
      this.client.containers().remove(this.info.container, {force: true}).then(() => {
        return resolve();
      }).catch((error) => {
        return reject(error);
      });
    });
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
          this.html = '/tmp/' + this.target;
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
  getLocaleData() {
    return this.locale;
  }

  handleMessage(config, message, callback) {
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
    });
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
      "device in": new device_in(),
      "device out": new device_out(new Publisher()),
      "device template in": new device_tpl(),
      "actuate": new actuate(new Publisher('dojot.device-manager.device'))
    };
  }

  asJson() {
    let result = [];
    for (let node in this.nodes) {
      if (this.nodes.hasOwnProperty(node)) {
        let data = this.nodes[node].getMetadata();
        data.enabled = true;
        data.local = true;
        data.types = [data.name];
        result.push(data);
      }
    }
    return result;
  }

  asHtml() {
    let result = "";
    for (let node in this.nodes) {
      if (this.nodes.hasOwnProperty(node)) {
        let data = fs.readFileSync(this.nodes[node].getNodeRepresentationPath());
        result = result + '\n' + data;
      }
    }
    return result;
  }

  getNode(type) {
    return this.nodes[type];
  }

  addRemote(image, id) {
    return new Promise((resolve, reject) => {
      let newNode;
      if (config.deploy.engine === "docker-compose") {
        newNode = new DockerRemoteNode(image, id);
      } else if (config.deploy.engine === "kubernetes") {
        newNode = new KubernetesRemoteNode(image, id);
      }
      if (newNode === undefined) {
        return;
      }

      newNode.create().then(() => {
        newNode.init().then(() => {
          let meta = newNode.getMetadata();
          console.log('[nodes] container meta', JSON.stringify(meta));
          this.nodes[meta.name] = newNode;
          resolve();
        }).catch((error) => {
          reject(error);
        });
      }).catch((error) => {
        reject(error);
      });
    });
  }

  delRemote(image, id) {
    return new Promise((resolve, reject) => {

      // This is a wrapper function to properly remove the attribute and to
      // call resolve() inside a loop.
      let processRemoveOk = (n) => {
          return () => {
          delete this.nodes[n];
          return resolve();
        };
      };

      let processRemoveError = (error) => {
        return reject(error);
      };

      for (let n in this.nodes) {
        if (this.nodes[n].hasOwnProperty('info')) {
          if (this.nodes[n].info.userid === id) {
            this.nodes[n].remove().then(processRemoveOk(n))
              .catch(processRemoveError);
            return;
          }
        }
      }

      reject(new Error("No such node found"));
    });
  }
}

module.exports = { Manager: new NodeManager() };