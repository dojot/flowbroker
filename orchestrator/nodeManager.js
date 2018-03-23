"use strict";

var fs = require('fs');

// TODO - remove the following
var change = require('./nodes/change/index').Handler;
var edge = require('./nodes/edge/index').Handler;
var email = require('./nodes/email/index').Handler;
var geo = require('./nodes/geo/index').Handler;
var http = require('./nodes/http/index').Handler;
var select = require('./nodes/switch/index').Handler;
var template = require('./nodes/template/index').Handler;
var device_in = require('./nodes/device-in/device-in').Handler;
var device_out = require('./nodes/device-out/device-out').Handler;
var publisher = require('./publisher');

class NodeManager {
    constructor() {
        this.nodes = {
            "change": new change(),
            "email": new email(),
            "geofence": new geo(),
            "http_request_out": new http(),
            "switch": new select(),
            "template": new template(),
            "device in": new device_in,
            "device out": new device_out(publisher)
        };
    }

    asJson() {
        return {}
    }

    asHtml() {
        let result = "";
        for (let node in this.nodes) {
            let data = fs.readFileSync(this.nodes[node].getNodeRepresentationPath());
            result = result + '\n' + data;
        }
        return result;
    }

    getNode(type) {
        return this.nodes[type];
    }
}

module.exports = {Manager: NodeManager};