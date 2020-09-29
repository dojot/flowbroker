"use strict";

var path = require('path');
const logger = require("@dojot/dojot-module-logger").logger;

var util = require("util");

var dojot = require('@dojot/flow-node');

var stream = require("stream");
var ftp = require("basic-ftp");

const TAG = { filename: 'ftp' };

class ReadStream extends stream.Readable {
    constructor(object) {
        super();
        stream.Readable.call(this, {});
        this._object = object;
    }
    _read() {
        this.push(this._object);
        this._object = null;
    }
}

class DataHandler extends dojot.DataHandlerBase {
    constructor() {
        super();
    }

    /**
     * Returns full path to html file
     * @return {string} String with the path to the node representation file
     */
    getNodeRepresentationPath() {
        return path.resolve(__dirname, 'ftp.html');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {object} Metadata object
     */
    getMetadata() {
        return {
            'id': 'dojot/ftp',
            'name': 'ftp',
            'module': 'dojot',
            'version': '1.0.0',
        };
    }

    /**
 * Returns full path to locales
 * @returns {String} Path segments into an absolute path.
 */
    getLocalesPath() {
        return path.resolve(__dirname, './locales');
    }

    /**
     * Check if the node configuration is valid
     * @param {object} config  Configuration data for the node
     * @return {[boolean, object]} Boolean variable stating if the configuration is valid or not and error message
     */
    checkConfig() {

        return [true, null];
    }

    /**
     * Statelessly handle a single given message, using given node configuration parameters
     *
     * This method should perform all computation required by the node, transforming its inputs
     * into outputs. When such processing is done, the node should issue a call to the provided
     * callback, notifying either failure to process the message with given config, or the set
     * of transformed messages to be sent to the flow's next hop.
     *filename.txt
     * @param  {[type]}       config   Node configuration to be used for this message
     * @param  {[type]}       message  Message to be processed
     * @return {[undefined]}
     */
    async handleMessage(config, message) {
        logger.debug("Executing ftp node...", TAG);
        logger.debug(`Config is: ${util.inspect(config)}`, TAG);
        var url = config.url;
        var tokens = config.url.match(/(ftp|ftps):\/\/(.*)/);
        var transport = "ftp";
        var host;
        var port = 21;
        var remaining;
        var encoding = config.fileencoding;
        const user = config.username;
        const password = config.password; // THIS SHOULD NOT BE LIKE THIS!

        logger.debug(`Encoding is: ${encoding}`, TAG);
        logger.debug(`URL parsing tokens: ${util.inspect(tokens)}`, TAG);
        if (tokens !== null) {
            transport = tokens[1];
            remaining = tokens[2];
        } else {
            remaining = config.url;
        }
        tokens = remaining.match(/(.*):(.*)/);
        logger.debug(`Port parsing tokens: ${util.inspect(tokens)}`, TAG);
        if (tokens !== null) {
            host = tokens[1];
            port = tokens[2];
        } else {
            host = remaining;
        }

        logger.debug(`Connecting to host ${host}:${port}, using ${transport}`, TAG);
        logger.debug(`Original config was ${config.url}`, TAG);

        const filename = this._get(config.filename, message);

        console.log("filename", filename);

        var stream;
        try {
            const buffer = Buffer.from(this._get(config.filecontent, message), encoding);
            stream = new ReadStream(buffer);
        } catch (e) {
            logger.debug("... ftp node was not successfully executed.", TAG);
            logger.error(`Error while retrieving ftp payload: ${e}`, TAG);
            return Promise.reject("ftpin.errors.no-body");
        }


        if (!url) {
            logger.debug("... ftp node was not successfully executed.", TAG);
            logger.error("Node has no URL set.", TAG);
            return Promise.reject("ftpin.errors.no-url");
        }

        const client = new ftp.Client();
        client.ftp.verbose = true;
        await client.access({
            host,
            port,
            password,
            secure: (transport === "ftps"),
            user,
        });

        var response = await client.upload(stream, filename);
        this._set(config.response, {}, response);

        client.close();

        return Promise.resolve([message]);
    }
}

module.exports = { Handler: DataHandler };
