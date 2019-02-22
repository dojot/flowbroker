/* jshint node: true */
/* jshint esversion: 6 */
"use strict";

const fs = require('fs');
const path = require('path');
const express = require('express');
const nodes = require('../../nodeManager').Manager;
const Locale = require('../../locale');

module.exports = class NodeAPI {
    constructor() {
    }

    registerExpress(app) {
        // images required by node-red GUI, keymap file
        app.use(express.static(path.join(__dirname, '../public')));

        app.get('/locales/*', async (req, res) => {

            const language = Locale.getSlugLanguage(req);

            const resource = req.path.slice(9);
            const service = req.service;

            let data;
            if (['editor', 'jsonata', 'infotips', 'node-red'].includes(resource)) {
                let filepath = path.join(__dirname, '../locales/' + language + '/' + resource + '.json');
                try {
                    if (!fs.existsSync(filepath)) {
                        filepath = path.join(__dirname, '../locales/' + Locale.getSlugDefaultLanguage() + '/' + resource + '.json');
                    }
                    data = JSON.parse(fs.readFileSync(filepath));
                    return res.status(200).send(data);
                } catch (e) {
                    return res.status(500).send();
                }
            } else {

                // maps to node-provided locale file
                const nodeid = resource.match(/[^/]+$/)[0];
                let handler = nodes.getNode(nodeid, service);
                if (handler) {
                    const localData = await handler.getLocaleData(language, Locale.getSlugDefaultLanguage() );
                    return res.status(200).send(localData);
                }

                handler = nodes.getNode(nodeid.replace(/-/g, ' '), service);
                if (handler) {
                    const localData = await handler.getLocaleData(language, Locale.getSlugDefaultLanguage() );
                    return res.status(200).send(localData);
                }

                return res.status(404).send({message: "Unknown node"});
            }
            /*
             * For newer node-red GUI versions, a single call to /locales/nodes is perfomred
             * TODO refactor/update gui frontend
             */
        });

        app.get('/nodes', (req, res) => {
            return res.format({
                html: () => {
                    res.status(200).send(nodes.asHtml(req.service));
                },

                json: () => {
                    res.status(200).send(nodes.asJson(req.service));
                }
            });
        });
    }


};
