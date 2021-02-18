"use strict";
const path = require('path');
const dojot = require('@dojot/flow-node');
const lora_packet = require('lora-packet');
const splice = require('buffer-splice');

// Sample node implementation
class DataHandler extends dojot.DataHandlerBase {
    constructor() {
        super();
    }

    /**
     * Returns full path to html file
     * @return {[string]} [description]
     */
    getNodeRepresentationPath() {
        return path.resolve(__dirname, 'lora-node.html');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {[type]} [description]
     */
    getMetadata() {
        return {
            // ID can actually be any unique human-friendly string
            // on proper node-red modules it is "$module/$name"
            'id': 'dojot/lora-node',
            // This is usually the name of the node
            'name': 'lora-node',
            // This is usually the name of the node (as in npm) module
            'module': 'lora-node',
            'version': '1.0.0',
        };
    }


    /**
     * Returns full path to locales
     * @returns {String} Path segments into an absolute path.
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
     * @return {[Promise]}
     */
    handleMessage(config, message) {
        try {
            console.log(message);
            let NwkSKey = Buffer.from(config.nsw, "hex");
            let AppSKey = Buffer.from(config.asw, "hex");

            let payload = this._get(config.in, message)
            var packet = lora_packet.fromWire(Buffer.from(payload, 'base64'));
            console.log("Decrypted (ASCII)='" + lora_packet.decrypt(packet, AppSKey, NwkSKey).toString() + "'");
            this._set(config.out,lora_packet.decrypt(packet, AppSKey, NwkSKey).toString(),message)
            return Promise.resolve('Sucesso');
        } catch (error) {
            return Promise.reject(error);
        }
    }
}

module.exports = { Handler: DataHandler };