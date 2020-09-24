var path = require('path');
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
        return path.resolve(__dirname, 'event-template-in.html');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {object} Metadata object
     */
    getMetadata() {
        return {
            'id': 'dojot/event-template-in',
            'name': 'event template in',
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

    handleMessage() {
        // This is actually not needed, and handled by "ingestor.js"
    }
}

module.exports = { Handler: DataHandler };
