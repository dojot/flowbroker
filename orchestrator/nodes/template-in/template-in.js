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
        return path.resolve(__dirname, 'template-in.html');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {object} Metadata object
     */
    getMetadata() {
        return {
            'id': 'dojot/device-template-in',
            'name': 'device template in',
            'module': 'dojot',
            'version': '1.0.0',
        }
    }

    /**
     * Returns object with locale data (for the given locale)
     * @param  {[string]} locale Locale string, such as "en-US"
     * @return {[object]}        Locale settings used by the module
     */
    getLocaleData(locale) {
        return {};
    }

    handleMessage(config, message, callback, tenant) {
        // This is actually not needed, and handled by "ingestor.js"
    }
}

module.exports = { Handler: DataHandler };