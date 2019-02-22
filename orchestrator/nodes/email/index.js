"use strict";

let fs = require('fs');
let path = require('path');
let nodemailer = require("nodemailer");
var logger = require("../../logger").logger;
var util = require('util');
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
        };
    }

    /**
     * Returns full path to locales
     * @returns {void | Promise<void> | Promise<any>}
     */
    getLocalesPath() {
        return path.resolve(__dirname, './locales');
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
            }];
        }

        if (!config.credentials.hasOwnProperty("password")) {
            return [false, {
                error_type: "email.errors.nopassword",
                error_data: {}
            }];
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
    handleMessage(config, message) {
        logger.debug("Executing e-mail node...");

        // Sanity checks
        if (!message.hasOwnProperty("payload")) {
            logger.debug("... e-mail node was not successfully executed.");
            logger.error("E-mail node has no payload.");
            return Promise.reject(new Error("email.errors.nopayload"));
        }
        // End of sanity checks

        logger.debug("Preparing e-mail options...");
        let sendopts = {
            subject: config.subject,
            to: (config.to || message.to),
            from: ((message.from) ? message.from : (config.from || "dojot@noemail.com"))
        };

        if (message.hasOwnProperty("envelope")) {
            sendopts.envelope = message.envelope;
        }

        let body;
        try {
            body = this._get(config.body, message);
        } catch (e) {
            logger.debug("... e-mail node was not successfully executed.");
            logger.error(`Error while retrieving e-mail body: ${e}`);
            return Promise.reject(new Error("email.errors.nobody"));
        }

        // plaintext body
        sendopts.text = ensureString(body);
        // html body
        if (/<[a-z][\s\S]*>/i.test(sendopts.text)) {
            sendopts.html = sendopts.text;
        }

        logger.debug("... e-mail options were successfully build");
        logger.debug("E-mail will be sent as: ");
        logger.debug(`${util.inspect(sendopts, {depth: null})}`);


        logger.debug("Preparing SMTP transport handler...");
        let smtpOptions = {
            host: config.server,
            port: config.port,
            secure: config.secure
        };

        logger.debug(`Using e-mail config: ${util.inspect(smtpOptions, {depth: null})}`);

        if (config.hasOwnProperty('credentials')) {
            if (config.credentials.userid && config.credentials.password) {
                smtpOptions.auth = {
                    user: config.credentials.userid,
                    pass: config.credentials.password
                };
                logger.debug(`Sending e-mail on behalf of ${smtpOptions.auth.user}`);
            } else {
                logger.debug("No user and no password were set.");
            }
        }

        let smtpTransport = nodemailer.createTransport(smtpOptions);

        if (!smtpTransport) {
            logger.debug("... e-mail transport was not successfully created.");
            logger.debug("... e-mail node was not successfully executed.");
            logger.error("Could not create SMTP transport.");
            return Promise.reject(new Error("email.errors.nosmtptransport"));
        } else {
            logger.debug("... e-mail transport was successfully created.");
        }

        return new Promise( (resolve, reject) => {
            logger.debug("Sending e-mail...");
            smtpTransport.sendMail(sendopts, function (error) {
                if (error) {
                    logger.debug("... e-mail node was not successfully executed.");
                    logger.error(`Error while executing e-mail node: ${error}`);
                    return reject(error);
                } else {
                    logger.debug("... e-mail was successfully sent.");
                    logger.debug("... e-mail node was successfully executed.");
                    return resolve([]);
                }
            });
        });

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
