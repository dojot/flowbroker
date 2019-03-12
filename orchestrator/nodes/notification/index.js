var path = require('path');
var util = require('util');
var logger = require("../../logger").logger;
var dojot = require('@dojot/flow-node');

class DataHandler extends dojot.DataHandlerBase {
    constructor(publisher) {
        super();
        this.publisher = publisher;
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


    handleMessage(config, message, metadata) {
        try {
            logger.debug("Executing device-out node...");
            logger.debug("... device was updated.");
            logger.debug("... device-out node was successfully executed.");
            return Promise.resolve();
        } catch (error) {
            logger.debug("... device-out node was not successfully executed.");
            logger.error(`Error while executing device-out node: ${error}`);
            return Promise.reject(error);
        }
    }
}

module.exports = {Handler: DataHandler};
