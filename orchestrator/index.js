'use strict';

var fs = require("fs");
var ArgumentParser = require('argparse').ArgumentParser;

const operationQueue = 'task_queue';

var FlowManager = require('./flowManager');
var Executor = require('./executor');

let flows = new FlowManager();
let producer = new Executor.AMQPProducer(operationQueue);

class IdleManager {
  constructor(interval) {
    this.last = undefined;
    this.watchdog = undefined;
    this.interval = interval;
  }

  ping() {
    this.last = new Date();
    if (!this.watchdog) {
      this.watchdog = setInterval(() => {
        const now = new Date();
        if ((now - this.last) > this.interval) {
          console.log('Process has been idle for too long. Exiting.');
          process.exit(0);
        }
      });
    }
  }
}

var idle = undefined;

function initHandler() {
  let hopHandler = new Executor.AMQPConsumer(operationQueue, (data, ack) => {
    try {
      if (idle) {
        idle.ping();
      }

      const hop = JSON.parse(data);

      const flow = flows.get(hop.flow);
      const nodeConfig = flow.nodes[hop.node];
      if (nodeConfig == undefined) {
        throw new Error("Invalid node (%s) operation received - node not found in flow", hop.node);
      }

      if (args.verbose){
        console.log('handled hop [%s:%s] %s', hop.flow, hop.node, JSON.stringify(hop.msg));
      }

      ack();

      for (let idx = 0; idx < nodeConfig.wires.length; idx++) {
        let nextOp = {
          msg: hop.msg,
          node: nodeConfig.wires[idx],
          flow: hop.flow
        }

        producer.sendMessage(JSON.stringify(nextOp));
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        console.error("Received event was not valid json. Ignoring.");
        // remove from queue
        ack();
        return;
      } else {
        console.log("Failed to process hop: %s\n", e, e.stack);
        return;
      }
    }
  });
}

let parser = new ArgumentParser({});
parser.addArgument(['-f', '--flow']);
parser.addArgument(['-m', '--message']);
parser.addArgument(['-d', '--device']);
parser.addArgument(['-t', '--template']);
parser.addArgument(['-s', '--server']);
parser.addArgument(['-i', '--kill-idle']);
parser.addArgument(['-w', '--workers'], {defaultValue: 3});
parser.addArgument(['-v', '--verbose'], {action: 'storeTrue'});
var args = parser.parseArgs();

if (args.flow) {
  const rawFlow = JSON.parse(fs.readFileSync(args.flow))
  const parsed = flows.set(rawFlow);
}

if (args.kill_idle) {
  if (args.server) {
    console.log("--kill-idle cannot be used together with --server");
    process.exit(1);
  }

  idle = new IdleManager(args.kill_idle);
}

let hasMessages = false;
if (args.message && args.device) {
  let message = null;
  try {
    message = JSON.parse(args.message)
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error("Given message is not in valid JSON format:" + e);
      process.exit(1);
    }
  }

  let triggeredFlows = [];
  if (args.device) {
    triggeredFlows = flows.getByDevice(args.device);
  } else if (args.template) {
    triggeredFlows = flows.getByTemplate(args.template);
  } else {
    // invalid command
    console.log("Message can only be used with either [-m | --message] or [-t | --template]");
    process.exit(1);
  }

  hasMessages = triggeredFlows.length > 0;
  for (let flow of triggeredFlows) {
    for (let node in flow.heads) {
      producer.sendMessage(JSON.stringify({msg: message, node: node, flow: flow.id}));
    }
  }
}

if (!args.server && !hasMessages) {
  console.log('Nothing to do: run with either [-s] or [-f <flow> -m <message> [-d <device> | -t <template>]]')
  process.exit(0);
}

for (let i = 0; i < args.workers; i++) {
  initHandler();
}
