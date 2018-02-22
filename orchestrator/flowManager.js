"use strict";
/**
 * Manages flows configured by the application
 */


module.exports = class FlowManager {
  constructor() {
    this.flows = {};

    // TODO
    this.byTemplate = {};
    this.byDevice = {};
  }

  parse(flow) {
    let parsed = {heads: {}, tails: {}, nodes: {}, id: undefined};
    for (let node of flow) {
      if ((node.type == 'tab') || (node.wires == undefined)) {
        parsed.id = node.id
        continue;
      }

      parsed.nodes[node.id] = node;
      if (node.wires.length == 0) {
        parsed.tails[node.id] = true;
      }

      const inputNodes = ["device-in", "template-in"];
      if (inputNodes.includes(node.type)){
        parsed.heads[node.id] = node;
      }
    }

    return parsed;
  }

  get(flowid) {
    // TODO data should be collected from persistent store
    if (this.flows.hasOwnProperty(flowid)) {
      return this.flows[flowid];
    }

    throw new Error("Unkown flow [" + flowid + "] requested");
  }

  set(flow){
    // TODO data should be collected from persistent store
    let parsed = this.parse(flow);
    this.flows[parsed.id] = parsed;
    return parsed;
  }

  remove(flowid) {
    // TODO data should be collected from persistent store
    if (this.flows.hasOwnProperty(flowid)) {
      delete this.flows[flowid];
    }
  }

  getByDevice(deviceid) {
    // TODO
    let result = []
    for (let flowid in this.flows) {
      result.push(this.flows[flowid]);
    }
    return result;
  }

  getByTemplate(templateid) {
    // TODO
    let result = []
    for (let flowid of this.flows) {
      result.push(this.flows[flowid]);
    }
    return result;
  }
}
