"use strict";

/**
 * Manages flows configured by the application
 */

var mongo = require('mongodb');
var uuid = require('uuid/v4');
var util = require('util');
const logger = require("@dojot/dojot-module-logger").logger;

class FlowError extends Error {
  constructor(...params) {
    super(...params);
    this.httpStatus = 400;
  }

  payload() {
    return { 'message': this.message };
  }
}

class InvalidFlowError extends FlowError {
  constructor() { super("Given flow is invalid"); }
}

class UnknownFlowError extends FlowError {
  constructor(id) {
    super("Unknown flow: " + id);
    this.flowid = id;
  }

  payload() {
    return {
      'message': this.message,
      'flow': this.flowid
    };
  }
}

class TenantError extends FlowError {
  constructor() { super("Invalid tenant id supplied"); }
}

class MongoError extends FlowError {
  constructor() {
    super("Database operation failed");
    this.httpStatus = 500;
  }
}

class ParsedFlow {
  constructor(flow) {
    this.heads = [];
    this.devices = [];
    this.templates = [];
    this.nodes = {}; // nodes dict should be used on cache only: mongo doesn't like dots on keys
    this.red = flow;
  }
}

class FlowManager {
  /*
   * TODO this still needs some sort of redis-backed cache system - otherwise flow exec will be
   * dreadfully slow.
   *
   * Using redis is needed to allow multiple workers to "share"  the same tier-two cache.
   * Tier-one cache then can be local (something along the lines of ttl-mem-cache)
   */

  constructor(mongoClient, tenant) {
    if (!tenant) {
      throw new TenantError();
    }

    this.tenant = tenant;
    this.client = mongoClient;
    this.collection = this.client.db('flowbroker_' + this.tenant).collection('flows');

  }



  /**
   * Given a flow representation (json, node-red schema), perform initial validation
   * and parsing.
   * 
   * This function will ignore any 'tab' and undefined nodes.
   *
   * @param  {[type]} flow [description]
   * @returns {ParsedFlow} A structure containing the parsed flow
   * @throws InvalidFlowError If any node has no 'type' attribute.
   */
  parse(flow) {
    logger.debug("Parsing new flow...", { filename: 'flowMngr' });
    let parsed = new ParsedFlow(flow);
    logger.debug(`New flow: ${util.inspect(parsed, { depth: null })}`, { filename: 'flowMngr' });

    for (let node of flow) {
      if (!node.hasOwnProperty('type')) {
        logger.debug(`Node ${util.inspect(node, { depth: null })} has no 'type' attribute.`, { filename: 'flowMngr' });
        throw new InvalidFlowError();
      }

      if ((node.type === 'tab') || (node.wires === undefined)) {
        // ignore tab node (used to identify flow by node-red front-end)
        logger.debug(`Ignoring 'tab' node.`, { filename: 'flowMngr' });
        continue;
      }

      parsed.nodes[node.id] = node;

      // Properly add the head nodes.
      switch (node.type) {
        case "event device in":
          parsed.heads.push(node.id);
          parsed.devices.push(node.device_id);
          break;
        case "event template in":
          parsed.heads.push(node.id);
          parsed.templates.push(node.template_id);
          break;
        case "device in":
          parsed.heads.push(node.id);
          parsed.devices.push(node._device_id);
          break;
        case "device template in":
          parsed.heads.push(node.id);
          parsed.templates.push(node.device_template_id.toString());
          break;
      }
    }

    logger.debug("... flow was successfully parsed.", { filename: 'flowMngr' });
    return parsed;
  }

  getAll() {
    return new Promise((resolve, reject) => {
      try {
        resolve(this.collection.find().toArray());
      } catch (e) {
        reject(e);
      }
    });
  }

  removeAll() {
    return this.collection
      .deleteMany({})
      .then(() => { });
  }

  get(flowid) {
    return this.collection
      .findOne({ id: flowid })
      .then(flow => {
        if (!flow) {
          throw new UnknownFlowError(flowid);
        }

        return flow;
      })
      .catch(error => {
        if (error instanceof mongo.MongoError) {
          throw error;
        }
      });
  }

