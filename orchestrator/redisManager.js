/* jslint node: true */
"use strict";

var redis = require("redis");
var config = require("./config");
var { ClientWrapper } = require('./redisClientWrapper');

class RedisManager {
  constructor() {
    this.redis = redis.createClient({ host: config.redis.url });
  }

  /**
   * Build a new client wrapper based on the already created REDIS connection.
   * @returns A new client wrapper.
   */
  getClient() {
    return new ClientWrapper(this.redis);
  }
}

module.exports = { RedisManager };
