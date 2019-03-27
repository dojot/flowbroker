"use strict";

var fs = require('fs');
var path = require('path');
var logger = require('../../logger').logger;

var util = require("util");

var dojot = require('@dojot/flow-node');

var stream = require("stream");
var ftp = require("basic-ftp");

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


// Sample node implementation
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
     * Returns object with locale data (for the given locale)
     * @param  {[string]} locale Locale string, such as "en-US"
     * @return {[object]}        Locale settings used by the module
     */
    getLocaleData(locale) {

        let filepath = path.join(__dirname, "locales/" + locale + "/ftp.json");
        if (fs.existsSync(filepath)) {
            return require(filepath);
        } else {
            return require(path.join(__dirname, "locales/en-US/ftp.json"));
        }

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
     *
     * @param  {[type]}       config   Node configuration to be used for this message
     * @param  {[type]}       message  Message to be processed
     * @return {[undefined]}
     */
    async handleMessage(config, message) {
        logger.debug("Executing ftp node...");
        logger.debug(`Config is: ${util.inspect(config)}`);
        var url = config.url;
        var tokens = config.url.match(/(ftp|ftps):\/\/(.*)/);
        var transport = "ftp";
        var host;
        var port = 21;
        var remaining;
        logger.debug(`URL parsing tokens: ${util.inspect(tokens)}`);
        if (tokens !== null) {
            transport = tokens[1];
            remaining = tokens[2];
        } else {
            remaining = config.url;
        }
        tokens = remaining.match(/(.*):(.*)/);
        logger.debug(`Port parsing tokens: ${util.inspect(tokens)}`);
        if (tokens !== null) {
            host = tokens[1];
            port = tokens[2];
        } else {
            host = remaining;
        }

        logger.debug(`Connecting to host ${host}:${port}, using ${transport}`);
        logger.debug(`Original config was ${config.url}`);

        var method = config.method.toUpperCase() || "PUT";
        const filename = this._get(config.filename, message);
        var stream;
        try {
            const buffer = Buffer.from(this._get(config.filecontent, message), 'base64');
            stream = new ReadStream(buffer);
        } catch (e) {
            logger.debug("... ftp node was not successfully executed.");
            logger.error(`Error while retrieving ftp payload: ${e}`);
            return Promise.reject("ftpin.errors.no-body");
        }

        if (!url) {
            logger.debug("... ftp node was not successfully executed.");
            logger.error("Node has no URL set.");
            return Promise.reject("ftpin.errors.no-url");
        }

        const client = new ftp.Client();
        client.ftp.verbose = true;
        await client.access({
            host,
            port,
            password: "dojot",
            secure: (transport === "ftps"),
            user: "dojot",
        });

        var response;
        switch (method) {
            case "PUT":
                response = await client.upload(stream, filename);
                this._set(config.response, {}, response);
            break;
            case "GET": {
                response = await client.download(filename);
                this._set(config.response, {}, response);
            }
        }
        client.close();
        return [message];
    }
}

// var main = new DojotHandler(new DataHandler());
module.exports = { Handler: DataHandler };
