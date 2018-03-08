/* jshint node: true */
/* jshint esversion: 6 */
"use strict";

var fs = require('fs');
var path = require('path');
var express = require('express');

// TODO remove the following
let DojotHandler = require('dojot-node-library');

var change = require('../../nodes/change/index').Handler;
var edge = require('../../nodes/edge/index').Handler;
var email = require('../../nodes/email/index').Handler;
var geo = require('../../nodes/geo/index').Handler;
var http = require('../../nodes/http/index').Handler;
var select = require('../../nodes/switch/index').Handler;
var template = require('../../nodes/template/index').Handler;
//
var nodes = {
  "change": new change(),
  "edgedetection": new edge(),
  "email": new email(),
  "geofence": new geo(),
  "http_request_out": new http(),
  "switch": new select(),
  "template": new template()
};

// ---

module.exports = class NodeAPI {
  constructor() {}

  registerExpress(app) {
    // images required by node-red GUI, keymap file
    app.use(express.static(path.join(__dirname, '../public')));

    app.get('/locales/*', (req, res) => {
      // '/locales/'.lenth = 9
      const resource = req.path.slice(9);

      let data;
      if (['editor', 'jsonata', 'infotips', 'node-red'].includes(resource)) {
        const filepath = path.join(__dirname, '../locales/en-US/' + resource + '.json');
        try {
          data = JSON.parse(fs.readFileSync(filepath));
          return res.status(200).send(data);
        } catch (e) {
          return res.status(500).send();
        }
      } else {

        // maps to node-provided locale file
        // TODO

        const nodeid = resource.match(/[^\/]+$/)[0];
        if (Object.keys(nodes).includes(nodeid)) {
          let data = nodes[nodeid].getLocaleData('en-US');
          console.log(nodeid, data);
          return res.status(200).send(data);
        }

        const filepath = path.join(__dirname, 'tinker' + resource);
        try {
          data = JSON.parse(fs.readFileSync(filepath));
          return res.status(200).send(data);
        } catch (e) {
          if (e.code == 'ENOENT') {
            return res.status(404).send();
          }
          console.error(e);
          return res.status(500).send();
        }

        return res.status(404).send();
      }

      return res.status(404).send();

      /*
       * For newer node-red GUI versions, a single call to /locales/nodes is perfomred
       * TODO refactor/update gui frontend
       */
    });

    app.get('/nodes', (req, res) => {
      const expectedResponseType = req.accepts(['application/json', 'text/html']);
      return res.format({
        html: () => {
          const filepath = path.join(__dirname, 'tinker/nodes.html');
          try {
            const data = fs.readFileSync(filepath);
            res.status(200).send(data);
          } catch (e) {
            res.status(500).send();
          }
        },

        json: () => {
          const filepath = path.join(__dirname, 'tinker/nodes.json');
          try {
            const data = JSON.parse(fs.readFileSync(filepath));
            res.status(200).send(data);
          } catch (e) {
            res.status(500).send();
          }
        }
      });
    });
  }
};
