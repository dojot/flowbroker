/* jshint node: true */
/* jshint esversion: 6 */
"use strict";

var mongo = require('mongodb');
var config = require('./config');

class MongoAbstraction {
  constructor() {
    this.clients = {};
  }

  get(url) {
    const target = url || config.mongodb.url;

    return new Promise((resolve, reject) => {
      if (this.clients.hasOwnProperty(target)) {
        resolve(this.clients[target]);
      } else {
        mongo.MongoClient.connect(target, config.mongodb.opt).then((client) => {
          this.clients[target] = client;
          resolve(client);
        }).catch((error) => {
          reject(error);
        });
      }
    });
  }
}

 module.exports = new MongoAbstraction();
