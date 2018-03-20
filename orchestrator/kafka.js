var kafka = require("kafka-node");
var axios = require("axios");
var uuid = require("uuid/v4");
var config = require('./config');

function getRandom() {
  return Math.floor(Math.random() * 10000);
}

function getToken(tenant) {
  const payload = { 'service': tenant, 'username': 'flowbroker' };
  return (new Buffer('jwt schema').toString('base64')) + '.'
          + (new Buffer(JSON.stringify(payload)).toString('base64')) + '.'
          + (new Buffer('dummy signature').toString('base64'));
}

class TopicManager {
  constructor() {
    this.topics = {};
  }

  getTopic(subject, tenant, broker, global) {
    const parsedBroker = broker || config.dataBroker.url;
    const parsedGlobal = global ? "?global=true" : "";
    const key = tenant + ':' + subject;
    return new Promise((resolve, reject) => {
      if (this.topics.hasOwnProperty(key)) {
        return resolve(this.topics[key]);
      }

      axios({
        'url': parsedBroker + '/topic/' + subject + parsedGlobal,
        'method': 'get',
        'headers': { 'authorization': 'Bearer ' + getToken(tenant) }
      }).then((response) => {
        this.topics[key] = response.data.topic;
        resolve(response.data.topic);
      }).catch((error) => {
        reject(error);
      })
    })
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

    tm.getTopic(this.subject, this.tenant, this.brokerManager, this.global).then((topic) => {
      this.consumer = new kafka.ConsumerGroup(config.kafka, topic);
      let cb = this.callbacks.pop();
      while (cb) {
        this.on(cb.event, cb.callback);
        cb = this.callbacks.pop();
      }
      console.log('[kafka] Created consumer (%s)[%s : %s]', config.kafka.groupId, this.subject, topic)

    }).catch((error) => {
      console.error("[kafka] Failed to acquire topic to subscribe from (device events)\n", error);
      process.exit(1);
    })
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
  constructor(brokerManager, broker) {
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

    let scheduled = null;
    this.producer.on("error", (e) => {
      if (scheduled) {
        console.log("[kafka] An operation was already scheduled. No need to do it again.");
        return;
      }

      this.producer.close();
      console.error("[kafka] Producer error: ", e);
      console.log("[kafka] Will attempt to reconnect in a few seconds.");
      scheduled = setTimeout(() => {
        this.initDataProducer();
      }, 10000);
    });
  }

  /**
   * Sends an event to a given subject of a tenant
   * @param  {[type]} tenant    Tenant to whom event is concerned
   * @param  {[type]} subject   Subject which event belongs to
   * @param  {[type]} eventData Event to be sent
   */
  sendEvent(tenant, subject, eventData) {
    if (this.isReady == false) {
      console.error('[kafka] Producer is not ready yet');
      return;
    }

    tm.getTopic(subject, tenant, this.brokerManager, false).then((topic) => {
      let message = {
        "topic": topic,
        "messages": [JSON.stringify(eventData)]
      };

      this.producer.send([message], (err, result) => {
        if (err) {
          console.error("[kafka] Failed to publish data", err);
        }
      });
    }).catch((error) => {
      console.error("[iota] Failed to ascertain topic for event", error)
    })
  }
}

module.exports = { 'Consumer': Consumer, 'Producer': Producer };
