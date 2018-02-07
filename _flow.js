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

var rMin = 0;
var rMax = 0;

 /**
  * Execute individual processing node, with given configuration
  * @param  {[type]} node node configuration to be used within invocation
  * @param  {[type]} msg  message that triggered the invocation
  * @return {[type]}      [description]
  */
function handle(node, msg) {
  let ts = new Date();
  // TODO this is a dummy (tests only) implementation
  return new Promise((resolve, reject) => {
    // TODO we could be using a proper zmq async req-rep pattern
    let sock = zmq.socket('req');
    sock.on("message", function(reply) {
      // console.log('got reply', reply.toString());
      sock.close();
      // console.log('remote took %dms', new Date() - ts);
      let d = new Date() - ts;
      if (d < rMin) { rMin = d; }
      if (d > rMax) { rMax = d; }
      resolve(JSON.parse(reply.toString()));
    });

    // TODO proper validation of node.type as an address (or dns for that sake)
    sock.connect("tcp://" + node.type + ":5555");
    sock.send(JSON.stringify(msg));
  })
}

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

  let last = new Date();
  let nMsg = 0;
  let total = 0;
  let total_invoked = 0;
  let total_returned = 0;

  setInterval(() => {
    let now = new Date();
    let p = now - last;

    if ((total_returned == 0) && (total_invoked == 0)) {
      setTimeout(() => {
        console.log('success! rmin %dms rmax %dms %d', rMin, rMax, doneCount);
        console.log('finished processing in %dms', new Date() - start - 1000);
        process.exit(0);
      }, 100);
    }

    if (args.verbose) {
      console.log('Processed %d msg/s (done %d | %dms | inv %d | ret %d)...',
                  total_returned/(p/1000), nMsg, p, total_invoked, total_returned);
    }

    total += total_invoked;
    total_invoked = 0;
    total_returned = 0;
    last = now;
  }, 1000)

  amqp.connect('amqp://amqp', function(err, conn) {
    if (err) {
      console.log('failed to connect to amqp broker', err);
    }

    conn.createChannel(function(err, consumerChannel) {
      if (err) {
        console.error('failed to create channel', err);
      }

      let q = 'task_queue';
      consumerChannel.assertQueue(q, {durable: true});
      consumerChannel.prefetch(1);

      conn.createChannel((err, writerChannel) => {

        writerChannel.on('drain', () => {console.log('got drain event');})
        writerChannel.on('blocked', () => {console.log('got blocked event');})
        writerChannel.assertQueue('out_queue', {durable: true});

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

          // TEST - ack before sending
          consumerChannel.ack(ctx);

          total_invoked++;
          handle(nodeConfig, call.msg).then((results) => {
            total_returned++;
            let t = new Date();
            // console.log('handle returned');
            if (nodeConfig.wires.length == 0) {
              writerChannel.sendToQueue('out_queue', new Buffer(JSON.stringify(results)), {persistent: true});
              // console.log('no more proc. to do');
              doneCount++;
              nMsg++;
              // consumerChannel.ack(ctx);
              // if (doneCount == willCount) {
              //   console.log('success! rmin %dms rmax %dms', rMin, rMax);
              //   setTimeout(() => {
              //     process.exit(0);
              //   }, 100)
              // }
              if (doneCount == shouldCount) {
                console.log('finished processing in %dms', new Date() - start);
                if (args.verbose){
                  console.log('Result message', JSON.stringify(results, null, 2));
                }
                process.exit(0);
              }
              return;
            }

            // console.log('will proc results', results, nodeConfig);
            // results is an array of array of messages to queue up
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
                let res = writerChannel.sendToQueue(q, new Buffer(JSON.stringify(nextOp)), {persistent: true});
                if (res == false) {
                  console.error("failed to send message");
                }
                // console.log('will send');
                // console.log('will send msg', nextOp);
              }
            }
            let s = new Date() - t;
            if (s > max) { max = s; }
            if (s < max) { min = s; }
            // nMsg++;
            // consumerChannel.ack(ctx);
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
      // console.log('did handle', at);
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

  // const flow = params.flow || null;
  const msg = params.msg || null;
  // if ((flow == null) || (msg == null)) {
  //   return {_status: "invalid params"};
  // }

  const initialParams = {msg: msg};

  // let graph = parseFlow(flow);
  let stack = Object.keys(graph.heads).slice();

  // console.log('will call', stack);
  next(stack, graph, msg, null).then((msg) => {
    doneCount++;
    // console.log('flow done in %dms', new Date() - begin, msg);
    if (doneCount == willCount) {
      console.log('success! rmin %dms rmax %dms', rMin, rMax);
      console.log('finished processing in %dms', new Date() - start);
    }
  });
}

function begin(end) {
  amqp.connect('amqp://amqp', function(err, conn) {
    if (err) {
      console.log('failed to connect', err);
    }

    conn.createChannel(function(err, ch) {
      if (err) {
        console.log('failed to create channel', err);
      }

      let q = 'task_queue';
      ch.assertQueue(q, {durable: true});

      ch.on('drain', () => {console.log('got drain event');})
      ch.on('blocked', () => {console.log('got blocked event');})

      let start = new Date();
      let failures = 0;

      for (let i = 0; i < shouldCount; i++) {
        for (let n in graph.heads) {
          willCount++;
          let nextOp = { msg: {i: i}, node: n, flow: graph.id }
          // console.log('will send event', nextOp);
          let ret = ch.sendToQueue(q, new Buffer(JSON.stringify(nextOp)), {persistent: true});

          // even when this returns false, it seems that messages are (eventually?) taken up
          // by the broker.
          if (ret == false) {
            failures++;
            // console.error('failed to publish idx %d', i);
          } else {
            sentCount++;
          }
        }
      }
      console.log('took %dms to send %d events', new Date() - start, willCount);
      console.log('there were %d failures', failures);
      if ((end || false) && (sentCount == willCount)) {
        // this is needed because, for some reason the amqp driver is still in the process of
        // sending the messages *after* the call returns (and no callbacks or promises are returned)
        setTimeout(() => {conn.close();process.exit(0);}, 1000);
      }
    });
  });
}

var ArgumentParser = require('argparse').ArgumentParser;
let parser = new ArgumentParser({});
parser.addArgument(['-n', '--number'], {defaultValue: 1});
parser.addArgument(['-w', '--worker'], {defaultValue: 0});
parser.addArgument(['-p', '--producer'], {action: 'storeTrue'});
parser.addArgument(['-l', '--local'], {action: 'storeTrue'});
parser.addArgument(['-m', '--multi'], {action: 'storeTrue'});
parser.addArgument(['-v', '--verbose'], {action: 'storeTrue'});
var args = parser.parseArgs();

let data = JSON.parse(fs.readFileSync("test.json"));
let graph = parseFlow(data);
let doneCount = 0;
let sentCount = 0;
let willCount = 0;
let shouldCount = args.number;

console.log('done initial parsing');
let start = new Date();

// amqp routing
if (args.producer) {
  begin(true);
}

if (args.multi) {
  begin();
}

for (let i = 0; i < args.worker; i++) {
  init_worker();
}
if (args.worker) {
  console.log('%d amqp workers initialized', args.worker);
}


// promises stack
if (args.local){
  for (let i = 0; i < shouldCount; i++) {
    willCount++;
    main({flow: data, msg: {i: i}});
  }
}
