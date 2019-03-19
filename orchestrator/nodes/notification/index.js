var path = require('path');
var util = require('util');
var uuid4 = require('uuid4');
var logger = require("../../logger").logger;
var dojot = require('@dojot/flow-node');

class DataHandler extends dojot.DataHandlerBase {

    constructor(kafka, subject, tenant) {
        super();
        this.kafkaMessenger = kafka;
        this.subject = subject;
        this.tenant = tenant;
    }

    /**
     * Returns full path to html file
     * @return {string} String with the path to the node representation file
     */
    getNodeRepresentationPath() {
        return path.resolve(__dirname, 'notification.html');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {object} Metadata object
     */
    getMetadata() {
        return {
            'id': 'dojot/notification',
            'name': 'notification',
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
     * @param  {Function}     callback Callback to call upon processing completion
     * @return {[Promise]}
     */
    handleMessage(config, message) {

        try {
            let meta = {};
            let contentMessage = "";

            if (config.source) {
                meta = this._get(config.source, message);
            }

            if (config.msgType === 'dynamic') {
                contentMessage = this._get(config.messageDynamic, message);
            }else {
                contentMessage = config.messageStatic;
            }

            if(!meta.hasOwnProperty('shouldPersist')){
                meta.shouldPersist = true;
            }

            let output = {
                msgID: uuid4(),
                timestamp: Date.now(),
                message: contentMessage,
                metaAttrsFilter: meta,
                subject: "user_notification"
            };

            logger.debug(`output is: ${util.inspect(output, {depth: null})}`);

            this.kafkaMessenger.publish(this.subject, this.tenant, JSON.stringify(output));

            logger.debug("...notification node was successfully executed.");

            return Promise.resolve([message])
        } catch (error) {
            logger.error(`Error while executing notification node: ${error}`);
            return Promise.reject(error);
        }
    }
}

module.exports = {Handler: DataHandler};
