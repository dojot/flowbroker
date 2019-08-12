"use strict";

var amqp = require('./amqp');
var config = require('./config');
var nodes = require('./nodeManager').Manager;
var logger = require("@dojot/dojot-module-logger").logger;

module.exports = class Executor {
    constructor(contextHandler) {
        logger.debug('[executor] initializing ...');
        this.hop = this.hop.bind(this);
        this.producer = new amqp.AMQPProducer(config.amqp.queue, config.amqp.url, 2);
        this.consumer = new amqp.AMQPConsumer(config.amqp.queue, this.hop, config.amqp.url, 2);
        this.contextHandler = contextHandler;
    }

    init() {
        return this.producer
            .connect()
            .then(() => {
                this.consumer.connect();
            });
    }

    hop(data, ack) {
        let event;
        try {
            event = JSON.parse(data);
        } catch (error) {
            logger.warn("[amqp] Received event is not valid JSON. Ignoring");
            return ack();
        }

        const at = event.flow.nodeMap[event.hop];
        // sanity check on received hop
        if (!at.hasOwnProperty('type')) {
            logger.warn(`[executor] Node execution failed. Missing node type. Aborting flow ${event.flow.id}.`);
            // TODO notify alarmManager
            return ack();
        }

        logger.debug(`[executor] will handle node ${at.id}:${at.type}`);
        let handler = nodes.getNode(at.type, event.metadata.tenant);
        if (handler) {
            let metadata = {
                flowId: event.flow.id,
                tenant: event.metadata.tenant,
                originatorDeviceId: event.metadata.originator,
                timestamp: event.metadata.timestamp,
            };
            let handleMessagePromise = handler.handleMessage(at, event.message, metadata, this.contextHandler);

            const handleMessageTimeoutPromise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    return reject(`timeout`);
                }, config.taskProcessing.taskTimeout);
            });

            Promise.race([handleMessagePromise, handleMessageTimeoutPromise])
                .then((result) => {
                    logger.debug(`[executor] hop (${at.type}) result: ${JSON.stringify(result)}`);
                    let sendMsgPromises = [];
                    for (let output = 0; output < at.wires.length; output++) {
                        let newEvent = result[output];
                        if (newEvent) {
                            for (let hop of at.wires[output]) {
                                // event that are being processed must use
                                // the maximum priority, in this way new
                                // coming event will need to wait until
                                // the previous being processed
                                let sendMsgPromise = this.producer.sendMessage(JSON.stringify({
                                    hop: hop,
                                    message: newEvent,
                                    flow: event.flow,
                                    metadata: event.metadata
                                }), 1);

                                let reflectPromise = sendMsgPromise.then(r => ({isFulfilled: true, data: r})).catch(r => ({isFulfilled: false, data: r}));
                                sendMsgPromises.push(reflectPromise);
                            }
                        }
                    }
                    return Promise.all(sendMsgPromises).then((promises) => {
                        for (let i = 0; i < promises.length; i++) {
                            if (!(promises[i].isFulfilled)) {
                                logger.error(`[executor] Failed to sent message to the next task. Error: ${error}. Aborting flow ${event.flow.id} branch execution at node ${at.id}.`);
                            }
                        }
                        return ack();
                    }).catch((error) => {
                        logger.error(`[executor] Node (${at.id}:${at.type}) excution failed. Error: ${error}. Aborting flow ${event.flow.id} branch execution.`);
                        return ack();
                    });
                }).catch((error) => {
                    logger.warn(`[executor] Node (${at.id}:${at.type}) execution failed. Error: ${error}. Aborting flow ${event.flow.id} branch execution.`);
                    // TODO notify alarmManager
                    return ack();
                });
        } else {
            logger.warn(`[executor] Unknown node (${at.id}:${at.type}) detected. Igoring. Aborting flow ${event.flow.id} branch execution.`);
            return ack();
        }
    }
};
