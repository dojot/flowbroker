"use strict";

const path = require('path');
const logger = require("@dojot/dojot-module-logger").logger;
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
        logger.debug("Executing geo node...", {filename: 'geo'});

        let geoLocationString = '';
        try {
            geoLocationString = this._get(config.geopoint, message);
        } catch (e) {
            logger.debug("... geo node was not successfully executed.", {filename: 'geo'});
            logger.error("It was not possible find attribute associated with geo coordinate.", {filename: 'geo'});
            return Promise.reject(new Error("It was not possible find attribute associated with geo coordinate"));
        }

        let geolocation = getLatLng(geoLocationString);
        if (!geolocation) {
            logger.debug("... geo node was not successfully executed.", {filename: 'geo'});
            logger.error("Message has no geographic position attached.", {filename: 'geo'});
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
            logger.debug("... geo node was successfully executed.", {filename: 'geo'});
            logger.debug("Its test had a hit.", {filename: 'geo'});
            return Promise.resolve([message]);
        }

        if (!inout && (config.filter === "outside")) {
            logger.debug("... geo node was successfully executed.", {filename: 'geo'});
            logger.debug("Its test had a hit.", {filename: 'geo'});
            return Promise.resolve([message]);
        }


        logger.debug("... geo node was successfully executed.", {filename: 'geo'});
        logger.debug("Its test didn't have a hit.", {filename: 'geo'});
        return Promise.resolve([]);

        /**
         * Look for a lat,lng string representation and return an
         * object representation of it if any is found.
         *
         * @return {{latitude: (*|string), longitude: (*|string)} || null}
         * @param geoLocation
         */
        function getLatLng(geoLocation) {
            let regLatLong = /([+-]?\d+(.\d+)?)[ ]*,[ ]*([+-]?\d+(.\d+)?)/;
            if (geoLocation && typeof geoLocation === 'string') {
                let parsed = geoLocation.match(regLatLong);

                if (parsed) {
                    return {
                        latitude: parsed[1],
                        longitude: parsed[3]
                    };
                }
            }
            return null;
        }
    }
}

module.exports = {Handler: DataHandler};
