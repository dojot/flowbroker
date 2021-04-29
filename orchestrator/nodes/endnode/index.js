"use strict";
const path = require('path');
const dojot = require('@dojot/flow-node');
const binaryParser = require('binary-parser')
const splice = require('buffer-splice');
const { Console } = require('console');
const fs = require('fs');
const aplication = require('./id-map.json');

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
        return path.resolve(__dirname, 'endnode.html');
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
            'id': 'dojot/endnode',
            // This is usually the name of the node
            'name': 'endnode',
            // This is usually the name of the node (as in npm) module
            'module': 'endnode',
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
            let FRMpayload = this._get(config.in, message);            

            // Module import
            var Parser = require("binary-parser").Parser;

            var headStart = 0;
            var headEnd = 2;    
            var bodyEnd = FRMpayload.length;
                
            var aplicacao = FRMpayload.substring(headStart, headEnd);
            var body_raw = FRMpayload.substring(headEnd, bodyEnd);
                
            var FRMpayload_buffer = Buffer.from(body_raw, "hex");

            console.log("aplicação: " + aplicacao); 
            console.log("body: " + body_raw);

            const reducer = (map, currentValue) => { 
                const [key, value] = currentValue;
                map.set(key, eval(value));
                return map;
            }

            var myMap = Object.entries(aplication).reduce(reducer , new Map());
            
            if(myMap.get(aplicacao) == null){
                
                throw new Error("Aplicação não encontrada");

            } else{
                
                var FRMpayload_decoded = myMap.get(aplicacao).parse(FRMpayload_buffer);
                console.log(FRMpayload_decoded);
                this._set(config.out, FRMpayload_decoded, message);
                return Promise.resolve([message]); 
            }          

        } //handle try (first) end 
        catch (error) {

            return Promise.reject(error);

        }

    }//handleMessage(config, message)

}//class DataHandler extends dojot.DataHandlerBase

module.exports = { Handler: DataHandler };
