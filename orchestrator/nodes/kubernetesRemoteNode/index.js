"use strict";

var fs = require('fs');
var k8s = require("kubernetes-client");
var util = require("util");
var logger = require("../../logger").logger;
var config = require("../../config");
var RemoteNode = require("../remoteNode/index").Handler;


const DEPLOY_TEMPLATE = JSON.stringify({
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
});

const SERVICE_TEMPLATE = JSON.stringify({
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
});

const SCALEDOWN_TEMPLATE = JSON.stringify({
  "apiVersion": "extensions/v1beta1",
  "kind": "Deployment",
  "metadata": {
    "name": ""
  },
  "spec": {
    "replicas": 0
  }
});

class DataHandler extends RemoteNode {

  /**
   * Constructor
   * @param {string} image The image to be added to Kubernetes pod
   * @param {string} id Node ID
   */
  constructor(image, id) {
    super();
    logger.debug("Using kubernetes driver.");
    this.image = image;
    this.id = id;
    logger.debug(`Selected engine: ${config.deploy.engine} `);
    if (config.deploy.engine === "kubernetes" && config.deploy.kubernetes) {
      this.host = config.deploy.kubernetes.url;
      this.token = config.deploy.kubernetes.token;
      if (this.token === "") {
        this.token = fs.readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/token");
      }

      // Initialize API access
      let options = this.getDefaultGroupOptions();
      options.version = "v1";
      this.api = new k8s.Core(options);
      options.version = "v1beta1";
      this.ext = new k8s.Extensions(options);

      logger.debug(`Using kubernetes API server @ ${this.host}`);

      logger.debug(`Testing access...`);
      this.retrieveDeployments().then(() => {
        logger.debug(`... server access is OK.`);
      }).catch((error) => {
        logger.debug(`... server access is not OK.`);
        logger.error(`Could not access Kubernetes API server: ${error}`);
      });
    } else {
      // Throw exception or return error
      this.token = "";
      this.host = "";
      this.api = null;
      this.ext = null;
      logger.debug('Kubernetes was not selected in config file or its config is empty.');
      logger.error(`Could not instantiate kubernetes driver (no config). All request will be ignored.`);
    }

    this.deploymentNames = [];
    this.target = "";
    this.html = "";
  }

  /**
   * Return a Kubernetes Group Option object.
   * This is the default configuraton and valid for extensions (most used API in
   * this handler). 
   * @returns { ApiGroupOptions } API group options for use with Kubernetes API.
   */
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

  /**
   * Get all flowbroker related deployments.
   * @returns Promise<string> A promise object which will retrieve all related
   * deployments.
   */
  retrieveDeployments() {
    return new Promise((resolve, reject) => {
      if (this.ext === null) {
        reject("Kubernetes driver not fully initialized.");
        return;
      }
      logger.debug(`Retrieving current deployment...`);
      logger.debug(`Sending request to server...`);
      this.ext.namespaces("dojot").deployments("").get().then((value) => {
        let tempDeploymentNames = [];
        for (let deployment of value.items) {
          tempDeploymentNames.push(deployment.metadata.name);
        }
        // Get only those ones created by flowbroker
        this.deploymentNames = tempDeploymentNames.filter((name) => (name.match(/^flownode-.*/) != null));
        logger.debug(`Current flowbroker deployments are: ${util.inspect(value, { depth: null })}`);
        resolve("Deployments were successfully retrieved.");
        return;
      }).catch((value) => {
        logger.debug(`Error: ${util.inspect(value, { depth: null })}`);
        reject(`Error while retrieving deployments: ${value}`);
        return;
      });
      logger.debug(`... request was sent to the server.`);
    });
  }

  /**
   * Create a new deployment in Kubernetes to run remote node.
   * @returns Promise<string> A promise object which will create this new deployment.
   */
  create() {
    return new Promise((resolve, reject) => {
      this.retrieveDeployments().then(() => {
        try {
          logger.debug(`Building deployment creation request...`);
          let deployment = JSON.parse(DEPLOY_TEMPLATE);
          let deploymentName = `flownode-${this.id}`;
          deployment.metadata.labels.name = deploymentName;
          deployment.metadata.name = deploymentName;
          deployment.spec.template.metadata.labels.name = deploymentName;
          logger.debug(`Adding container ${this.image} to the set...`);
          let containerTemplate = {
            name: this.id,
            image: this.image,
            imagePullPolicy: "Always",
            ports: [
              { name: "amqp", port: 5555, containerPort: 5555 }
            ]
          };

          deployment.spec.template.spec.containers.push(containerTemplate);
          logger.debug(`... container ${this.id} was added to the set.`);
          logger.debug(`... deployment creation request was built.`);
          logger.debug(`Deployment is:`);
          logger.debug(util.inspect(deployment, { depth: null }));
          this.target = deploymentName;
          this.createDeployment(deployment, resolve, reject);
        }
        catch (error) {
          logger.debug("Could not create deployment.");
          logger.error(`Could not create deployment. Error is ${error}`);
          reject(`Could not create deployment. Error is ${error}`);
          return;
        }
      }).catch((error) => {
        logger.debug("Could not retrieve current deployments while creating new one.");
        logger.error(`Could not retrieve current deployments while creating new one. Error is ${error}`);
        reject(`Could not retrieve current deployments. Error is ${error}`);
        return;
      });
    });
  }

