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

    return Promise.resolve()
      .then(() => {
        if (this.clients.hasOwnProperty(target)) {
          return this.clients[target];
        }

        return mongo.MongoClient
          .connect(target, config.mongodb.opt)
          .then((client) => {
            this.clients[target] = client;
            return client;
          });
        });
  }
}

 module.exports = new MongoAbstraction();
