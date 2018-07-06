'use strict';

var fs = require("fs");
var logger = require('./logger').logger;

var ArgumentParser = require('argparse').ArgumentParser;

var config = require('./config');
var FlowManagerBuilder = require('./flowManager').FlowManagerBuilder;
var amqp = require('./amqp');
var MongoManager = require('./mongodb');
var APIHandler = require('./api');
var Ingestor = require('./ingestor');
var Executor = require('./executor');
var ContextManagerClient = require('@dojot/flow-node').ContextManagerClient;
var ContextHandler = require('@dojot/flow-node').ContextHandler;

function fail(error) {
  logger.error('[flowbroker] Initialization failed.', error.message);
  process.exit(1);
}

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
          logger.info('Process has been idle for too long. Exiting.');
          process.exit(0);
        }
      });
    }
  }
}

let parser = new ArgumentParser({
  description: "Flow manager and executor for dojot"
});
parser.addArgument(['-f', '--flow'],
                   {help:'Load flow definition from file. FLOW must be a valid JSON file, ' +
                         'containing a valid node-red flow'});
parser.addArgument(['-m', '--message'],
                   {help:'Event that should trigger a flow execution run.'});
parser.addArgument(['-d', '--device'], {help:'Device that generated the event.'});
parser.addArgument(['-t', '--template'], {help:'Device template that generated the event.'});
parser.addArgument(['-s', '--server'], {help:'Run as a daemon service (production)', action: "storeTrue"});
parser.addArgument(['-i', '--kill-idle'],
                   {help:'If no more events are generaed within KILL_IDLE milliseconds, kill ' +
                         'the process'});
parser.addArgument(['-w', '--workers'],
                   {
                      defaultValue: 3,
                      help: 'Number of workers (AMQP consumers) to spawn. This has a direct effect ' +
                             'on the amount of messages per second a broker instance is able to ' +
                             'handle'
                   });
parser.addArgument(['-v', '--verbose'], {action: 'storeTrue'});
var args = parser.parseArgs();

if (args.flow) {
  var flows = FlowManagerBuilder.get("admin");
  var rawFlow = JSON.parse(fs.readFileSync(args.flow));
  flows.set(rawFlow);
}

if (args.kill_idle) {
  if (args.server) {
    logger.info("--kill-idle cannot be used together with --server");
    process.exit(1);
  }

  new IdleManager(args.kill_idle);
}

let hasMessages = false;
if (args.message && args.device) {
  let message = null;
  try {
    message = JSON.parse(args.message);
  } catch (e) {
    if (e instanceof SyntaxError) {
      fail(new Error("Given message is not in valid JSON format:" + e));
    }
  }

  let producer;
  try {
    producer = new amqp.AMQPProducer(config.amqp.queue);
  } catch (error) {
    fail(error);
  }

  let triggeredFlows = [];
  if (args.device) {
    triggeredFlows = flows.getByDevice(args.device);
  } else if (args.template) {
    triggeredFlows = flows.getByTemplate(args.template);
  } else {
    // invalid command
    logger.info("Message can only be used with either [-m | --message] or [-t | --template]");
    process.exit(1);
  }

  hasMessages = triggeredFlows.length > 0;
  for (let flow of triggeredFlows) {
    for (let node in flow.heads) {
      if (flow.heads.hasOwnProperty(node)) {
        producer.sendMessage(JSON.stringify({
          msg: message,
          node: node,
          flow: flow.id
        }));
      }
    }
  }
}

if (!args.server && !hasMessages) {
  logger.info('Nothing to do: run with either [-s] or [-f <flow> -m <message> [-d <device> | -t <template>]]');
  process.exit(0);
}

let loggerCallback = () => {
  logger.info(`[executor] Worker ready.`);
};

let errorCallback = (error) => {
  fail(error);
};

let contextManagerClient = new ContextManagerClient(
  config.contextManager.contextManagerAddress,
  config.contextManager.contextManagerPort,
  config.contextManager.responseTimeout);

contextManagerClient.init();

let contextHandler = new ContextHandler(contextManagerClient);

for (let i = 0; i < args.workers; i++) {
  let exec = new Executor(contextHandler);
  exec.init().then(loggerCallback).catch(errorCallback);
}

if (args.server) {
  try {
    MongoManager.get().then((client) => {
      let FlowManager = new FlowManagerBuilder(client);
      APIHandler.init(FlowManager);
      let ingestor = new Ingestor(FlowManager);
      ingestor.initConsumer();
    }).catch((error) => {
      fail(error);
    });
  } catch (error) {
    fail(error);
  }
}
