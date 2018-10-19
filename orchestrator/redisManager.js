/* jslint node: true */
"use strict";

var redisClient = require("ioredis");
var config = require("./config");
var { ClientWrapper } = require('./redisClientWrapper');
var logger = require("@dojot/dojot-module-logger").logger;

const TAG={filename:"redis-manager"};

class RedisManager {
  constructor() {
    /**
     * RedisState: variable to check connection to Redis and avoid wait some time until see the connection isn't up
     * maxRetriesPerRequest: Number of retries that will try to execute the comand on Redis, if after 4 retries
     * it hasn't done yet, it will throw an error.
     */
    this.redisState = "notConnected";
    this.redis = new redisClient({
      port: 6379,
      host: config.redis.url,
      maxRetriesPerRequest: 4
    });

    /**Redis events: the cache is cleared when redis comes up.
    This happens because if flowbroker receives an event of device update and can't
    delete the device from cache because redis is down, when it comes up, the data will
    be outdated, so it's better to clear the cache.
    */
    this.redis.on("connect", () => {
      this.redisState = "Connected";
      logger.debug(`Succesfully connected to redis`, TAG);
      this.redis.flushdb().then(() => {
        logger.debug(`Cache is cleared`, TAG);
      }).catch((error) => {
        logger.error(`Could not connect to redis: ${error}`, TAG);
      });
    });

    this.redis.on("error", (error) => {
      this.redisState = "notConnected";
      logger.debug(`An error occurred with redis ${error}`, TAG);
    });

    this.redis.on("reconnect", () => {
      logger.debug(`Connection reestablished`, TAG);
    });
  }

  /**
   * returns the current state of the redis connection
   */
  getState() {
    return this.redisState;
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
