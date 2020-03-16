const path = require('path');
const util = require('util');
const uuid4 = require('uuid4');
const logger = require("@dojot/dojot-module-logger").logger;
const dojot = require('@dojot/flow-node');

const TAG = { filename: 'publish-ftp/index' };

class DataHandler extends dojot.DataHandlerBase {
  constructor(kafkaMessenger, subject) {
    super();
    this.kafkaMessenger = kafkaMessenger;
    this.subject = subject;

  }

  /**
   * Returns full path to html file
   * @return {string} String with the path to the node representation file
   */
  getNodeRepresentationPath() {
    return path.resolve(__dirname, 'publish-ftp.html');
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      'id': 'dojot/publish-ftp',
      'name': 'publish-ftp',
      'module': 'dojot',
      'version': '1.0.0',
    };
  }

  /**
   * Returns full path to locales
   * @returns String
   */
  getLocalesPath() {
    return path.resolve(__dirname, './locales');
  }


  /**
    * Statelessly handle a single given message, using given node configuration parameters
    *
    * This method should perform all computation required by the node, transforming its inputs
    * into outputs. When such processing is done, the node should issue a call to the provided
    * callback, notifying either failure to process the message with given config, or the set
    * of transformed messages to be sent to the flow's next hop.
    *
    * @param  {[type]}       config   Node configuration to be used for this message
    * @param  {[type]}       message  Message to be processed
    * @param  {object}       metadata An object with the metadata from this execution
    * It is possible to retrieve the following attributes:
    * - tenant
    * - flowId
    * - originatorDeviceId
    * @return {[Promise]}
    */
  handleMessage(config, message, metadata) {
    try {

      logger.debug("Executing publish-ftp node...", TAG);

      const { filecontent, encode, filename } = config;

      let extractedContent = "";
      if (filecontent) {
        extractedContent = this._get(filecontent, message);
      }

      let output = {
        metadata: {
          msgID: uuid4(),
          ts: Date.now(),
          service: "flowbroker",
          contentType: "application/vnd.dojot.ftp+json"
        },
        data: {
          "filename": filename,
          "encoding": encode,
          "content": extractedContent,
        }
      };
      logger.debug(`Publish in ${metadata.tenant}.${this.subject} ...`, TAG);
      logger.debug(`... with msg ${util.inspect(output, { depth: null })}`, TAG);

      this.kafkaMessenger.publish(this.subject, metadata.tenant, JSON.stringify(output));

      logger.debug("... publish-ftp node was successfully executed.", TAG);

      return Promise.resolve([]);

    } catch (error) {

      logger.debug("... publish-ftp node was not successfully executed.", TAG);
      logger.error(`Error while executing publish-ftp node: ${error}`, TAG);

      return Promise.reject(error);
    }
  }

}

module.exports = { Handler: DataHandler };
