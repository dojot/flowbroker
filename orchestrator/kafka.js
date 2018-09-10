'use strict';

var kafka = require("kafka-node");
var axios = require("axios");
var auth = require('./auth');
var config = require('./config');

class TopicManager {
    constructor() {
        this.topics = {};
    }

    getTopic(subject, tenant, broker, global) {
        const parsedBroker = broker || config.dataBroker.url;
        const parsedGlobal = global ? "?global=true" : "";
        const key = tenant + ':' + subject;

        if (this.topics.hasOwnProperty(key)) {
            return Promise.resolve(this.topics[key]);
        }

       return axios({
            'url': parsedBroker + '/topic/' + subject + parsedGlobal,
            'method': 'get',
            'headers': { 'authorization': 'Bearer ' + auth.getToken(tenant) }
        })
        .then((response) => {
            this.topics[key] = response.data.topic;
            return response.data.topic;
        });
    }
}
var tm = new TopicManager();

class Consumer {
    /**
     * [constructor description]
     * @param {[string]} tenant        Tenant which devices will be monitored
     * @param {[string]} brokerManager If omitted takes the default "http://data-broker:80"
     * @param {[string]} subject       If omitted takes the default "dojot.device-manager.device"
     */
    constructor(tenant, subject, global, brokerManager) {
        this.tenant = tenant;
        this.subject = subject;
        this.global = global || false;
        this.brokerManager = brokerManager || config.dataBroker.url;
        this.callbacks = [];
        this.topic = "";

        tm.getTopic(this.subject, this.tenant, this.brokerManager, this.global).then((topic) => {
            this.topic = topic;
            this.initConsumer();
        }).catch((error) => {
            console.error("[kafka] Failed to acquire topic to subscribe from (device events)\n", error);
            process.exit(1);
        });
    }

    initConsumer() {
        this.consumer = new kafka.ConsumerGroup(config.kafka, this.topic);
        console.log('[kafka] Created consumer (%s)[%s : %s]', config.kafka.groupId, this.subject, this.topic);

        let cb = this.callbacks.pop();
        while (cb) {
            this.on(cb.event, cb.callback);
            cb = this.callbacks.pop();
        }

        this.consumer.on('error', (e) => {
            this.consumer.close();
            console.error("[kafka] Consumer error: ", e.message);
            process.exit(1);
        });
    }

    on(event, callback) {
        if (this.consumer) {
            this.consumer.on(event, callback);
        } else {
            // consumer was not ready yet when call was issued
            this.callbacks.push({ 'event': event, 'callback': callback });
        }
    }
}

class Producer {
    constructor(brokerManager) {
        this.topics = {};

        this.brokerManager = brokerManager || config.dataBroker.url;

        this.isReady = false;
        this.initProducer();
    }

    initProducer(callback) {
        let client = new kafka.KafkaClient(config.kafka);
        this.producer = new kafka.Producer(client, { requireAcks: 1 });

        this.producer.on('ready', () => {
            console.log("[kafka] Producer ready");
            this.isReady = true;
            if (callback) {
                callback();
            }
        });

        this.producer.on("error", (e) => {
            this.producer.close();
            console.error("[kafka] Producer error: ", e.message);
            process.exit(1);
        });
    }

    /**
     * Sends an event to a given subject of a tenant
     * @param  {[type]} tenant    Tenant to whom event is concerned
     * @param  {[type]} subject   Subject which event belongs to
     * @param  {[type]} eventData Event to be sent
     */
    sendEvent(tenant, subject, eventData) {
        if (this.isReady === false) {
            console.error('[kafka] Producer is not ready yet');
            return;
        }

        tm.getTopic(subject, tenant, this.brokerManager, false).then((topic) => {
            let message = {
                "topic": topic,
                "messages": [JSON.stringify(eventData)]
            };

            this.producer.send([message], (err) => {
                if (err) {
                    console.error("[kafka] Failed to publish data", err);
                }
            });
        }).catch((error) => {
            console.error("[iota] Failed to ascertain topic for event", error);
        });
    }
}

module.exports = { 'Consumer': Consumer, 'Producer': Producer };
