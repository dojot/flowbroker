"use strict";

let path = require('path');
const logger = require("@dojot/dojot-module-logger").logger;
var dojot = require('@dojot/flow-node');

// Sample node implementation
class DataHandler extends dojot.DataHandlerBase {
    constructor() {
        super();
        this.operators = {
            'eq': function (a, b) { return a === b; },
            'neq': function (a, b) { return a !== b; },
            'lt': function (a, b) { return a < b; },
            'lte': function (a, b) { return a <= b; },
            'gt': function (a, b) { return a > b; },
            'gte': function (a, b) { return a >= b; },
            'btwn': function (a, b, c) { return a >= b && a <= c; },
            'cont': function (a, b) { return (a + "").indexOf(b) !== -1; },
            'regex': function (a, b, c, d) { return (a + "").match(new RegExp(b, d ? 'i' : '')); },
            'true': function (a) { return a === true; },
            'false': function (a) { return a === false; },
            'null': function (a) { return (typeof a === "undefined" || a === null); },
            'nnull': function (a) { return (typeof a !== "undefined" && a !== null); },
            'else': function (a) { return a === true; }
        };
    }

    /**
     * Returns full path to html file
     * @return {string} String with the path to the node representation file
     */
    getNodeRepresentationPath() {
        return path.resolve(__dirname, 'switch.html');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {object} Metadata object
     */
    getMetadata() {
        return {
            'id': 'dojot/switch',
            'name': 'switch',
            'module': 'dojot',
            'version': '1.0.0',
        };
    }

    /**
     * Returns full path to locales
     * @returns String
     */
    getLocalesPath() {
        return path.resolve(__dirname, './locales');
    }

    /**
     * Check if the node configuration is valid
     * @param {object} config  Configuration data for the node
     * @return {[boolean, object]} Boolean variable stating if the configuration is valid or not and error message
     */
    checkConfig(config) {

        let jsonata = require("jsonata");

        config.rules = config.rules || [];
        config.propertyType = config.propertyType || "msg";

        if (config.propertyType === 'jsonata') {
            try {
                config.property = jsonata(config.property);
            } catch (err) {

                return [false, {
                    error_type: "switch.errors.invalid-expr",
                    error_data: {
                        error: err.message
                    }
                }];
            }
        }

        config.checkall = config.checkall || "true";
        config.previousValue = null;
        for (let i = 0; i < config.rules.length; i += 1) {
            let rule = config.rules[i];

            if (!rule.vt) {
                rule.vt = this._getType(rule.v);
            }

            if (rule.vt === 'num') {
                if (!isNaN(Number(rule.v))) {
                    rule.v = Number(rule.v);
                }
            } else if (rule.vt === "jsonata") {
                try {
                    rule.v = jsonata(rule.v);
                } catch (err) {

                    return [false, {
                        error_type: "switch.errors.invalid-expr",
                        error_data: {
                            error: err.message
                        }
                    }];
                }
            }

            if (typeof rule.v2 !== 'undefined') {
                if (!rule.v2t) {
                    rule.v2t = this._getType(rule.v2);
                }
                if (rule.v2t === 'num') {
                    rule.v2 = Number(rule.v2);
                } else if (rule.v2t === 'jsonata') {
                    try {
                        rule.v2 = jsonata(rule.v2);
                    } catch (err) {

                        return [false, {
                            error_type: "switch.errors.invalid-expr",
                            error_data: {
                                error: err.message
                            }
                        }];
                    }
                }
            }
        }

        return [true, null];
    }

    /**
     *
     * @param {string} field Path to field to be set
     * @param {object} target Object to read from
     */
    _get(field, target) {
        let source = field.match(/([^.]+)/g);
        let at = source.shift();
        let data = target;
        while (at) {
            if (!data.hasOwnProperty(at)) {
                return undefined;
            }

            data = data[at];
            at = source.shift();
        }

        return data;
    }

    /**
     *
     * @param {string} value Path to field to be read
     * @param {string} type Expected type (js) to be returned
     * @returns {*} Evalueted value
     */
    _getTyped(value, type) {
        switch (type) {
            case "num":
                return Number(value);
            case "str":
                return value;
            default:
                return value;
        }
    }

    /**
     *
     * @param {string} value 
     * @returns {*} value type
     */
     _getType(value) {
        let valueType;

        if (!isNaN(Number(value))) {
            valueType = 'num';
        } else {
            valueType = 'str';
        }

        return valueType;
    }

     /**
      *
     * @param  {[type]}         config          Node configuration to be used for this message
     * @param  {[type]}         message         Message being processed
     * @param  {[type]}         ruleValue       Value to be retrieved    
     * @param  {[type]}         ruleValueType   Type of value to be retrieved  
     * @return {*} value            
     */
    retrieveRuleValue(config, message, ruleValue, ruleValueType){
        let retrievedValue;

        if (ruleValueType === 'prev') {
            retrievedValue = config.previousValue;
        } else if (ruleValueType === 'jsonata') {
            try {
                retrievedValue = ruleValue.evaluate({ msg: message });
            } catch (err) {
                logger.debug("... switch node was not successfully executed.", { filename: 'switch' });
                logger.error(`Error while evaluating value in jsonata first test: ${err}`, { filename: 'switch' });
                return Promise.reject(err);
            }
        } else if (ruleValueType === 'msg') {
            try {
                retrievedValue = this._get(ruleValue, message);
                let checkedType = this._getType(retrievedValue);
                retrievedValue = this._getTyped(retrievedValue, checkedType);
            } catch (error) {
                logger.debug("... switch node was not successfully executed.", { filename: 'switch' });
                logger.error(`Error while retrieving variables from switch node: ${error}`, { filename: 'switch' });
                return Promise.reject(error);
            }
        } else if (typeof ruleValue !== 'undefined') {
            retrievedValue = this._getTyped(ruleValue, ruleValueType);
            // v1 = util.evaluateNodeProperty(rule.v, rule.vt, config, message);
        }

        return retrievedValue;
    }


    /**
     * Statelessly handle a single given message, using given node configuration parameters
     *
     * This method should perform all computation returned by the node, transforming its inputs
     * into outputs. When such processing is done, the node should issue a call to the provided
     * callback, notifying either failure to process the message with given config, or the set
     * of transformed messages to be sent to the flow's next hop.
     *
     * @param  {[type]}       config   Node configuration to be used for this message
     * @param  {[type]}       message  Message to be processed
     * @return {[undefined]}
     */
    handleMessage(config, message) {
        logger.debug("Executing switch node...", { filename: 'switch' });

        let onward = [];
        try {
            let value;
            let prop;
            try {
                value = this._get(config.property, message);
            } catch (error) {
                logger.debug("... switch node was not successfully executed.", { filename: 'switch' });
                logger.error(`Error while retrieving variables from switch node: ${error}`, { filename: 'switch' });
                return Promise.reject(error);
            }
            prop = this._getTyped(value, config.propertyType);

            let elseflag = true;
            for (let i = 0; i < config.rules.length; i += 1) {
                let rule = config.rules[i];
                let test = prop;

                let v1 = this.retrieveRuleValue(config, message, rule.v, rule.vt);
                let v2 = this.retrieveRuleValue(config, message, rule.v2, rule.v2t);

                if (rule.t === "else") {
                    test = elseflag;
                    elseflag = true;
                }

                logger.debug(`Conditions: ${rule.t} ${v1} and ${v2}   `, { filename: 'switch' })
                if (this.operators[rule.t](test, v1, v2, rule.case)) {
                    onward.push(message);
                    elseflag = false;
                    if (config.checkall === "false") { break; }
                } else {
                    onward.push(null);
                }
            }
            config.previousValue = prop;
            logger.debug("... switch node was successfully executed.", { filename: 'switch' });
            return Promise.resolve(onward);

        } catch (err) {
            logger.debug("... switch node was not successfully executed.", { filename: 'switch' });
            logger.error(`Error while executing switch node: ${err}`, { filename: 'switch' });
            return Promise.reject(err);
        }
    }
}

module.exports = { Handler: DataHandler };
