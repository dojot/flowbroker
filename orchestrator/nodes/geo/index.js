"use strict";

const path = require('path');
const logger = require("../../logger").logger;
const geolib = require('geolib');
const dojot = require('@dojot/flow-node');

class DataHandler extends dojot.DataHandlerBase {


    /**
     * Returns full path to html file
     * @return {string} String with the path to the node representation file
     */
    getNodeRepresentationPath() {
        return path.resolve(__dirname, 'geo.html');
    }

    /**
     * Returns node metadata information
     * This may be used by orchestrator as a liveliness check
     * @return {object} Metadata object
     */
    getMetadata() {
        return {
            'id': 'dojot/geofence',
            'name': 'geofence',
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
     * @param  {Function}     callback Callback to call upon processing completion
     * @return {[undefined]}
     */
    handleMessage(config, message) {
        logger.debug("Executing geo node...");
        let geolocation = getLatLng(message.payload);

        if (!geolocation) {
            logger.debug("... geo node was not successfully executed.");
            logger.error("Message has no geographic position attached.");
            return Promise.reject(new Error("Message has no geographic position attached"));
        }

        let inout = geolib.isPointInside(geolocation, config.points);

        if (inout && (config.filter === "inside")) {
            if (config.name) {
                if (!message.location) {
                    message.location = {};
                }
                message.location.isat = message.location.isat || [];
                message.location.isat.push(config.name);
            }
            logger.debug("... geo node was successfully executed.");
            logger.debug("Its test had a hit.");
            return Promise.resolve([message]);
        }

        if (!inout && (config.filter === "outside")) {
            logger.debug("... geo node was successfully executed.");
            logger.debug("Its test had a hit.");
            return Promise.resolve([message]);
        }


        logger.debug("... geo node was successfully executed.");
        logger.debug("Its test didn't have a hit.");
        return Promise.resolve([]);

        /**
         * Look for a lat,lng string repesentation and return an
         * object representation of it if any is found.
         *
         * @param  {[object]}  payload Message payload
         * @return {[{latitude: string, longitude: string}]}
         */
        function getLatLng(payload) {
            let latlng = /([+-]?\d+(.\d+)?)[ ]*,[ ]*([+-]?\d+(.\d+)?)/;

            for (let attr in payload) {
                if (payload.hasOwnProperty(attr) && typeof payload[attr] === "string") {
                    let parsed = payload[attr].match(latlng);

                    if (parsed) {
                        return {
                            latitude: parsed[1],
                            longitude: parsed[3]
                        };
                    }
                }
            }

            return null;
        }
    }
}

// var main = new DojotHandler(new DataHandler());
module.exports = { Handler: DataHandler };