  /**
   * Remove a deployment from Kubernetes
   * @returns Promise<string> A promise object which will remove this deployment.
   */
  remove() {
    return new Promise((resolve, reject) => {
      this.retrieveDeployments().then(() => {
        let deploymentName = "flownode-" + this.id;
        logger.debug(`Removing deployment ${this.id}...`);
        if (!this.deploymentNames.find((name) => name === deploymentName)) {
          logger.debug(`Could not find deployment ${deploymentName}.`);
          reject(`Could not find deployment ${deploymentName}`);
          return;
        }
        logger.debug(`Removing container ${this.id} from the set.`);
        let tempList = this.deploymentNames.filter((name) => name !== deploymentName);
        this.deploymentNames = tempList;
        logger.debug(`Current container list is ${this.deploymentNames}`);
        this.removeDeployment(deploymentName, resolve, reject);
      }).catch((error) => {
        logger.debug("Could not retrieve current deployments while removing one.");
        logger.error(`Could not retrieve current deployments while removing one. Error is ${error}`);
        reject(`Could not retrieve current deployments. Error is ${error}`);
        return;
      });
    });
  }

  /**
   * Create a new deployment
   * @param {object} deployment The deployment to be created.
   * @param {function} resolve Callback for success
   * @param {function} reject Callback for failure
   */
  createDeployment(deployment, resolve, reject) {
    if (this.ext === null || this.api === null) {
      reject("Kubernetes drive is not fully initialized");
      return;
    }
    logger.debug(`Sending request to server...`);
    this.ext.namespaces("dojot").deployments.post({ body: deployment }).then(() => {
      logger.debug('Creating service for this deployment...');
      let service = JSON.parse(SERVICE_TEMPLATE);
      service.metadata.name = `${deployment.metadata.name}`;
      service.spec.selector.name = deployment.metadata.name;
      logger.debug(`Service to be created: ${util.inspect(service, { depth: null })}`);
      this.api.namespaces("dojot").services.post({ body: service }).then((value) => {
        logger.debug(`... service for deployment created:  ${util.inspect(value, { depth: null })}`);
        resolve("Deployment and associated service successfully created.");
      }).catch((error) => {
        logger.debug("Could not create service.");
        logger.error(`Error while creating service for deployment: ${error}`);
        reject(`Error while creating service for deployment: ${error}`);
      });
    }).catch((error) => {
      logger.debug("Could not create deployment.");
      logger.error(`Error while creating deployment: ${error}`);
      reject(`Error while creating deployment: ${error}`);
    });
    logger.debug(`... request was sent to the server.`);
  }

  /**
   * Remove a deployment from Kubernetes
   * @param {string} deploymentName The deployment to be removed
   * @param {function} resolve Callback for success
   * @param {function} reject Callback for failure
   */
  removeDeployment(deploymentName, resolve, reject) {
    if (this.ext === null || this.api === null) {
      reject("Kubernetes drive is not fully initialized");
      return;
    }
    const options = {
      qs: ""
    };

    logger.debug(`Scaling down deployment ${deploymentName}...`);
    let scaleTemplate = JSON.parse(SCALEDOWN_TEMPLATE);
    scaleTemplate.metadata.name = deploymentName;
    this.ext.namespaces("dojot").deployments(deploymentName).patch({ body: scaleTemplate }).then(() => {
      logger.debug(`... deployment ${deploymentName} was scaled down.`);
      logger.debug(`Removing deployment ${deploymentName}...`);
      this.ext.namespaces("dojot").deployments(deploymentName).delete(options).then(() => {
        logger.debug(`... deployment ${deploymentName} was removed.`);
        logger.debug('Removing service for this deployment...');
        let serviceName = `${deploymentName}`;
        this.api.namespaces("dojot").services(serviceName).delete(options).then((value) => {
          logger.debug(`... Service for deployment removed:  ${util.inspect(value, { depth: null })}`);
          resolve("Deployment and associated service successfully removed");
        }).catch((error) => {
          logger.debug("Could not remove service for deployment.");
          logger.error(`Error while removing service for deployment: ${error}`);
          reject(`Error while removing service for deployment: ${error}`);
        });
      }).catch((error) => {
        logger.debug("Could not remove deployment.");
        logger.error(`Error while removing deployment: ${error}`);
        reject(`Error while removing deployment: ${error}`);
      });
      logger.debug(`... deployment removal request was sent to the server.`);
    });
    logger.debug(`... deployment scale down request was sent to the server.`);
  }

  update() {
    logger.debug(`Update not yet implemented for kubernetes remote node`);
  }
}

module.exports = {Handler: DataHandler};