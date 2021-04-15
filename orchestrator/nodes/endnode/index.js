"use strict";
const path = require('path');
const dojot = require('@dojot/flow-node');
const binaryParser = require('binary-parser')
const splice = require('buffer-splice');
const { Console } = require('console');

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
            //let nwkSKey = Buffer.from(config.nsw, "hex");          

            // Module import
            var Parser = require("binary-parser").Parser;

            //FRMpayload = "040002000F43C80F5C4124000044802D71412926E9412926E90024005500550055";

            //var FRMpayload_raw = Buffer.from(FRMpayload, "hex");

            var headStart = 0
            var headEnd = 2    
            var bodyEnd = FRMpayload.length
            
            var aplicacao = FRMpayload.substring(headStart, headEnd)
            //timestamp_raw = FRMpayload.substring(timestampStart, bodyStart)
            var body_raw = FRMpayload.substring(headEnd, bodyEnd)
            
            var FRMpayload_buffer = Buffer.from(body_raw, "hex");

            console.log("aplicação: " + aplicacao)    
            console.log("body: " + body_raw)

            var aplicacao01 = new Parser()
                .floatbe("Timestamp")
                .floatbe("TensaoRMSFaseA")
                .floatbe("TensaoRMSFaseB")
                .floatbe("TensaoRMSFaseC")    
                .floatbe("CorrenteRMSFaseA")
                .floatbe("CorrenteRMSFaseB")
                .floatbe("CorrenteRMSFaseC")
                .floatbe("CorrenteRMSneutro")    
                .floatbe("FrequenciaFaseA")
                .floatbe("FrequenciaFaseB")
                .floatbe("FrequenciaFaseC")    
                .floatbe("PotenciaAtivaFaseA")
                .floatbe("PotenciaAtivaFaseB")
                .floatbe("PotenciaAtivaFaseC")
                .floatbe("PotenciaAtivaTotal")    
                .floatbe("PotenciaReativaFaseA")
                .floatbe("PotenciaReativaFaseB")
                .floatbe("PotenciaReativaFaseC")
                .floatbe("PotenciaReativaTotal")    
                .floatbe("PotenciaAparenteFaseA")
                .floatbe("PotenciaAparenteFaseB")
                .floatbe("PotenciaAparenteFaseC")
                .floatbe("PotenciaAparenteTotal")    
                .floatbe("FatordePotenciaFaseA")
                .floatbe("FatordePotenciaFaseB")
                .floatbe("FatordePotenciaFaseC")
                .floatbe("FatordePotenciaTotal")    
                .floatbe("ConsumoFaseA")
                .floatbe("ConsumoFaseB")
                .floatbe("ConsumoFaseC")
                .floatbe("ConsumoTotal");
                
            var aplicacao04 = new Parser()
                .floatbe("Timestamp")
                .floatbe("TensaoCC")
                .floatbe("CorrenteCC")
                .floatbe("PotenciaCC")
                .floatbe("EnergiaFornecida")
                .floatbe("EnergiaConsumida")    
                .uint16be("Temperatura")
                .uint16be("Status")
                .uint16be("SaudeBateria")
                .uint16be("EstadoCarga");

            var FRMpayload_decoded

            switch(aplicacao){
                case "01":
                var FRMpayload_decoded = aplicacao01.parse(FRMpayload_buffer)
                var json_endnode = {
                    aplicacao: aplicacao,                                
                    Timestamp: FRMpayload_decoded.Timestamp,
                    TensaoRMSFaseA: FRMpayload_decoded.TensaoRMSFaseA,
                    TensaoRMSFaseb: FRMpayload_decoded.TensaoRMSFaseB,                
                    TensaoRMSFaseC: FRMpayload_decoded.TensaoRMSFaseC,
                    CorrenteRMSFaseA: FRMpayload_decoded.CorrenteRMSFaseA,
                    CorrenteRMSFaseB: FRMpayload_decoded.CorrenteRMSFaseB,
                    CorrenteRMSFaseC: FRMpayload_decoded.CorrenteRMSFaseC,
                    CorrenteRMSneutro: FRMpayload_decoded.CorrenteRMSneutro
                };
                this._set(config.out, json_endnode, message);
                break;
                case "04":
                var FRMpayload_decoded = aplicacao04.parse(FRMpayload_buffer)      
                break;
            }

            console.log("FRMpayload_decoded: " + FRMpayload_decoded)


            return Promise.resolve([message]);

        } //handle try (first) end 
        catch (error) {
            return Promise.reject(error);
        }

    }//handleMessage(config, message)

}//class DataHandler extends dojot.DataHandlerBase

module.exports = { Handler: DataHandler };
