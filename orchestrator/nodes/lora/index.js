"use strict";
const path = require('path');
const dojot = require('@dojot/flow-node');
const lorapacket = require('lora-packet');
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
            let data = this._get(config.in, message);
            let nwkSKey = Buffer.from(config.nsw, "hex");
            let appSKey = Buffer.from(config.asw, "hex");

            //console.log("PHYPayload: " + data);
            data = data.trim();
            nwkSKey = nwkSKey ? new Buffer.from(nwkSKey, 'hex') : undefined;
            appSKey = appSKey ? new Buffer.from(appSKey, 'hex') : undefined;
            const enc = data.match(/^[0-9A-F]*$/i) ? 'hex' : 'base64';

            let packet = lorapacket.fromWire(new Buffer.from(data, enc));
            const isJoinAccept = packet.getMType() === 'Join Accept';
            const isJoin = isJoinAccept || packet.getMType() === 'Join Request';
            let decoded = packet.toString();

            // For a Join Request, we only need the AppKey, so allow NwkSKey to be empty
            if (appSKey) {
                // In LoRaWAN 1.0.x, the value of FCnt only holds the 16 least-significant bits (LSB) of the
                // actual frame counter. But for a 32 bits frame counter still all 32 bits are used when
                // calculating the MIC. So, brute-force to find the counter's 16 most significant bits. This
                // will try 65,536 values...
                let fCntMsb;
                const msb = new Buffer(2);//Possivel erro tentar sem from
                let i;
                for (i = 0; i < 1 << 16; i++) {
                    msb.writeUInt16LE(i, 0);
                    // TODO This needs AppKey, not AppSKey, for Join Accept
                    if (lorapacket.verifyMIC(packet, nwkSKey, appSKey, msb)) {
                        fCntMsb = ('0000' + i.toString(16)).toUpperCase().substr(-4);
                        //console.log(`Found MSB: 0x${fCntMsb}`);
                        //console.log(`32 bits FCnt: ${i << 16 | packet.getFCnt()}`);
                        break;
                    }
                }

                // When no MSB is found, show the expected value for MSB 0x0000 rather than for 0xFFFF:
                const expected = lorapacket.calculateMIC(packet, nwkSKey, appSKey, fCntMsb ? msb : null);
                const valid = lorapacket.verifyMIC(packet, nwkSKey, appSKey, fCntMsb ? msb : null);
                var mic_status = lorapacket.verifyMIC(packet, nwkSKey, appSKey, fCntMsb ? msb : null) ? "OK" : "fail";
                decoded = decoded.replace(/^(.*MIC = .*$)/m, '$1 (from packet)' + (valid ? '' : ' <strong style="color: #f00">INVALID</strong> (tried MSB 0000-'
                    + ('0000' + (i - 1).toString(16)).toUpperCase().substr(-4) + ')')
                    + '\n = ' + expected.toString('hex').toUpperCase()
                    + ' (expected, assuming 32 bits frame counter with MSB '
                    + (fCntMsb ? fCntMsb : '0000') + ')'
                );

                if (valid) {
                    // The first occurence of "FCnt" is for FHDR and includes "(Big Endian); we want the 2nd occurence
                    // in the summary, which is a bare decimal number
                    decoded = decoded.replace(/^(.*FCnt = [0-9]*$)/m,
                        '$1 (from packet, 16 bits) \n = ' + (i << 16 | packet.getFCnt())
                        + ' (32 bits, assuming MSB 0x' + ('0000' + i.toString(16)).substr(-4) + ')'
                    );
                };

                if (!isJoin) {
                    const payload = lorapacket.decrypt(packet, appSKey, nwkSKey);
                    // We don't have to align the additional line here, as it will be re-aligned later
                    decoded = decoded.replace(/^(.*FRMPayload) = .+$/m, (match, m1) => `${match}(from packet, encrypted) 
                            = ${payload.toString('hex').toUpperCase()} (decrypted)`
                    );
                };

            } // if(appSKey) end                     

            else {
                decoded += '\nProvide AppSKey and NwkSKey to validate MIC and decrypt payload';
            };

            // Align the output on the '=' character with as little leading whitespace as possible 
            // (and fix an alignment error in the lora-packet 0.7.3 output):
            const lines = decoded.split('\n');
            const lengths = lines.map(s => s.replace(/^\s*(.*)( = .*)$/, (match, m1, m2) => m1).length);
            const max = Math.max(...lengths.filter(length => length > 0));
            decoded = lines.map(s => s.replace(/^\s*(.*)( = .*)$/, (match, m1, m2) => ' '.repeat(max - m1.length) + m1 + m2)).join('\n');

            //console.log("Decoded FRMPayload (ASCI): " + lorapacket.decrypt(packet, appSKey, nwkSKey).toString());
            console.log(`Assuming ${enc}-encoded packet\n${data}\n\n${decoded}`);

            let newFRMpayload = lorapacket.decrypt(packet, appSKey, nwkSKey);

            var json_packet = {
                Type: packet.getMType(),
                Direction: packet.getDir(),
                DevAddr: packet.getBuffers().DevAddr.toString("hex"),
                FRMpayload: newFRMpayload.toString("hex"),
                FCnt: packet.getFCnt(),
                MIC: mic_status
            };

            console.log("Type: " + packet.getMType());
            console.log("Direction: " + packet.getDir());
            console.log("DevAddr: " + packet.getBuffers().DevAddr.toString("hex"));
            console.log("FRMpayload: " + newFRMpayload.toString("hex"));
            console.log("FCnt: " + packet.getFCnt());
            console.log("MIC: " + mic_status);           
            console.log("JSON Packet: " + json_packet);

            this._set(config.out, json_packet, message);

            return Promise.resolve([message]);

        } //handle try (first) end 
        catch (error) {
            return Promise.reject(error);
        }

    }//handleMessage(config, message)

}//class DataHandler extends dojot.DataHandlerBase

module.exports = { Handler: DataHandler };
