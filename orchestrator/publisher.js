var logger = require("@dojot/dojot-module-logger").logger;

const TAG={filename: "publisher"};

class Publisher {
  constructor(kafka, subject, tenant) {
    this.kafkaMessenger = kafka;
    this.subject = subject;
    this.tenant = tenant;
  }

  publish(message) {
    logger.debug(`Publishing a message...`, TAG);
    if (this.tenant === message.metadata.tenant) {
      logger.debug(`Producing ${message} to ${this.subject}:${this.tenant}...`, TAG);
      this.kafkaMessenger.publish(this.subject, this.tenant, JSON.stringify(message));
      logger.debug(`... message was published.`, TAG);
    }
    else {
      logger.error(`Message ${message} will be discarded.
      Tenant doesn't match! (expected: ${this.tenant} - received: ${message.data.tenant})`, TAG);
    }
  }
}

module.exports = Publisher;
