"use strict";

const path = require('path');
const dojot = require('@dojot/flow-node');
const handlebars = require('handlebars');
const mustache = require('mustache');
const logger = require("@dojot/dojot-module-logger").logger;

class DataHandler extends dojot.DataHandlerBase {
    constructor() {
        super();
        handlebars.registerHelper('stringify', function(context) {
            return JSON.stringify(context);
        });
        
        handlebars.registerHelper("math", function(lvalue, operator, rvalue, options) {
            if (arguments.length < 4) {
                // Operator omitted, assuming "+"
                options = rvalue;
                rvalue = operator;
                operator = "+";
            }
                
            lvalue = parseFloat(lvalue);
            rvalue = parseFloat(rvalue);
                
            return {
                "+": lvalue + rvalue,
                "-": lvalue - rvalue,
                "*": lvalue * rvalue,
                "/": lvalue / rvalue,
                "%": lvalue % rvalue
            }[operator];
        });        
    }

    /**
     * Returns full path to html file
     * @return {string} String with the path to the node representation file
     */
    getNodeRepresentationPath() {
        return path.resolve(__dirname, 'template.html');
    }

    /**
     * Returns full path to locales
     * @returns String
     */
    getLocalesPath() {
        return path.resolve(__dirname, './locales');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {object} Metadata object
     */
    getMetadata() {
        return {
            'id': 'dojot/template',
            'name': 'template',
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
    handleMessage(config, message, metadata) {
        var fullMessage = JSON.parse(JSON.stringify(message));
        fullMessage.payloadMetadata = JSON.parse(JSON.stringify(metadata));
        try {
            let templateData = config.template;
            let data = '';
            switch(config.syntax) {
                case 'handlebars': {
                    let template = handlebars.compile(templateData);
                    data = template(fullMessage);
                    break;
                }
                case 'plain':
                    data = config.template;
                    break;
                case 'mustache':
                    data = mustache.render(templateData, fullMessage);
                    break;
                default:
                    logger.error(`Unsupported syntax on template node: ${config.syntax}`, { filename: 'template' });
                    return Promise.reject('configuration error');
            }

            if (config.output === 'json') {
                data = JSON.parse(data);
            }
            this._set(config.field, data, message);
            logger.debug("... template node was successfully executed.", { filename: 'template' });
            return Promise.resolve([message]);
        } catch (error) {
            logger.debug("... template node was not successfully executed.", { filename: 'template' });
            logger.error(`Error while executing template node: ${error}`, { filename: 'template' });
            return Promise.reject(error);
        }
    }
}

// var main = new DojotHandler(new DataHandler());
module.exports = {Handler: DataHandler};
