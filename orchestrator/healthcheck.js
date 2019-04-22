"use strict";

const os = require('os');
const pjson = require('./package.json');
const config = require('./config');
const HealthChecker = require('@dojot/healthcheck').HealthChecker;
const DataTrigger = require('@dojot/healthcheck').DataTrigger;

// Kafka Messenger
var kafkaMessenger = null; // initialized at init()
var flowManager = null;    // initialized at init()

//health checker
const healthCheckerConfig = {
    description: 'health of flowbroker-orchestrator',
    version: pjson.version,
    status: 'pass'
};

const healthChecker = new HealthChecker(healthCheckerConfig);

// uptime
const uptime = {
    measurementName: 'uptime',
    componentType: 'system',
    observedUnit: 's',
    status: 'pass'
};

const uptimeCollector = (trigger = DataTrigger) => {
    let value = Math.floor(process.uptime());
    trigger.trigger(value, 'pass');
    return value;
};

healthChecker.registerMonitor(uptime, uptimeCollector,
    config.healthChecker.timeout.uptime);

// memory:utilization
const memory = {
    componentName: 'memory',
    componentType: 'system',
    measurementName: 'utilization',
    observedUnit: 'percent',
    status: 'pass'
}

const memoryCollector = (trigger = DataTrigger) => {
    let tmem = os.totalmem();
    let fmem = os.freemem();
    let pmem = (100 - (fmem/tmem)*100).toFixed(2);
    if (pmem > 75) {
        trigger.trigger(pmem, 'warn');
    }
    else {
        trigger.trigger(pmem, 'pass');
    }
    return pmem;
};

healthChecker.registerMonitor(memory, memoryCollector,
    config.healthChecker.timeout.memory);

// cpu:utilization
const cpu = {
    componentName: 'cpu',
    componentType: 'system',
    measurementName: 'utilization',
    observedUnit: 'percent',
    status: 'pass'
}

const cpuCollector = (trigger = DataTrigger) => {
    let ncpu = os.cpus().length;
    let lcpu = os.loadavg()[1]; //last five minute
    let pcpu = (100 * lcpu/ncpu).toFixed(2);
    if (pcpu > 75) {
        trigger.trigger(pcpu, 'warn');
    }
    else {
        trigger.trigger(pcpu, 'pass');
    }
    return pcpu;
};

healthChecker.registerMonitor(cpu, cpuCollector,
    config.healthChecker.timeout.cpu);

// mongodb:connections
const mongodb = {
    componentName: 'mongodb',
    componentType: 'datastore',
    measurementName: 'connections',
    status: 'pass'
};

function getMongoStatus() {
    return new Promise((resolve, reject) => {
        let dbStatus = {
            connected: false
        };
        let isConnected = flowManager.client.isConnected();
        if (isConnected) {
            dbStatus.connected = true;

            let dbStatsPromises = [];
            for (let tenant of Object.keys(flowManager.instance)) {
                dbStatsPromises.push(flowManager.instance[tenant].collection.stats());
            }
            Promise.all(dbStatsPromises).then(allDbStats => {
                dbStatus.details = allDbStats;
                resolve(dbStatus);
            }).catch(error => {
                reject(new Error(`Internal error while getting database status.`));
            });
        }
        else {
            resolve(dbStatus);
        }

    });
}

const mongodbCollector = (trigger = DataTrigger) => {
    return getMongoStatus().then(status => {
        if (status.connected) {
            trigger.trigger(1 /*one connection */, 'pass');
        }
        else {
            trigger.trigger(0 /* zero connection */, 'fail');
        }
    }).catch(error => {
        trigger.trigger(0 /* zero connection */, 'fail', error);
    });
};

healthChecker.registerMonitor(mongodb, mongodbCollector,
    config.healthChecker.timeout.mongodb);

// kafka:connections
const kafka = {
    componentName: 'kafka',
    componentType: 'datastore',
    measurementName: 'connections',
    status: 'pass'
};

function getKafkaStatus() {
    return new Promise((resolve, reject) => {
        let kafkaStatus = {
            connected: false
        };

        // It can be the consumer or the producer because the returned value is the same.
        kafkaMessenger.consumer.consumer.getMetadata({timeout: 3000},
            (error, metadata) => {
                if (error) {
                     reject(new Error('Internal error while getting kafka metadata.'));
                }
                else {
                    kafkaStatus.connected = true;
                    kafkaStatus.details = {
                            metadata: metadata
                    };
                    resolve(kafkaStatus);
                }
          });
    });
}

const kafkaCollector = (trigger = DataTrigger) => {
    return getKafkaStatus().then(status => {
        if (status.connected) {
            trigger.trigger(1 /*one connection */, 'pass');
        }
        else  {
            trigger.trigger(0 /* zero connection */, 'fail');
        }
    }).catch(error => {
        trigger.trigger(0 /* zero connection */, 'fail', error);
    });
};

healthChecker.registerMonitor(kafka, kafkaCollector,
    config.healthChecker.timeout.kafka);

// TODO
// rabbitmq:connections
// redis:connections

module.exports = {
    init: (kafka, flowmgr) => {
        kafkaMessenger = kafka;
        flowManager = flowmgr;
    },
    get: () => {
        return healthChecker;
    }
  };