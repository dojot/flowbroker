'use strict';

var config = require('./config');
const { calculateQueue } = require('./util');
const logger = require("@dojot/dojot-module-logger").logger;
if (logger.setLevel(config.logging.level) !== 0) {
  logger.error(`Invalid logger level: ${config.logging.level}`);
  process.exit(1);
}

var fs = require("fs");
var ArgumentParser = require('argparse').ArgumentParser;

var FlowManagerBuilder = require('./flowManager').FlowManagerBuilder;
var amqp = require('./amqp');
var MongoManager = require('./mongodb');
var APIHandler = require('./api');
var Ingestor = require('./ingestor');
var Executor = require('./executor');
var ContextManagerClient = require('@dojot/flow-node').ContextManagerClient;
var ContextHandler = require('@dojot/flow-node').ContextHandler;

var dojotModule = require("@dojot/dojot-module");

var healthCheck = require('./healthcheck');

process.on('unhandledRejection', (reason) => {

  //if this reason dont kill because it was handled on amqp.js
  if (reason === 'Cannot connect to RabbitMQ'){
    return
  }
  logger.error(`Unhandled Rejection at: ${reason.stack || reason}. Bailing out!!`);
  process.kill(process.pid, "SIGTERM");
});

process.on('uncaughtException', (ex) => {
  logger.error(`Unhandled Exception at: ${ex.stack || ex}. Bailing out!!`);
  process.kill(process.pid, "SIGTERM");
});

function logAndKill(error) {
  logger.error(`[flowbroker] Initialization failed. Error: ${error}`);
  process.kill(process.pid, "SIGTERM");
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
  {
    help: 'Load flow definition from file. FLOW must be a valid JSON file, ' +
      'containing a valid node-red flow'
  });
parser.addArgument(['-m', '--message'],
  { help: 'Event that should trigger a flow execution run.' });
parser.addArgument(['-d', '--device'], { help: 'Device that generated the event.' });
parser.addArgument(['-t', '--template'], { help: 'Device template that generated the event.' });
parser.addArgument(['-s', '--server'], { help: 'Run as a daemon service (production)', action: "storeTrue" });
parser.addArgument(['-i', '--kill-idle'],
  {
    help: 'If no more events are generaed within KILL_IDLE milliseconds, kill ' +
      'the process'
  });
parser.addArgument(['-v', '--verbose'], { action: 'storeTrue' });
var args = parser.parseArgs();

if (logger.setLevel(config.logging.level) !== 0) {
  logger.error(`Invalid logger level: ${config.logging.level}`);
  process.exit(1);
}

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
//instantiate n executors and producers, passing the executor number as a parameter,
//to be used as a suffix of the rabbitmq queue name
let taskQueueN = config.amqp.task_queue_n;

let hasMessages = false;
if (args.message && args.device) {
  let message = null;
  try {
    message = JSON.parse(args.message);
  } catch (e) {
    if (e instanceof SyntaxError) {
      logAndKill(new Error("Given message is not in valid JSON format:" + e));
    }
  }

  let producer = [];
  try {
    //create a number of queues to produce on rabbitmq
    for (let i = 0; i < taskQueueN; i++) {
      producer.push(new amqp.AMQPProducer(config.amqp.task_queue_prefix + i, config.amqp.url, 2));
    }
  } catch (error) {
    logAndKill(error);
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
        //calculates based on the device id in which queue
        // processing should take place in rabbitmq
        const queue = calculateQueue(args.device, taskQueueN)
        producer[queue].sendMessage(JSON.stringify({
          msg: message,
          node: node,
          flow: flow.id
        }), 0);
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
  logAndKill(error);
};

let contextManagerClient = new ContextManagerClient(
  config.contextManager.contextManagerAddress,
  config.contextManager.contextManagerPort,
  config.contextManager.responseTimeout);

contextManagerClient.init();

let contextHandler = new ContextHandler(contextManagerClient);


for (let i = 0; i < taskQueueN; i++) {
  let exec = new Executor(contextHandler, i);
  exec.init().then(loggerCallback).catch(errorCallback);
}

// Kafka listeners and writers
var kafkaMessenger = new dojotModule.Messenger("flowbroker", config.kafkaMessenger);

// Initializes kafka listeners ...
logger.debug("Initializing kafka messenger ...");
kafkaMessenger.init().then(() => {
  logger.info("... Kafka messenger was successfully initialized.");

  // read:  new tenants for updating flow nodes
  logger.debug("Creating r-only channel for tenancy subject...");
  kafkaMessenger.createChannel(
    config.kafkaMessenger.dojot.subjects.tenancy, "r", true /*global*/);
  logger.debug("... r-only channel for tenancy was created.");

  // read:  device events for updating local cache
  // write: actuation
  logger.debug("Creating r+w channel for device-manager subject...");
  kafkaMessenger.createChannel(config.kafkaMessenger.dojot.subjects.devices, "rw");
  logger.debug("... r+w channel for device-manager was created.");

  // read:  device data to trigger the flows
  // write: virtual device
  logger.debug("Creating r+w channel for device-data subject...");
  kafkaMessenger.createChannel(config.kafkaMessenger.dojot.subjects.deviceData, "rw");
  logger.debug("... r+w channel for device-data was created.");

  // chain other initialization steps
  return MongoManager.get();
}).then((client) => {
  let FlowManager = new FlowManagerBuilder(client);
  healthCheck.init(kafkaMessenger, FlowManager);
  APIHandler.init(FlowManager, healthCheck.get());
  let ingestor = new Ingestor(FlowManager, kafkaMessenger);
  return ingestor.init();
}).catch((error) => {
  logAndKill(error);
});
