"use strict";

var RemoteNode = require("../remoteNode/index").Handler;

// This should be external - but since it's bugged....
var docker = require('../../docker/harbor-master');
var logger = require("../../logger").logger;

function makeId(length) {
  var text = "";
  var possible = "abcdef0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}


class DataHandler extends RemoteNode {
  constructor(image, id, socketPath, network) {
    //for now we will set the server address as undefined, it  will be defined
    //when the container be created, during the create method
    super(id, undefined, 5555);
    this.info = {
      userid: id,
      image: image,
      enabled: false
    };

    this.client = docker.Client({ socket: socketPath });
    this.network = network;
  }

  getNetwork() {
    return new Promise((resolve, reject) => {
      if (this.client === undefined) {
        reject("Docker drive not fully initialized.");
        return;
      }
      if (this.targetNetwork) {
        return resolve(this.targetNetwork);
      }

      this.client.networks().list().then((results) => {
        let errorMessage;
        if (this.network) {
          for (let result of results) {
            if (result.Name.includes(this.network)) {
              return resolve(this.network);
            }
          }
          errorMessage = `failed to acquire target network ${this.network}`;
        } else {
          errorMessage = "failed to acquire target network. network name is blank";
        }
        logger.error(errorMessage);
        return reject(new Error(errorMessage));
      }).catch((error) => {
        console.error("failed to acquire target network", error);
        return reject(error);
      });
    });
  }

  create() {
    return new Promise((resolve, reject) => {
      if (this.client === undefined) {
        reject("Docker drive not fully initialized.");
        return;
      }
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
            this.serverAddress = container.Id.substr(0,12);
            console.log(`Target: ${this.serverAddress}`);
            this.getNetwork().then((network) => {
              this.client.networks().connect(network, network_opt).then(() => {
                console.log(`[nodes] container up: ${options.name}:${container.Id}`);
                return resolve();
              }).catch((error) => {
                this.remove();
                return reject(error);
              });
            }).catch((error) => {
              this.remove();
              return reject(error);
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

  remove(target) {
    return new Promise((resolve, reject) => {
      if (this.client === undefined) {
        reject("Docker drive not fully initialized.");
        return;
      }
      if (target !== undefined) {
        this.client.containers().remove(target, {force: true}).then(() => {
          return resolve();
        }).catch((error) => {
          return reject(error);
        });
      } else {
        this.client.containers().remove(this.info.container, {force: true}).then(() => {
          return resolve();
        }).catch((error) => {
          return reject(error);
        });
      }
    });
  }

  stats(target) {
    return new Promise((resolve, reject) => {
      if (this.client === undefined) {
        reject("Docker drive not fully initialized.");
        return;
      }
      if (target !== undefined) {
        this.client.containers().stats(target, { stream: false }).then((stats) => {
          return resolve(stats);
        }).catch((error) => {
          return reject(error);
        });
      } else {
        this.client.containers().stats(this.info.container, { stream: false }).then(() => {
          return resolve();
        }).catch((error) => {
          return reject(error);
        });
      }
    });
  }
  update() {
    // TODO
  }
}

module.exports = {Handler: DataHandler};
