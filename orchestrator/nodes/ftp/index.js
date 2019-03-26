"use strict";

var fs = require('fs');
var path = require('path');
var logger = require('../../logger').logger;


var urllib = require("url");
var mustache = require("mustache");
var util = require("util");

var dojot = require('@dojot/flow-node');

var stream = require("stream");
var ftp = require("basic-ftp");
var uuid = require("uuid");

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
            return null;
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
        var nodeUrl = config.url;
        var isTemplatedUrl = (nodeUrl || "").indexOf("{{") !== -1;
        var nodeMethod = config.method || "PUT";
        var ret = config.ret || "txt";
        var reqTimeout = 120000;
        var url = nodeUrl || message.url;
        var ftpRequest;
        var stream;
        try {
            const buffer = Buffer.from(this._get(config.body, message), 'base64');
            stream = new ReadStream(buffer);
        } catch (e) {
            logger.debug("... ftp node was not successfully executed.");
            logger.error(`Error while retrieving ftp payload: ${e}`);
            return Promise.reject("ftpin.errors.no-body");
        }


        // Pre-process URL.

        // First, resolve URL if it uses a mustache string.
        if (isTemplatedUrl) {
            url = mustache.render(nodeUrl, message);
        }

        if (!url) {
            logger.debug("... ftp node was not successfully executed.");
            logger.error("Node has no URL set.");
            return Promise.reject("ftpin.errors.no-url");
        }

        // If no transport protocol was set, then assume ftp.
        // if (!/^.*:\/\//.test(url)) {
        //     url = "ftp://" + url;
        // }

        // Then, check whether it is correctly set - starts with ftp:// or ftps://
        // if (!/^(ftp|ftps):\/\//.test(url)) {
        //     logger.debug("... ftp node was not successfully executed.");
        //     logger.error("Node has an invalid transport protocol (no ftp nor ftps).");
        //     return Promise.reject("ftpin.errors.invalid-transport");
        // }

        var method = nodeMethod.toUpperCase() || "GET";

        if (message.method && config.method && (config.method === "use")) {
            method = message.method.toUpperCase();
        }

        try {
            return new Promise((resolve, reject) => {
                const client = new ftp.Client();
                client.ftp.verbose = true;
                client.access({
                    host: url,
                    password: "dojot",
                    secure: false,
                    user: "dojot",
                }).then(() => {
                    const filename = uuid.v4() + ".png";
                    client.upload(stream, filename).then((response) => {
                        client.close();
                        this._set(config.response, {}, response);
                        return resolve([message]);
                    }).catch((error) => {
                        return reject(error);
                    });
                }).catch((error) => {
                    return reject(error);
                });
            });
        } catch (error) {
            logger.debug("... ftp node was not successfully executed.");
            logger.error(`An exception was thrown: ${error}`);
            return Promise.reject(error);
        }
    }
}

// var main = new DojotHandler(new DataHandler());
module.exports = { Handler: DataHandler };
