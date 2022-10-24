const dojotModule = require("@dojot/dojot-module");

class KafkaMessegerV2 extends dojotModule.Messenger {
  constructor(name, config, topicManagerV2){
    super(name, config);
    this.topicManager = topicManagerV2;
  }
}

module.exports = KafkaMessegerV2;