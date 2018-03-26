"use strict";

var fs = require('fs');
var path = require('path');

// var http = require("follow-redirects").http;
// var https = require("follow-redirects").https;
// var urllib = require("url");
// var mustache = require("mustache");
// var querystring = require("querystring");
// var cookie = require("cookie");
// var hashSum = require("hash-sum");

var dojot = require('@dojot/flow-node');

// Sample node implementation
class DataHandler {
    constructor() {
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
        }
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
          return null
      }

    }

    /**
     * Check if the node configuration is valid
     * @param {object} config  Configuration data for the node
     * @return {[boolean, object]} Boolean variable stating if the configuration is valid or not and error message
     */
    checkConfig(config) {

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
        // setTimeout(() => {
        //
        //     var nodeUrl = config.url;
        //     var isTemplatedUrl = (nodeUrl || "").indexOf("{{") != -1;
        //     var nodeMethod = config.method || "GET";
        //
        //     var ret = config.ret || "txt";
        //
        //     var reqTimeout = 120000
        //
        //     var preRequestTimestamp = process.hrtime();
        //
        //     var url = nodeUrl || message.url;
        //
        //     if (isTemplatedUrl) {
        //         url = mustache.render(nodeUrl, messsage);
        //     }
        //
        //     if (!url) {
        //         callback("httpin.errors.no-url", [])
        //         return;
        //     }
        //
        //     // url must start http:// or https:// so assume http:// if not set
        //     if (url.indexOf("://") !== -1 && url.indexOf("http") !== 0) {
        //         callback("httpin.errors.invalid-transport", [])
        //         return;
        //     }
        //
        //     if (!(url.indexOf("http://") === 0)) {
        //         url = "http://" + url;
        //     }
        //
        //     var method = nodeMethod.toUpperCase() || "GET";
        //
        //     if (message.method && config.method && (config.method === "use")) {
        //         method = message.method.toUpperCase();
        //     }
        //
        //     var opts = urllib.parse(url);
        //     opts.method = method;
        //     opts.headers = {};
        //     var ctSet = "Content-Type"; // set default camel case
        //     var clSet = "Content-Length";
        //
        //     if (message.headers) {
        //         if (message.headers.hasOwnProperty('x-node-red-request-node')) {
        //             var headerHash = message.headers['x-node-red-request-node'];
        //             delete message.headers['x-node-red-request-node'];
        //
        //             var hash = hashSum(message.headers);
        //             if (hash === headerHash) {
        //                 delete message.headers;
        //             }
        //         }
        //
        //         if (message.headers) {
        //             for (var v in message.headers) {
        //                 if (message.headers.hasOwnProperty(v)) {
        //                     var name = v.toLowerCase();
        //                     if (name !== "content-type" && name !== "content-length") {
        //                         // only normalise the known headers used later in this
        //                         // function. Otherwise leave them alone.
        //                         name = v;
        //                     }
        //                     else if (name === 'content-type') { ctSet = v; }
        //                     else { clSet = v; }
        //                     opts.headers[name] = message.headers[v];
        //                 }
        //             }
        //         }
        //     }
        //
        //     if (message.cookies) {
        //         var cookies = [];
        //         if (opts.headers.hasOwnProperty('cookie')) {
        //             cookies.push(opts.headers.cookie);
        //         }
        //
        //         for (var name in message.cookies) {
        //             if (message.cookies.hasOwnProperty(name)) {
        //                 if (message.cookies[name] === null || message.cookies[name].value === null) {
        //                     // This case clears a cookie for HTTP In/Response nodes.
        //                     // Ignore for this node.
        //                 } else if (typeof message.cookies[name] === 'object') {
        //                     cookies.push(cookie.serialize(name, message.cookies[name].value));
        //                 } else {
        //                     cookies.push(cookie.serialize(name, message.cookies[name]));
        //                 }
        //             }
        //         }
        //         if (cookies.length > 0) {
        //             opts.headers.cookie = cookies.join("; ");
        //         }
        //     }
        //
        //     if (config.credentials && config.credentials.user) {
        //         opts.auth = config.credentials.user + ":" + (config.credentials.password || "");
        //     }
        //     var payload = null;
        //
        //     if (typeof message.payload !== "undefined" && (method == "POST" || method == "PUT" || method == "PATCH" ) ) {
        //
        //         if (typeof message.payload === "string" || Buffer.isBuffer(message.payload)) {
        //             payload = message.payload;
        //         } else if (typeof message.payload == "number") {
        //             payload = message.payload+"";
        //         } else {
        //             if (opts.headers['content-type'] == 'application/x-www-form-urlencoded') {
        //                 payload = querystring.stringify(message.payload);
        //             } else {
        //                 payload = JSON.stringify(message.payload);
        //                 if (opts.headers['content-type'] == null) {
        //                     opts.headers[ctSet] = "application/json";
        //                 }
        //             }
        //         }
        //
        //         if (opts.headers['content-length'] == null) {
        //             if (Buffer.isBuffer(payload)) {
        //                 opts.headers[clSet] = payload.length;
        //             } else {
        //                 opts.headers[clSet] = Buffer.byteLength(payload);
        //             }
        //         }
        //     }
        //     // revert to user supplied Capitalisation if needed.
        //     if (opts.headers.hasOwnProperty('content-type') && (ctSet !== 'content-type')) {
        //         opts.headers[ctSet] = opts.headers['content-type'];
        //         delete opts.headers['content-type'];
        //     }
        //     if (opts.headers.hasOwnProperty('content-length') && (clSet !== 'content-length')) {
        //         opts.headers[clSet] = opts.headers['content-length'];
        //         delete opts.headers['content-length'];
        //     }
        //     var urltotest = url;
        //
        //     var req = ((/^https/.test(urltotest))?https:http).request(opts,function(res) {
        //         // Force NodeJs to return a Buffer (instead of a string)
        //         // See https://github.com/nodejs/node/issues/6038
        //         res.setEncoding(null);
        //         delete res._readableState.decoder;
        //
        //         message.statusCode = res.statusCode;
        //         message.headers = res.headers;
        //         message.responseUrl = res.responseUrl;
        //         message.payload = [];
        //
        //         if (message.headers.hasOwnProperty('set-cookie')) {
        //             message.responseCookies = {};
        //             message.headers['set-cookie'].forEach(function(c) {
        //                 var parsedCookie = cookie.parse(c);
        //                 var eq_idx = c.indexOf('=');
        //                 var key = c.substr(0, eq_idx).trim()
        //                 parsedCookie.value = parsedCookie[key];
        //                 delete parsedCookie[key];
        //                 message.responseCookies[key] = parsedCookie;
        //
        //             })
        //
        //         }
        //         message.headers['x-node-red-request-node'] = hashSum(message.headers);
        //         // msg.url = url;   // revert when warning above finally removed
        //         res.on('data', function(chunk) {
        //             if (!Buffer.isBuffer(chunk)) {
        //                 // if the 'setEncoding(null)' fix above stops working in
        //                 // a new Node.js release, throw a noisy error so we know
        //                 // about it.
        //                 throw new Error("HTTP Request data chunk not a Buffer");
        //             }
        //             message.payload.push(chunk);
        //         });
        //
        //         res.on('end',function() {
        //
        //             // Check that msg.payload is an array - if the req error
        //             // handler has been called, it will have been set to a string
        //             // and the error already handled - so no further action should
        //             // be taken. #1344
        //             if (Array.isArray(message.payload)) {
        //                 // Convert the payload to the required return type
        //                 message.payload = Buffer.concat(message.payload); // bin
        //                 if (node.ret !== "bin") {
        //                     message.payload = message.payload.toString('utf8'); // txt
        //
        //                     if (node.ret === "obj") {
        //                         try {
        //                             message.payload = JSON.parse(message.payload);
        //                         } catch(e) {
        //                             callback("httpin.errors.json-error", [message]);
        //                         }
        //                     }
        //                 }
        //                 callback(undefined, [message])
        //             }
        //         });
        //     });
        //
        //     req.setTimeout(node.reqTimeout, function() {
        //         setTimeout(function() {
        //             callback("common.notification.errors.no-response", []);
        //         },10);
        //         req.abort();
        //     });
        //
        //     req.on('error',function(err) {
        //         node.error(err,msg);
        //         msg.payload = err.toString() + " : " + url;
        //         msg.statusCode = err.code;
        //         callback(err, [message])
        //     });
        //
        //     if (payload) {
        //         req.write(payload);
        //     }
        //
        //     req.end();
        //
        // }, 10);

    }
}

// var main = new DojotHandler(new DataHandler());
module.exports = {Handler: DataHandler};
