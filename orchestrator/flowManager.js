/* jshint node: true */
/* jshint esversion: 6 */
"use strict";
/**
 * Manages flows configured by the application
 */

var mongo = require('mongodb');
var uuid = require('uuid/v4');

class FlowError extends Error {
  constructor(...params) {
    super(...params);
    this.httpStatus = 400;
  }

  payload() {
    return {'message': this.message };
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
    }
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
   * and parsing
   *
   * @param  {[type]} flow [description]
   * @return {[type]}      [description]
   */
  parse(flow) {
    let parsed = {
      heads: [],
      devices: [],
      templates: [],
      nodes: {}, // nodes dict should be used on cache only: mongo doesn't like dots on keys
      red: flow
    };

    for (let node of flow) {
      if ((node.type == 'tab') || (node.wires == undefined)) {
        // ignore tab node (used to identify flow by node-red front-end)
        continue;
      }

      parsed.nodes[node.id] = node;
      const inputNodes = ["device-in", "template-in"];
      if (inputNodes.includes(node.type)){
        // TODO add related device/template id to corresponding list
        parsed.heads.push(node.id);
      }
    }

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
    return new Promise((resolve, reject) => {
      this.collection.deleteMany({}).then((results) => {
        resolve();
      }).catch((error) => {
        reject(error);
      });
    });
  }

  get(flowid) {
    return new Promise((resolve, reject) => {
      this.collection.findOne({id: flowid}).then((flow) => {
        if (!flow)
          reject(new UnknownFlowError(flowid));

        resolve(flow);
      }).catch((error) => {
        if (error instanceof mongo.MongoError){
          reject(error);
        }
      });
    });
  }

  create(label, enabled, flow) {
    return new Promise((resolve, reject) => {
      if (!label)
        reject(new InvalidFlowError("Label field is required"));

      let enabledVal;
      if ((enabled === undefined) || (enabled === null)) {
        enabledVal = true;
      } else if (enabled instanceof String) {
        enabledVal = (enabled.lower() in ['true', '1']);
      } else if (enabled instanceof Boolean) {
        enabledVal = enabled;
      } else {
        reject(new InvalidFlowError("Invalid 'enabled' field"));
      }

      let parsed;
      try {
        parsed = this.parse(flow);
        delete parsed.nodes; // mongo doesn't like dots on keys
      } catch (e) {
        reject(new InvalidFlowError());
      }

      parsed.enabled = enabledVal;
      parsed.label = label;
      parsed.id = uuid();

      this.collection.insert(parsed).then((results) =>{
        resolve(parsed);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  set(flowid, label, enabled, flow){
    return new Promise((resolve, reject) => {
      this.get(flowid).then((oldFlow) => {
        let newFlow = JSON.parse(JSON.stringify(oldFlow));
        newFlow._id = oldFlow._id;
        if (flow) {
          let parsed = this.parse(flow);
          delete parsed.nodes; // mongo doesn't like dots on keys
          for (let k in parsed) {
            newFlow[k] = parsed[k];
          }
        }
        if (label) { newFlow.label = label; }
        if (enabled) { newFlow.enabled = enabled; }

        this.collection.findOneAndReplace({id: flowid}, newFlow).then((result) => {
          if (result.ok === 1) {
            resolve(newFlow);
          }
          reject(new MongoError());
        }).catch((error) => {
          reject(error);
        });
      }).catch((error) => {
        reject(error);
      });
    });
  }

  remove(flowid) {
    return new Promise((resolve, reject) => {
      this.collection.findOneAndDelete({id: flowid}).then((flow) => {
        if (flow.value == null) {
          reject(new UnknownFlowError(flowid));
        } else if (flow.ok === 1) {
          resolve(flow.value);
        } else {
          reject(new MongoError());
        }
      }).catch((error) => {
        reject(error);
      });
    });
  }

  getByDevice(deviceid) {
    // TODO
    let result = [];
    for (let flowid in this.flows) {
      result.push(this.flows[flowid]);
    }
    return result;
  }

  getByTemplate(templateid) {
    // TODO
    let result = [];
    for (let flowid of this.flows) {
      result.push(this.flows[flowid]);
    }
    return result;
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
  FlowError: FlowError
};
