"use strict";

module.exports = class DataHandlerBase {

    /**
     * Returns full path to html file
     * @return {string} A string with the path to html file
     */
    getNodeRepresentationPath() {
        throw new Error('You have to implement the method getNodeRepresentationPath!');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {object} An object with the following attributes
     *    'id':  ID can actually be any unique human-friendly string
     *           on proper node-red modules it is "$module/$name"
     *    'name': This is usually the name of the node
     *    'module': This is usually the name of the node (as in npm) module
     *    'version': This is the node's version
     */
    getMetadata() {
        throw new Error('You have to implement the method getMetadata!');
    }

    /**
     * Returns object with locale data (for the given locale)
     * @param  {string} locale Locale string, such as "en-US"
     * @return {object}        Locale settings used by the module
     * todo: give more information about the return
     */
    getLocaleData() {
        throw new Error('You have to implement the method getLocaleData!');
    }

    /**
     * Statelessly handle a single given message, using given node configuration parameters
     *
     * This method should perform all computation required by the node, transforming its inputs
     * into outputs. When such processing is done, the node should issue a call to the provided
     * callback, notifying either failure to process the message with given config, or the set
     * of transformed messages to be sent to the flow's next hop.
     *
     * @param  {object}       config   Node configuration to be used for this message
     * @param  {object}       message  Message to be processed
     * @param  {object}       contextHandler An object to deal with the context, if necessary.
     * See the class ContextHandler to more details
     * @param  {object}       metadata An object with the metadata from this execution
     * It is possible to retrieve the following attributes:
     * - tenant
     * - flowId
     * - originatorDeviceId
     * @return {Promise}
     * todo: give more information about the config, message
     */
    /* eslint no-unused-vars: ["error", { "args": "none" }] */
    handleMessage(config, message, metadata, contextHandler) {
        throw new Error('You have to implement the method handleMessage!');
    }

    /**
     *
     * @param {string} field Path to field to be set
     * @param {string} value Value to set field to
     * @param {object} target Object to be modified
     */
    _set(field, value, target) {
        let source = field.match(/([^.]+)/g);
        let key = source.shift();
        let at = target;
        while (key) {
            if (source.length) {
            if (!at.hasOwnProperty(key)) {
                at[key] = {};
            }
            at = at[key];
            } else {
            at[key] = value;
            }
            key = source.shift();
        }
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
            throw new Error(`Unknown property ${field} requested`);
            }

            data = data[at];
            at = source.shift();
        }

        return data;
    }
}
