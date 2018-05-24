"use strict";

var fs = require('fs');
var path = require('path');
var logger = require('../../logger').logger;

var http = require("follow-redirects").http;
var https = require("follow-redirects").https;
var urllib = require("url");
var mustache = require("mustache");

var dojot = require('@dojot/flow-node');

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
        return path.resolve(__dirname, 'http.html');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {object} Metadata object
     */
    getMetadata() {
        return {
            'id': 'dojot/http',
            'name': 'http',
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

        let filepath = path.join(__dirname, "locales/" + locale + "/http.json");
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
     * @param  {Function}     callback Callback to call upon processing completion
     * @return {[undefined]}
     */
    handleMessage(config, message, callback) {
        logger.debug("Executing http node...");
        var nodeUrl = config.url;
        var isTemplatedUrl = (nodeUrl || "").indexOf("{{") !== -1;
        var nodeMethod = config.method || "GET";
        var ret = config.ret || "txt";
        var reqTimeout = 120000;
        var url = nodeUrl || message.url;
        var requestPayload;
        
        try {
            requestPayload = this._get(config.body, message);
        } catch (e) {
            logger.debug("... http node was not successfully executed.");
            logger.error(`Error while retrieving http payload: ${e}`);
            return callback("httpin.errors.no-body", []);
        }


        // Pre-process URL.

        // First, resolve URL if it uses a mustache string.
        if (isTemplatedUrl) {
            url = mustache.render(nodeUrl, message);
        }

        if (!url) {
            logger.debug("... http node was not successfully executed.");
            logger.error("Node has no URL set.");
            return callback("httpin.errors.no-url", []);
        }

        // If no transport protocol was set, then assume http.
        if (!/^.*:\/\//.test(url)) {
            url = "http://" + url;
        }

        // Then, check whether it is correctly set - starts with http:// or https://
        if (!/^(http|https):\/\//.test(url)) {
            logger.debug("... http node was not successfully executed.");
            logger.error("Node has an invalid transport protocol (no http nor https).");
            return callback("httpin.errors.invalid-transport", []);
        }

        var method = nodeMethod.toUpperCase() || "GET";

        if (message.method && config.method && (config.method === "use")) {
            method = message.method.toUpperCase();
        }

        try {
            // Fill opts variable. It will be used to send the request.
            var opts = urllib.parse(url);
            opts.method = method;
            opts.headers = {};
            var ctSet = "Content-Type"; // set default camel case
            var clSet = "Content-Length";

            if (message.headers) {
                for (var v in message.headers) {
                    if (message.headers.hasOwnProperty(v)) {
                        var name = v.toLowerCase();
                        if (name !== "content-type" && name !== "content-length") {
                            // only normalise the known headers used later in this
                            // function. Otherwise leave them alone.
                            name = v;
                        }
                        else if (name === 'content-type') { ctSet = v; }
                        else { clSet = v; }
                        opts.headers[name] = message.headers[v];
                    }
                }
            }
 
            var payload = null;
            if (typeof requestPayload !== "undefined" && (method === "POST" || method === "PUT" || method === "PATCH")) {
                if (typeof requestPayload === "string" || Buffer.isBuffer(requestPayload)) {
                    payload = requestPayload;
                } else if (typeof requestPayload === "number") {
                    payload = requestPayload + "";
                } else {
                    payload = JSON.stringify(requestPayload);
                    if (opts.headers['content-type'] === null) {
                        opts.headers[ctSet] = "application/json";
                    }
                }

                if (opts.headers['content-length'] === null) {
                    if (Buffer.isBuffer(payload)) {
                        opts.headers[clSet] = payload.length;
                    } else {
                        opts.headers[clSet] = Buffer.byteLength(payload);
                    }
                }
            }
            // revert to user supplied Capitalisation if needed.
            if (opts.headers.hasOwnProperty('content-type') && (ctSet !== 'content-type')) {
                opts.headers[ctSet] = opts.headers['content-type'];
                delete opts.headers['content-type'];
            }
            if (opts.headers.hasOwnProperty('content-length') && (clSet !== 'content-length')) {
                opts.headers[clSet] = opts.headers['content-length'];
                delete opts.headers['content-length'];
            }
            var urltotest = url;

            logger.debug(`HTTP request about to be sent: ${opts}`);
            var req = ((/^https/.test(urltotest)) ? https : http).request(opts, function (res) {
                // Force NodeJs to return a Buffer (instead of a string)
                // See https://github.com/nodejs/node/issues/6038
                res.setEncoding(null);
                delete res._readableState.decoder;

                message.statusCode = res.statusCode;
                message.headers = res.headers;
                message.responseUrl = res.responseUrl;
                // Should the answer be cleared or appended?
                message.payload = [];

                // msg.url = url;   // revert when warning above finally removed
                res.on('data', function (chunk) {
                    if (!Buffer.isBuffer(chunk)) {
                        // if the 'setEncoding(null)' fix above stops working in
                        // a new Node.js release, throw a noisy error so we know
                        // about it.
                        logger.debug("... http node was not successfully executed.");
                        logger.error("Returned HTTP Request data is not a buffer.");
                        return callback(new Error("HTTP Request data chunk not a Buffer"));
                    }
                    message.payload.push(chunk);
                });

                res.on('end', function () {

                    // Check that msg.payload is an array - if the req error
                    // handler has been called, it will have been set to a string
                    // and the error already handled - so no further action should
                    // be taken. #1344
                    if (Array.isArray(message.payload)) {
                        // Convert the payload to the required return type
                        message.payload = Buffer.concat(message.payload); // bin
                        if (ret !== "bin") {
                            message.payload = message.payload.toString('utf8'); // txt

                            if (ret === "obj") {
                                try {
                                    message.payload = JSON.parse(message.payload);
                                } catch (e) {
                                    return callback(new Error("httpin.errors.json-error"));
                                }
                            }
                        }
                        logger.debug("... http node was successfully executed.");
                        return callback(undefined, [message]);
                    }
                });
            });

            req.setTimeout(reqTimeout, function () {
                setTimeout(function () {
                    logger.debug("... http node was not successfully executed.");
                    logger.error("No response was received within timeout period.");
                    return callback(new Error("common.notification.errors.no-response"));
                }, 10);
                req.abort();
            });

            req.on('error', function (err) {
                logger.debug("... http node was not successfully executed.");
                logger.error(`Error was: ${err}`);
                return callback(err);
            });

            if (payload) {
                req.write(payload);
            }

            req.end();
        } catch (error) {
            logger.debug("... http node was not successfully executed.");
            logger.error(`An exception was thrown: ${error}`);
            return callback(error);
        }
    }
}

// var main = new DojotHandler(new DataHandler());
module.exports = { Handler: DataHandler };
