"use strict";

var fs = require("fs");
var zmq = require('zeromq');
var amqp = require('amqplib/callback_api');

function parseFlow(flow) {
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

    if (node.type == "device-in") {
      parsed.heads[node.id] = node;
    }
  }

  return parsed;
}

/**
 * Execute individual processing node, with given configuration
 * @param  {[type]} node node configuration to be used within invocation
 * @param  {[type]} msg  message that triggered the invocation
 * @return {[type]}      [description]
 */
function handle_dummy(node, msg) {
 // TODO this is a dummy (tests only) implementation
  return new Promise((resolve, reject) => {
    msg[node.type] = true;
    setTimeout(() => { resolve(msg); }, 100);
  })
}

 /**
  * Execute individual processing node, with given configuration
  * @param  {[type]} node node configuration to be used within invocation
  * @param  {[type]} msg  message that triggered the invocation
  * @return {[type]}      [description]
  */
function handle(node, msg) {
  // TODO this is a dummy (tests only) implementation
  return new Promise((resolve, reject) => {
    // TODO we could be using a proper zmq async req-rep pattern
    let sock = zmq.socket('req');
    sock.on("message", function(reply) {
      // console.log('got reply', reply.toString());
      sock.close();
      resolve(JSON.parse(reply.toString()));
    });

    // TODO proper validation of node.type as an address (or dns for that sake)
    sock.connect("tcp://" + node.type + ":5555");
    sock.send(JSON.stringify(msg));
  })
}


// class CallCtx {
//    msg: any;
//    node: string; // next-hop id
//    flow: string; // id of the graph to be traversed
//
//    meta: {
//      // TODO include execution metadata
//    }
// }

/**
 * Retrieves a given flow description
 * @param  {[string]} id Flow id.
 * @return {[flow]}      Full flow representation. undefined if no flow with given id.
 */
function get_graph(id) {
  if (id == graph.id) {
    return graph;
  } else {
    // TODO implement cache miss
  }
}

/**
 * Handles a flow's hop execution.
 */
function init_worker() {
  let max = 0;
  let min = 0;
  amqp.connect('amqp://amqp', function(err, conn) {
    if (err) {
      console.log('failed to connect to amqp broker', err);
    }

    conn.createChannel(function(err, consumerChannel) {
      if (err) {
        console.error('failed to create channel', err);
      }

      let q = 'task_queue';
      consumerChannel.assertQueue(q, {durable: false});
      consumerChannel.prefetch(1);

      conn.createChannel((err, writerChannel) => {
        if (err) { console.error('failed to create channel'); return ; }
        consumerChannel.consume(q, function(ctx) {
          let call = JSON.parse(ctx.content.toString());
          // console.log('got event', call);

          let flow = get_graph(call.flow);
          if ((flow == undefined) || (flow == null)){
            // TODO handle unknown flows (send alarm?)
            console.error('unknown flow');
            return;
          }

          let nodeConfig = flow.nodes[call.node];
          if (nodeConfig === undefined) {
            // TODO: send alarm?
            console.error("unkown node in flow");
          }

          handle(nodeConfig, call.msg).then((results) => {
            let t = new Date();
            // console.log('handle returned');
            if (nodeConfig.wires.length == 0) {
              // console.log('no more proc. to do');
              doneCount++;
              consumerChannel.ack(ctx);
              if (doneCount == willCount) {
                console.log('success %dms %dms', min, max);
                setTimeout(() => {
                  process.exit(0);
                }, 100)
              }
              return;
            }

            // console.log('will proc results', results, nodeConfig);
            // results is an array of array of messages to queue up
            let k = 0;
            for (let idx = 0 ; idx < nodeConfig.wires.length; idx++) {
              // TODO for full node-red compatibility, another 'for' (result publishing) is required.
              let nextOp = {
                msg: null,
                node: nodeConfig.wires[idx],
                flow: call.flow
              }

              // as in node-red nodes must be allowed to return multiple messages per registered
              // outputs, each of them being handled in "sequence"
              for (let msg of results) {
                nextOp.msg = msg;
                // console.log('about to send');
                writerChannel.sendToQueue(q, new Buffer(JSON.stringify(nextOp)), {persistent: false});
                k++;
                // console.log('will send');
                // console.log('will send msg', nextOp);
              }
            }
            let s = new Date() - t;
            if (s > max) { max = s; }
            if (s < max) { min = s; }
            consumerChannel.ack(ctx);
          })
        }, {noAck: false});
      })
    });
  });
}


/**
 * Consumes a flow's node, executing a serial DFS
 * @param  {[type]}   stack [description]
 * @param  {[type]}   graph [description]
 * @param  {[type]}   msg   [description]
 * @return {Promise}        [description]
 */
function next(stack, graph, msg) {
  return new Promise((resolve, reject) => {
    if (stack.length == 0) {
      return resolve(msg);
    }

    const at = stack.pop();
    const node = graph.nodes[at];
    if (node == undefined) {
      console.error("failed to find", at);
    }

    handle(node, msg).then((outputMessage) => {
      // TODO - this iterates the graph serially
      stack.push.apply(stack, node.wires);
      resolve(next(stack, graph, outputMessage[0]));
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

  // let graph = parseFlow(flow);
  let stack = Object.keys(graph.heads).slice();

  next(stack, graph, msg, null).then((msg) => {
    doneCount++;
    if (doneCount == willCount) {
      console.log('sucess!', willCount, doneCount);
    }
  });
}

function begin(msg) {
  amqp.connect('amqp://amqp', function(err, conn) {
    if (err) {
      console.log('failed to connect', err);
    }

    conn.createChannel(function(err, ch) {
      if (err) {
        console.log('failed to create channel', err);
      }

      let q = 'task_queue';
      ch.assertQueue(q, {durable: false});

      let start = new Date();
      for (let i = 0; i < 10; i++) {
        for (let n in graph.heads) {
          willCount++;
          let nextOp = { msg: {i: i}, node: n, flow: graph.id }
          // console.log('will send event', nextOp);
          ch.sendToQueue(q, new Buffer(JSON.stringify(nextOp)), {persistent: false});
        }
      }
      console.log('took %dms to send events', new Date() - start);
    });
  });
}

let data = JSON.parse(fs.readFileSync("test.json"));
let graph = parseFlow(data);
let doneCount = 0;
let willCount = 0;

// init_worker();
// begin({});

for (let i = 0; i < 100; i++) {
  willCount++;
  main({flow: data, msg: {i: i}});
}
