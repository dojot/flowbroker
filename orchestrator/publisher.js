var util = require('util');

class Publisher {
  constructor(kafka, subject, tenant) {
    this.kafkaMessenger = kafka;
    this.subject = subject;
    this.tenant = tenant;
  }

  publish(message) {
    console.log(typeof message);
    if (this.tenant === message.metadata.tenant) {
      console.log(`will produce ${util.inspect(message, { depth: null })} to ${this.subject}:${this.tenant}`);
      this.kafkaMessenger.publish(this.subject, this.tenant, JSON.stringify(message));
    }
    else {
      console.error(`Message ${message} will be discarded.  
      Tenant doesn't match! (expected: ${this.tenant} - received: ${message.data.tenant})`);
    }
  }
}

module.exports = Publisher;
