var kafka = require('./kafka');
var config = require('./config');

class Publisher {
  constructor(subject) {
    this.producer = new kafka.Producer();
    this.producer.initProducer();
    this.subject = subject || config.ingestion.subject;
  }

  /**
 * Internal method used to fill up required fields when informing updates to dojot
 * @param  {[string]} deviceid Device to be updated
 * @param  {[string]} tenant   Tenant which device belongs to
 * @param  {[object]} metadata Device metadata that accompanies the event
 * @return {[object]}          Updated metadata (if fields were missing)
 */
  checkCompleteMetaFields(deviceid, tenant, metadata) {
    return new Promise((resolve, reject) => {

      if (!metadata.hasOwnProperty('deviceid')) {
        metadata["deviceid"] = deviceid;
      }

      if (!metadata.hasOwnProperty('tenant')) {
        metadata['tenant'] = tenant;
      }

      if (!metadata.hasOwnProperty('timestamp')) {
        metadata['timestamp'] = Date.now();
      }

      if (!metadata.hasOwnProperty('templates')) {
        metadata.templates = [];
      }
    })
  }

  publish(message) {
    console.log(`will produce to ${this.subject}`);
    this.producer.sendEvent(message.metadata.tenant, this.subject, message);
  }
}

module.exports = Publisher;
