"use strict";

var openwhisk = require('openwhisk');
var fs = require("fs");

function owConfig(next, params) {
  return {
    name: next,
    blocking: true,
    result: true,
    params: params
  }
}

function handle(node, msg, ow) {
  return ow.actions.invoke(owConfig(node.type, {msg: msg, node: node}));
}

// function handle(node, msg, ow) {
//   return new Promise((resolve, reject) => {
//     msg[node.type] = 'through here';
//     setTimeout(() => { resolve(msg); }, 100);
//   })
// }

function parseFlow(flow) {
  let parsed = {heads: {}, tails: {}, nodes: {}};
  for (let node of flow) {
    if ((node.type == 'tab') || (node.wires == undefined)) {
      continue;
    }

    parsed.nodes[node.id] = node;
    if (node.wires.length == 0) {
      parsed.tails[node.id] = true;
    }

    if (node.type == "device-in") {
      parsed.heads[node.id] = node;
    }
  }

  return parsed;
}

function next(stack, graph, msg, ow) {
  return new Promise((resolve, reject) => {
    // console.log('checking stack', stack);
    if (stack.length == 0) {
      // console.log('final', msg);
      return resolve(msg);
    }

    const at = stack.pop();
    const node = graph.nodes[at];
    if (node == undefined) {
      console.error("failed to find", at);
    }

    handle(node, msg, ow).then((outputMessage) => {
      stack.push.apply(stack, node.wires);
      resolve(next(stack, graph, outputMessage, ow));
    })
  });
}

function main(params) {
  if (params == undefined) {
    return {_status: "invalid params"};
  }
  const flow = params.flow || null;
  const msg = params.msg || null;


  if ((flow == null) || (msg == null)) {
    return {_status: "invalid params"};
  }

  const initialParams = {msg: msg};

  let graph = parseFlow(flow);
  let stack = Object.keys(graph.heads).slice();

  var ow = openwhisk({ignore_certs: true});
  return next(stack, graph, msg, ow).then((final) => {
    return final;
  });

  // next(stack, graph, {}, null).then((final) => {
  //   console.log({
  //     _msg: 'at then clause',
  //     _res: final,
  //     _graph: graph
  //   });
  // });
  // return '-- wait for it -- ';

}

// let data = JSON.parse(fs.readFileSync("test.json"));
// console.log(main({flow: data, msg: {}}));
