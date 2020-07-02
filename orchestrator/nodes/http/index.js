"use strict";

var path = require('path');
const logger = require("@dojot/dojot-module-logger").logger;

var http = require("follow-redirects").http;
var https = require("follow-redirects").https;
var urllib = require("url");
var mustache = require("mustache");
var util = require("util");

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
     * Check if the node configuration is valid
     * @param {object} config  Configuration data for the node
     * @return {[boolean, object]} Boolean variable stating if the configuration is valid or not and error message
     */
    checkConfig() {

        return [true, null];
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
     * @return {[undefined]}
     */
    handleMessage(config, message) {
        logger.debug("Executing http node...", { filename: 'http' });
        var nodeUrl = config.url;
        var isTemplatedUrl = (nodeUrl || "");
        isTemplatedUrl = isTemplatedUrl.indexOf("{{") !== -1;
        var nodeMethod = config.method || "GET";
        var ret = config.ret || "txt";
        var reqTimeout = 120000;
        var url = nodeUrl || message.url;
        var httpRequest;

        try {
            httpRequest = JSON.parse(this._get(config.body, message));
        } catch (e) {
            if (config.method !== "GET"){
                logger.debug("... http node was not successfully executed.", { filename: 'http' });
                logger.error(`Error while retrieving http payload: ${e}`, { filename: 'http' });
                return Promise.reject("httpin.errors.no-body");
            }
        }


        // Pre-process URL.

        // First, resolve URL if it uses a mustache string.
        if (isTemplatedUrl) {
            url = mustache.render(nodeUrl, message);
        }

        if (!url) {
            logger.debug("... http node was not successfully executed.", { filename: 'http' });
            logger.error("Node has no URL set.", { filename: 'http' });
            return Promise.reject("httpin.errors.no-url");
        }

        // If no transport protocol was set, then assume http.
        if (!/^.*:\/\//.test(url)) {
            url = "http://" + url;
        }

        // Then, check whether it is correctly set - starts with http:// or https://
        if (!/^(http|https):\/\//.test(url)) {
            logger.debug("... http node was not successfully executed.", { filename: 'http' });
            logger.error("Node has an invalid transport protocol (no http nor https).", { filename: 'http' });
            return Promise.reject("httpin.errors.invalid-transport");
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

            if (httpRequest.headers) {
                for (var v in httpRequest.headers) {
                    if (httpRequest.headers.hasOwnProperty(v)) {
                        var name = v.toLowerCase();
                        if (name !== "content-type" && name !== "content-length") {
                            // only normalise the known headers used later in this
                            // function. Otherwise leave them alone.
                            name = v;
                        }
                        else if (name === 'content-type') { ctSet = v; }
                        else { clSet = v; }
                        opts.headers[name] = httpRequest.headers[v];
                    }
                }
            }

            var payload = null;
            if (typeof httpRequest.payload !== "undefined" && (method === "POST" || method === "PUT" || method === "PATCH")) {
                if (typeof httpRequest.payload === "string" || Buffer.isBuffer(httpRequest.payload)) {
                    payload = httpRequest.payload;
                } else if (typeof httpRequest.payload === "number") {
                    payload = httpRequest.payload + "";
                } else {
                    payload = JSON.stringify(httpRequest.payload);
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

            return new Promise((resolve, reject) => {
                logger.debug(`HTTP request about to be sent: ${util.inspect(opts)}`, { filename: 'http' });
                var req = makeRequest(urltotest,http,https,ret);

                req.setTimeout(reqTimeout, function () {
                    setTimeout(function () {
                        logger.debug("... http node was not successfully executed.", { filename: 'http' });
                        logger.error("No response was received within timeout period.", { filename: 'http' });
                        return reject(new Error("common.notification.errors.no-response"));
                    }, 10);
                    req.abort();
                });

                req.on('error', function (err) {
                    logger.debug("... http node was not successfully executed.", { filename: 'http' });
                    logger.error(`Error was: ${err}`, { filename: 'http' });
                    return reject(err);
                });
                if (payload) {
                    req.write(payload);
                }

                req.end();
            });
        } catch (error) {
            logger.debug("... http node was not successfully executed.", { filename: 'http' });
            logger.error(`An exception was thrown: ${error}`, { filename: 'http' });
            return Promise.reject(error);
        }
    }
    makeRequest(urltotest,http,https,ret){
        return ((/^https/.test(urltotest)) ? https : http).request(opts, (res) => {
            // Force NodeJs to return a Buffer (instead of a string)
            // See https://github.com/nodejs/node/issues/6038
            res.setEncoding(null);
            delete res._readableState.decoder;

            this._set(config.response, {}, message);
            var httpResponse = this._get(config.response, message);
            httpResponse.statusCode = res.statusCode;
            httpResponse.headers = res.headers;
            httpResponse.responseUrl = res.responseUrl;
            httpResponse.payload = [];

            // msg.url = url;   // revert when warning above finally removed
            res.on('data', (chunk) => {
                if (!Buffer.isBuffer(chunk)) {
                    // if the 'setEncoding(null)' fix above stops working in
                    // a new Node.js release, throw a noisy error so we know
                    // about it.
                    logger.debug("... http node was not successfully executed.", { filename: 'http' });
                    logger.error("Returned HTTP Request data is not a buffer.", { filename: 'http' });
                    return reject(new Error("HTTP Request data chunk not a Buffer"));
                }
                httpResponse.payload.push(chunk);
            });

            res.on('end', () => {

                // Check that message[config.response] is an array - if the req error
                // handler has been called, it will have been set to a string
                // and the error already handled - so no further action should
                // be taken. #1344
                if (Array.isArray(httpResponse.payload)) {
                    // Convert the payload to the required return type
                    if (ret !== "bin") {
                        let strData = httpResponse.payload;
                        httpResponse.payload = strData.toString("utf8");
                        if (ret === "obj") {
                            try {
                                httpResponse.payload = JSON.parse(strData);
                            } catch (e) {
                                logger.warn("Could not parse JSON. Forwarding as plain string.");
                            }
                        }
                    }
                    logger.debug("... http node was successfully executed.", { filename: 'http' });
                    return resolve([message]);
                }
            });
        });
    }
}

module.exports = { Handler: DataHandler };