"use strict";

let os = require('os');
let fs = require('fs');
let util = require('util');
let path = require('path');
let DojotHandler = require('dojot-node-library');

// Sample node implementation
class DataHandler {

    /**
     * Returns full path to html file
     * @return {string} String with the path to the node representation file
     */
    getNodeRepresentationPath() {
        return path.resolve(__dirname, 'change.html');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {object} Metadata object
     */
    getMetadata() {
        return {
            'id': 'dojot/change',
            'name': 'change',
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
        let filepath = path.join(__dirname, "locales/" + locale + "/change.json");
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

        let jsonata = require("jsonata");
        let rule;

        for (let i = 0; i < config.rules.length; i++) {
            rule = config.rules[i];
            // Migrate to type-aware rules
            if (!rule.pt) {
                rule.pt = "msg";
            }
            if (rule.t === "change" && rule.re) {
                rule.fromt = 're';
                delete rule.re;
            }
            if (rule.t === "set" && !rule.tot) {
                if (rule.to.indexOf("msg.") === 0 && !rule.tot) {
                    rule.to = rule.to.substring(4);
                    rule.tot = "msg";
                }
            }
            if (!rule.tot) {
                rule.tot = "str";
            }
            if (!rule.fromt) {
                rule.fromt = "str";
            }
            if (rule.t === "change" && rule.fromt !== 'msg' && rule.fromt !== 'flow' && rule.fromt !== 'global') {
                rule.fromRE = rule.from;
                if (rule.fromt !== 're') {
                    rule.fromRE = rule.fromRE.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
                }
                try {
                    rule.fromRE = new RegExp(rule.fromRE, "g");
                } catch (e) {

                    return [false, {
                        error_type: "change.errors.invalid-from",
                        error_data: {
                            error: e.message
                        }
                    }];
                }
            }

            if (rule.tot === 'num') {
                rule.to = Number(rule.to);
            } else if (rule.tot === 'json') {
                try {
                    // check this is parsable JSON
                    JSON.parse(rule.to);
                } catch (e2) {

                    return [false, {
                        error_type: "change.errors.invalid-json",
                        error_data: {}
                    }];
                }
            } else if (rule.tot === 'bool') {
                rule.to = /^true$/i.test(rule.to);
            } else if (rule.tot === 'jsonata') {
                try {
                    rule.to = jsonata(rule.to);
                } catch (e) {
                    return [false, {
                        error_type: "change.errors.invalid-from",
                        error_data: {
                            error: e.message
                        }
                    }];
                }
            }
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

            let response = message;
            response[os.hostname()] = true;

            for (let i = 0; i < config.rules.length; i++) {

                try {
                    if (config.rules[i].t === "move") {
                        let r = config.rules[i];

                        if ((r.tot !== r.pt) || (r.p.indexOf(r.to) !== -1)) {
                            response = applyRule(response, {t: "set", p: r.to, pt: r.tot, to: r.p, tot: r.pt});
                            applyRule(response, {t: "delete", p: r.p, pt: r.pt});
                        }
                        else {
                            response = applyRule(response, {t: "set", p: "_temp_move", pt: r.tot, to: r.p, tot: r.pt});
                            applyRule(response, {t: "delete", p: r.p, pt: r.pt});
                            response = applyRule(response, {t: "set", p: r.to, pt: r.tot, to: "_temp_move", tot: r.pt});
                            applyRule(response, {t: "delete", p: "_temp_move", pt: r.pt});
                        }
                    } else {
                        response = applyRule(response, config.rules[i]);
                    }

                    if (response === null) {
                        // TODO: Check what to do here.
                        return;
                    }
                } catch (e) {
                    callback(e, [response])
                }
            }
            callback(undefined, [response]);
        }, 10);

        function applyRule(msg, rule) {

            let property = rule.p;
            let value = rule.to;

            if (rule.tot === 'json') {
                value = JSON.parse(rule.to);
            }

            let current;
            let fromValue;
            let fromType;
            let fromRE;

            if (rule.tot === "msg") {
                value = util.getMessageProperty(msg, rule.to);

            } else if (rule.tot === 'flow') {
                // TODO: Get flow context
                return

            } else if (rule.tot === 'global') {
                // TODO: Get global context
                return

            } else if (rule.tot === 'date') {
                value = Date.now();

            } else if (rule.tot === 'jsonata') {
                value = rule.to.evaluate({msg: msg});

            }

            if (rule.t === 'change') {

                if (rule.fromt === 'msg' || rule.fromt === 'flow' || rule.fromt === 'global') {

                    if (rule.fromt === "msg") {
                        fromValue = util.getMessageProperty(msg, rule.from);

                    } else if (rule.tot === 'flow') {
                        // TODO: Get flow context

                    } else if (rule.tot === 'global') {
                        // TODO: Get global context

                    }

                    if (typeof fromValue === 'number' || fromValue instanceof Number) {
                        fromType = 'num';

                    } else if (typeof fromValue === 'boolean') {
                        fromType = 'bool'

                    } else if (fromValue instanceof RegExp) {
                        fromType = 're';
                        fromRE = fromValue;

                    } else if (typeof fromValue === 'string') {
                        fromType = 'str';
                        fromRE = fromValue.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");


                        try {
                            fromRE = new RegExp(fromRE, "g");
                        } catch (e) {
                            throw new Error(e);
                        }

                    } else {
                        throw new Error("unsupported type: " + (typeof fromValue));
                    }

                } else {
                    fromType = rule.fromt;
                    fromValue = rule.from;
                    fromRE = rule.fromRE;
                }
            }

            if (rule.pt === 'msg') {
                if (rule.t === 'delete') {
                    util.setMessageProperty(msg, property, undefined);

                } else if (rule.t === 'set') {
                    util.setMessageProperty(msg, property, value);

                } else if (rule.t === 'change') {
                    current = util.getMessageProperty(msg, property);

                    if (typeof current === 'string') {
                        if ((fromType === 'num' || fromType === 'bool' || fromType === 'str') && current === fromValue) {
                            // str representation of exact from number/boolean
                            // only replace if they match exactly
                            util.setMessageProperty(msg, property, value);

                        } else {
                            current = current.replace(fromRE, value);
                            util.setMessageProperty(msg, property, current);

                        }

                    } else if ((typeof current === 'number' || current instanceof Number) && fromType === 'num') {
                        if (current == Number(fromValue)) {
                            util.setMessageProperty(msg, property, value);
                        }

                    } else if (typeof current === 'boolean' && fromType === 'bool') {
                        if (current.toString() === fromValue) {
                            util.setMessageProperty(msg, property, value);
                        }

                    }
                }
            } else {

                let target;
                if (rule.pt === 'flow') {
                    // TODO: Get flow context
                } else if (rule.pt === 'global') {
                    // TODO: Get global context
                }

                // TODO: Target is set from flow or global context
                if (target) {
                    if (rule.t === 'delete') {
                        target.set(property, undefined);

                    } else if (rule.t === 'set') {
                        target.set(property, value);

                    } else if (rule.t === 'change') {
                        current = target.get(msg, property);
                        if (typeof current === 'string') {
                            if ((fromType === 'num' || fromType === 'bool' || fromType === 'str') && current === fromValue) {
                                target.set(property, value);

                            } else {
                                current = current.replace(fromRE, value);
                                target.set(property, current);

                            }
                        } else if ((typeof current === 'number' || current instanceof Number) && fromType === 'num') {
                            if (current == Number(fromValue)) {
                                target.set(property, value);

                            }

                        } else if (typeof current === 'boolean' && fromType === 'bool') {
                            if (current.toString() === fromValue) {
                                target.set(property, value);

                            }
                        }
                    }
                }
            }

            return [msg, undefined];
        }
    }
}

// var main = new DojotHandler(new DataHandler());
module.exports = {Handler: DataHandler};
