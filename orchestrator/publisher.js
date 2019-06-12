var util = require('util');
const logger = require("@dojot/dojot-module-logger").logger;

class Publisher {
  constructor(kafka, subject, tenant) {
    this.kafkaMessenger = kafka;
    this.subject = subject;
    this.tenant = tenant;
  }

  publish(message) {
    if (this.tenant === message.metadata.tenant) {
      logger.debug(`will produce ${util.inspect(message, { depth: null })} to ${this.subject}:${this.tenant}`, { filename: 'publisher' });
      this.kafkaMessenger.publish(this.subject, this.tenant, JSON.stringify(message));
    }
    else {
      logger.error(`Message ${message} will be discarded.  
        Tenant doesn't match! (expected: ${this.tenant} - received: ${message.data.tenant})`,
        { filename: 'publisher' });
    }
  }
}

module.exports = Publisher;
