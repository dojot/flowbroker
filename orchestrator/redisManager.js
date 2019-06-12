/* jslint node: true */
"use strict";

var redisClient = require("ioredis");
var config = require("./config");
var { DeviceCache } = require('./DeviceCache');
const logger = require("@dojot/dojot-module-logger").logger;

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
      logger.info(`Succesfully connected to redis`, { filename: 'redisMngr' });
      this.redis.flushdb().then(() => {
        logger.info(`Cache is cleared`, { filename: 'redisMngr' });
      }).catch((error) => {
        logger.error(error, { filename: 'redisMngr' });
      });
    });

    this.redis.on("error", (error) => {
      this.redisState = "notConnected";
      logger.error(`An error occurred with redis ${error}`, { filename: 'redisMngr' });
    });

    this.redis.on("reconnect", () => {
      logger.info(`[redis] Connection reestablished`, { filename: 'redisMngr' })
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
   * @param {string} client which client is desired. Supported values: 'deviceCache'
   * @returns A new client wrapper.
   */
  getClient(client) {
    switch (client) {
      case "deviceCache":
        return new DeviceCache(this.redis);
      default:
        return null;
    }
  }
}

module.exports = { RedisManager };
