"use strict";

var amqp = require('./amqp');
var config = require('./config');
var nodes = require('./nodeManager').Manager;
var logger = require("@dojot/dojot-module-logger").logger;

module.exports = class Executor {
    constructor(contextHandler) {
        logger.debug(`Initializing executor...`, {filename:"executor"});
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
            logger.error("Received event is not valid JSON. Ignoring", {filename:"executor"});
            return ack();
        }

        const at = event.flow.nodeMap[event.hop];
        // sanity check on received hop
        if (!at.hasOwnProperty('type')) {
            logger.error(`Node execution failed. Missing node type. Aborting flow ${event.flow.id}.`, {filename:"executor"});
            // TODO notify alarmManager
            return ack();
        }

        logger.debug(`Will handle node ${at.type}`, {filename:"executor"});
        let handler = nodes.getNode(at.type, event.metadata.tenant);
        if (handler) {
            let metadata = {
                flowId: event.flow.id,
                tenant: event.metadata.tenant,
                originatorDeviceId: event.metadata.originator
            }
            handler.handleMessage(at, event.message, (error, result) => {
                if (error) {
                    logger.error(`Node execution failed. ${error}. Aborting flow ${event.flow.id}.`, {filename:"executor"});
                    // TODO notify alarmManager
                    return ack();
                }

                logger.debug(`Hop (${at.type}) result: ${JSON.stringify(result)}`, {filename:"executor"});
                for (let output = 0; output < at.wires.length; output++) {
                    let newEvent = result[output];
                    if (newEvent) {
                        for (let hop of at.wires[output]) {
                            // event that are being processed must use
                            // the maximum priority, in this way new
                            // coming event will need to wait until
                            // the previous being processed
                            this.producer.sendMessage(JSON.stringify({
                                hop: hop,
                                message: newEvent,
                                flow: event.flow,
                                metadata: event.metadata
                            }), 1);
                        }
                    }
                }
                return ack();
            }, metadata, this.contextHandler);
        } else {
            logger.error(`Unknown node ${at.type} detected. Igoring.`, {filename:"executor"});
            return ack();
        }
    }
};
