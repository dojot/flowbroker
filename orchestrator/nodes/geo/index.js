"use strict";

let fs = require('fs');
let path = require('path');
var dojot = require('@dojot/flow-node');

// TODO:

// Sample node implementation
class DataHandler {
    constructor() {
    }

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
        }
    }

    /**
     * Returns object with locale data (for the given locale)
     * @param  {[string]} locale Locale string, such as "en-US"
     * @return {[object]}        Locale settings used by the module
     */
     getLocaleData(locale) {

         let filepath = path.join(__dirname, "locales/" + locale + "/geo.json");
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

            var loc = undefined;

            if (message.location && message.location.lat && message.location.lon) {
                loc = {
                    latitude: message.location.lat,
                    longitude: message.location.lon
                };
            } else if (message.lon && message.lat) {
                loc = {
                    latitude: message.lat,
                    longitude: message.lon
                };
            } else if (typeof(message.payload) === 'object' && message.payload.lat && message.payload.lon) {
                loc = {
                    latitude: message.payload.lat,
                    longitude: message.payload.lon
                };
            }

            if (loc) {
                var inout = false;
                if (config.mode === 'circle') {
                    inout = geolib.isPointInCircle( loc, config.centre, Math.round(config.radius) );
                } else {
                    inout = geolib.isPointInside( loc, config.points );
                }

                if (inout && (config.filter === "inside")) {
                    if (config.name) {
                        if (!message.location) {
                            message.location = {};
                        }
                        message.location.isat = message.location.isat || [];
                        message.location.isat.push(config.name);
                    }
                    callback(undefined, [message])
                }

                if (!inout && (config.filter === "outside")) {
                   callback(undefined, [message])
                }

                if (config.filter === "both") {
                    if (!message.location) {
                        message.location = {};
                    }

                    message.location.inarea = inout;
                    if (config.name) { // if there is a name
                        message.location.isat = message.location.isat || [];
                        if (inout) { // if inside then add name to an array
                            message.location.isat.push(config.name);
                        }
                        else { // if outside remove name from array
                            if (message.location.hasOwnProperty("isat")) {
                                var i = message.location.isat.indexOf(config.name);
                                if (i > -1) {
                                    message.location.isat.splice(i, 1);
                                }
                            }
                        }

                        message.location.inarea = message.location.isat.length;

                        //add distrance to centroid of area
                        var distance;
                        if (config.mode === 'circle') {
                            distance = geolib.getDistance(config.centre, loc);
                        } else {
                            var centroid = geolib.getCenter(config.points);
                            distance = geolib.getDistance(centroid, loc);
                        }

                        message.location.distances = message.location.distances || [];
                        var d = {};
                        d[config.name] = distance;
                        message.location.distances.push(d);
                    }

                    callback(undefined, message)
                }
            }

        }, 10);

    }
}

// var main = new DojotHandler(new DataHandler());
module.exports = {Handler: DataHandler};
