"use strict";

let fs = require('fs');
let path = require('path');
let nodemailer = require("nodemailer");
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
        return path.resolve(__dirname, 'email.html');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {object} Metadata object
     */
    getMetadata() {
        return {
            'id': 'dojot/email',
            'name': 'email',
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

        let filepath = path.join(__dirname, "locales/" + locale + "/email.json");
        if (fs.existsSync(filepath)) {
            return require(filepath);
        } else {
            return null
        }

    }

    /**
     * Check if the node configuration is valid
     * @param {object} config  Configuration data for the node
     * @return {[boolean, object]} Boolean variable stating if the configuration is valid
     *                             or not and error message
     */
    checkConfig(config) {

        if (!config.credentials.hasOwnProperty("userid")) {
            return [false, {
                error_type: "email.errors.nouserid",
                error_data: {}
            }]
        }

        if (!config.credentials.hasOwnProperty("password")) {
            return [false, {
                error_type: "email.errors.nopassword",
                error_data: {}
            }]
        }

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

        let smtpOptions = {
            host: config.server,
            port: config.port,
            secure: config.secure
        };

        if (config.hasOwnProperty('credentials')) {
            if (config.credentials.userid && config.credentials.password) {
                smtpOptions.auth = {
                    user: config.credentials.userid,
                    pass: config.credentials.password
                };
            }
        }

        let smtpTransport = nodemailer.createTransport(smtpOptions);
        if (message.hasOwnProperty("payload")) {
            if (smtpTransport) {

                let sendopts = {
                    subject: config.subject,
                    to: (config.to || message.to),
                    from: ((message.from) ? message.from : (config.from || "dojot@noemail.com"))
                };

                if (message.hasOwnProperty("envelope")) {
                    sendopts.envelope = message.envelope;
                }

                let body = this._get(config.body, message);
                if (Buffer.isBuffer(body)) {
                    // if it's a buffer in the payload then auto create an attachment instead
                    if (!message.filename) {
                        let fe = "bin";
                        if ((body[0] === 0xFF) && (body[1] === 0xD8)) {
                            fe = "jpg";
                        }
                        if ((body[0] === 0x47) && (body[1] === 0x49)) {
                            fe = "gif";
                        } //46
                        if ((body[0] === 0x42) && (body[1] === 0x4D)) {
                            fe = "bmp";
                        }
                        if ((body[0] === 0x89) && (body[1] === 0x50)) {
                            fe = "png";
                        } //4E
                        message.filename = "attachment." + fe;
                    }

                    let fname = message.filename.replace(/^.*[\\\/]/, '') || "file.bin";

                    sendopts.attachments = [{ content: body, filename: fname }];

                    if (message.hasOwnProperty("headers") && message.headers.hasOwnProperty("content-type")) {
                        sendopts.attachments[0].contentType = message.headers["content-type"];
                    }

                    // Create some body text..
                    // TODO: Use locales for this
                    sendopts.text = "email.default-message";

                } else {

                    let payload = ensureString(body);

                    // plaintext body
                    sendopts.text = payload;
                    // html body
                    if (/<[a-z][\s\S]*>/i.test(payload)) {
                        sendopts.html = payload;
                    }
                    // add attachments
                    if (message.attachments) {
                        sendopts.attachments = message.attachments;
                    }
                }

                smtpTransport.sendMail(sendopts, function (error, info) {
                    if (error) {
                        callback(error);
                    } else {
                        callback(undefined, []);
                    }
                });
            }
            else {
                callback(new Error("email.errors.nosmtptransport"));
            }
        }
        else {
            callback(new Error("email.errors.nopayload"));
        }

        function ensureString(o) {
            if (Buffer.isBuffer(o)) {
                return o.toString();
            } else if (typeof o === "object") {
                return JSON.stringify(o);
            } else if (typeof o === "string") {
                return o;
            }
            return "" + o;
        }
    }
}

// var main = new DojotHandler(new DataHandler());
module.exports = { Handler: DataHandler };