  create(label, enabled, flow) {
    return new Promise((resolve, reject) => {
      logger.debug("Creating new flow...", { filename: 'flowMngr' });
      if (!label) {
        logger.error("Flow has no label.", { filename: 'flowMngr' });
        return reject(new InvalidFlowError("Label field is required"));
      }

      logger.debug("Checking 'enabled' field...", { filename: 'flowMngr' });
      let enabledVal;
      if ((enabled === undefined) || (enabled === null)) {
        enabledVal = true;
      } else if (enabled instanceof String) {
        enabledVal = (enabled.lower() in ['true', '1']);
      } else if ((enabled instanceof Boolean) || (typeof enabled === 'boolean')) {
        enabledVal = enabled;
      } else {
        logger.error(`Invalid 'enabled' field: ${enabled}`, { filename: 'flowMngr' });
        return reject(new InvalidFlowError("Invalid 'enabled' field: ", enabled));
      }
      logger.debug("... 'enabled' field was checked.", { filename: 'flowMngr' });

      let parsed;
      try {
        parsed = this.parse(flow);
        delete parsed.nodes; // mongo doesn't like dots on keys
      } catch (e) {
        logger.info("... new flow has errors - it was not created.", { filename: 'flowMngr' });
        return reject(new InvalidFlowError());
      }

      parsed.enabled = enabledVal;
      parsed.label = label;
      parsed.id = uuid();
      parsed.created = new Date();
      parsed.updated = parsed.created;

      logger.debug('Inserting flow into the database...', { filename: 'flowMngr' });
      this.collection.insert(parsed).then(() => {
        logger.debug("... new flow was successfully inserted into the database.", { filename: 'flowMngr' });
        return resolve(parsed);
      }).catch((error) => {
        logger.debug(`... new flow was not inserted into the database. Error is ${error}`, { filename: 'flowMngr' });
        return reject(error);
      });
    });
  }

  set(flowid, label, enabled, flow) {
    return this.get(flowid)
      .then(oldFlow => {
        let newFlow = JSON.parse(JSON.stringify(oldFlow));
        newFlow.created = oldFlow.created;
        newFlow.updated = new Date();
        newFlow._id = oldFlow._id;
        if (flow) {
          let parsed = this.parse(flow);
          delete parsed.nodes; // mongo doesn't like dots on keys
          for (let k in parsed) {
            if (parsed.hasOwnProperty(k)) {
              newFlow[k] = parsed[k];
            }
          }
        }
        if (label) { newFlow.label = label; }
        if (enabled) { newFlow.enabled = enabled; }

        return this.collection
          .findOneAndReplace({ id: flowid }, newFlow)
          .then(result => {
            if (result.ok === 1) {
              return newFlow;
            }
            throw new MongoError();
          });
      });
  }

  remove(flowid) {
    return this.collection
      .findOneAndDelete({ id: flowid })
      .then((flow) => {
        if (flow.value === null) {
          throw new UnknownFlowError(flowid);
        } else if (flow.ok === 1) {
          return flow.value;
        } else {
          throw new Error(new MongoError());
        }
      });
  }

  getByDevice(deviceid) {
    return new Promise((resolve) => {
      // we might want to return ids only, but that would be best only if we had a local cache
      // in place
      resolve(this.collection.find({ devices: deviceid }).toArray());
    });
  }

  getByTemplate(templateid) {
    return new Promise((resolve) => {
      // we might want to return ids only, but that would be best only if we had a local cache
      // in place
      resolve(this.collection.find({ templates: templateid }).toArray());
    });
  }
}

class FlowManagerBuilder {
  constructor(client) {
    this.instance = {};
    this.client = client;
  }

  get(tenant) {
    if (!this.instance.hasOwnProperty(tenant)) {
      this.instance[tenant] = new FlowManager(this.client, tenant);
    }

    return this.instance[tenant];
  }
}

module.exports = {
  FlowManagerBuilder: FlowManagerBuilder,
  FlowError: FlowError,
  InvalidFlowError: InvalidFlowError
};
