/* jshint node: true */
/* jshint esversion: 6 */
"use strict";

var fs = require('fs');
var path = require('path');
var express = require('express');

var nodeManager = require('../../nodeManager');
var nodes = new nodeManager.Manager();

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
        let handler = nodes.getNode(nodeid);
        if (handler) {
          let data = handler.getLocaleData('en-US');
          // console.log(nodeid, data);
          return res.status(200).send(data);
        }

        return res.status(404).send({message:"Unknown node"});

      }
      /*
       * For newer node-red GUI versions, a single call to /locales/nodes is perfomred
       * TODO refactor/update gui frontend
       */
    });

    app.get('/nodes', (req, res) => {
      const expectedResponseType = req.accepts(['application/json', 'text/html']);
      return res.format({
        html: () => {
          res.status(200).send(nodes.asHtml());
          // const filepath = path.join(__dirname, 'tinker/nodes.html');
          // try {
          //   const data = fs.readFileSync(filepath);
          //   res.status(200).send(data);
          // } catch (e) {
          //   res.status(500).send();
          // }
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
