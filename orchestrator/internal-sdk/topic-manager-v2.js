"use strict";
const logger = require("@dojot/dojot-module-logger").logger;

/**
 * Class responsible for dealing with topics.
 *
 * This class will handle any functionality related to topics (Kafka's,
 * particularly) and its relationship with subjects and tenants.
 */
class TopicManagerV2 {

  getKey(subject, tenant) {
    return tenant + ":" + subject;
  }

  /**
   * Retrieve a topic from Data Broker.
   *
   * This function will request Data Broker for a Kafka topic, given a subject
   * and a tenant. It will retry a few times (configured in config object) and
   * will reject the promise if it is unable to reach Data Broker for any
   * reason. This promise will also be rejected if the response is not a valid
   * JSON or contains invalid data.
   *
   * All topics are cached in order to speed up future requests.
   *
   * If true, the global parameter will indicate to Data Broker that the
   * requested topic should be the same for all tenants. This is useful when
   * dealing with topics that are intended to contain messages not related to
   * tenants, such as messages related to services.
   *
   * @param {string} subject The subject related to the requested topic
   * @param {string} tenant The tenant related to the requested topic
   * @param {string} broker URL where data broker can be accessed
   * @param {boolean} global true if this topic should be sensitive to tenants
   */
  async getTopic(subject, tenant, _broker, _global) {
    if( subject === 'dojot.tenancy' ) {
      return 'dojot-management.dojot.tenancy';
    }
    
    logger.debug(`${subject}, ${tenant} => ${tenant}.${subject}`);
    return `${tenant}.${subject}`;
  }
}

module.exports = TopicManagerV2;
