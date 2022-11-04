const dojotModule = require("@dojot/dojot-module");
const tenantService = require("../tenant-service");
const logger = require("@dojot/dojot-module-logger").logger;
const TAG = { filename: "messenger" };

class KafkaMessegerV2 extends dojotModule.Messenger {
  constructor(name, config, topicManagerV2){
    super(name, config);
    this.topicManager = topicManagerV2;
  }

  async init() {
    let connectConsumerFn = (resolve, reject, client, counter) => {
      client.connect().then(() => {
        logger.info(`Kafka client connected`, TAG);
        return resolve();
      }).catch((error) => {
        logger.warn(`Could not connect Kafka client: ${error}`, TAG);
        logger.warn(`Trying it again in ${this.config.kafka.dojot.timeoutSleep} seconds.`, TAG);
        counter--;
        logger.debug(`Remaining ${counter} times`, TAG);
        if (counter > 0) {
          setTimeout(() => connectConsumerFn(resolve, reject, client, counter), this.config.kafka.dojot.timeoutSleep);
        } else {
          return reject(`Could not connect Kafka consumer: ${error}`);
        }
      });
    };

    // Wait for all consumers to connect to Kafka brokers.
    const counter = this.config.kafka.dojot.connectionRetries;
    logger.debug("Connecting Kafka producer...", TAG);
    await new Promise((resolve, reject) => { connectConsumerFn(resolve, reject, this.producer, counter); });
    logger.debug("... Kafka producer successfully connected.", TAG);
    logger.debug("Connecting Kafka consumer for tenancy data...", TAG);
    await new Promise((resolve, reject) => { connectConsumerFn(resolve, reject, this._tenancyConsumer, counter); });
    logger.debug("... Kafka consumer for tenancy data successfully connected.", TAG);
    logger.debug("Connecting Kafka consumer for common messages...", TAG);
    await new Promise((resolve, reject) => { connectConsumerFn(resolve, reject, this.consumer, counter); });
    logger.debug("... Kafka consumer for common messages successfully connected.", TAG);
    await this._initTenancyConsumer();
    let tenants = await tenantService.getTenantList();
    logger.info(`Retrieved list of tenants: ${tenants}.`);
    for (const tenant of tenants) {
      const tenantObj = { type: this.config.dojot.events.tenantActionType.CREATE, tenant: tenant };
      logger.info(`Bootstrapping tenant ${JSON.stringify(tenantObj)}...`, TAG);
      this._processNewTenant(tenant, tenantObj);
      logger.info(`... ${tenant} bootstrapped.`, TAG);
    }
    logger.info(`Finished tenant bootstrapping.`, TAG);
  }
}

module.exports = KafkaMessegerV2;