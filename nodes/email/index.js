"use strict";

let fs = require('fs');
let path = require('path');
let nodemailer = require("nodemailer");
let DojotHandler = require('dojot-node-library');

// Sample node implementation
class DataHandler {
    constructor() {
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
     * @return {[boolean, object]} Boolean variable stating if the configuration is valid or not and error message
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
        setTimeout(() => {

            let smtpOptions = {
                host: config.outserver,
                port: config.outport,
                secure: config.secure
            };

            if (config.credentials.userid && config.credentials.password) {
                smtpOptions.auth = {
                    user: config.credentials.userid,
                    pass: config.credentials.password
                };
            }

            let smtpTransport = nodemailer.createTransport(smtpOptions);


            if (message.hasOwnProperty("payload")) {
                if (smtpTransport) {

                    let sendopts = {from: ((message.from) ? message.from : config.credentials.userid)};

                    sendopts.subject = config.subject;
                    sendopts.to = config.name || message.to;

                    if (config.name === "") {
                        sendopts.cc = message.cc;
                        sendopts.bcc = message.bcc;
                    }

                    sendopts.subject = message.topic || message.title || "Message from Node-RED"; // subject line

                    if (message.hasOwnProperty("envelope")) {
                        sendopts.envelope = message.envelope;
                    }
                    if (Buffer.isBuffer(message.payload)) { // if it's a buffer in the payload then auto create an attachment instead
                        if (!message.filename) {
                            let fe = "bin";
                            if ((message.payload[0] === 0xFF) && (message.payload[1] === 0xD8)) {
                                fe = "jpg";
                            }
                            if ((message.payload[0] === 0x47) && (message.payload[1] === 0x49)) {
                                fe = "gif";
                            } //46
                            if ((message.payload[0] === 0x42) && (message.payload[1] === 0x4D)) {
                                fe = "bmp";
                            }
                            if ((message.payload[0] === 0x89) && (message.payload[1] === 0x50)) {
                                fe = "png";
                            } //4E
                            message.filename = "attachment." + fe;
                        }

                        let fname = message.filename.replace(/^.*[\\\/]/, '') || "file.bin";

                        sendopts.attachments = [{content: message.payload, filename: fname}];

                        if (message.hasOwnProperty("headers") && message.headers.hasOwnProperty("content-type")) {
                            sendopts.attachments[0].contentType = message.headers["content-type"];
                        }

                        // Create some body text..
                        // TODO: Use locales for this
                        sendopts.text = "email.default-message";

                    } else {

                        let payload = ensureString(message.payload);

                        sendopts.text = payload; // plaintext body

                        if (/<[a-z][\s\S]*>/i.test(payload)) {
                            sendopts.html = payload;
                        } // html body

                        if (message.attachments) {
                            sendopts.attachments = message.attachments;
                        } // add attachments
                    }

                    smtpTransport.sendMail(sendopts, function (error, info) {
                        if (error) {
                            callback(error, [message]);
                        } else {
                            callback(undefined, []);
                        }
                    });
                }
                else {
                    callback("email.errors.nosmtptransport", []);
                }
            }
            else {
                callback("email.errors.nopayload", []);
            }

            callback(undefined, []);
        }, 10);

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
module.exports = {Handler: DataHandler};
