"use strict";

const axios = require('axios');
const path = require('path');
const logger = require('../../logger').logger;
const dojot = require('@dojot/flow-node');

class DataHandler extends dojot.DataHandlerBase {
    constructor() {
        super();
    }

    getNodeRepresentationPath() {
        return path.resolve(__dirname, 'cron.html');
    }

    getMetadata() {
        return {
            'id': 'dojot/cron',
            'name': 'cron',
            'module': 'dojot',
            'version': '1.0.0',
        };
    }

    checkConfig() {
        return [true, null];
    }

    getLocalesPath() {
        return path.resolve(__dirname, './locales');
    }

    _makeJwtToken(tenant) {
        const payload = { 'service': tenant, 'username': 'flowbroker' };
        return (new Buffer('jwt schema').toString('base64')) + '.' +
        (new Buffer(JSON.stringify(payload)).toString('base64')) + '.' +
        (new Buffer('dummy signature').toString('base64'));
    }

    _removeJob(tenant, jobId) {
        return new Promise((resolve, reject) => {
            axios({
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${this._makeJwtToken(tenant)}`
                },
                url: `http://cron:5000/cron/v1/jobs/${jobId}`,
                timeout: 1000
            }).then(response => {
                logger.debug(`Succeeded to remove cron job ${jobId}`);
                return resolve();

            }).catch(error => {
                logger.debug(`Failed to remove cron job ${jobId} (${error}).`);
                return reject(error);
            });
        });
    }

    _createJob(tenant, jobRequest) {
        return new Promise((resolve, reject) => {
            axios({
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this._makeJwtToken(tenant)}`,
                    "Content-Type": "application/json"
                },
                url: `http://cron:5000/cron/v1/jobs`,
                data: JSON.stringify(jobRequest),
                timeout: 1000
            }).then(response => {
                let jobId = response.data.jobId;
                logger.debug(`Succeeded to create cron job ${jobId}`);
                return resolve(jobId);

            }).catch(error => {
                logger.debug(`Failed to create cron job (${JSON.stringify(error.response.data)}).`);
                return reject(error);
            });
        });
    }

    handleMessage(config, message, metadata) {
        logger.debug("Executing cron node...");
        return new Promise(async (resolve, reject) => {
            try {
                switch(config.operation) {
                    case "CREATE":
                    {
                        logger.debug("Executing create operation ...");
                        let jobRequest = {
                            time: config.cronTimeExpression,
                            name: config.jobName,
                            description: config.jobDescription
                        };

                        // Job Action
                        let job = this._get(config.jobAction, message);
                        switch(typeof job) {
                            case "string":
                                job =  JSON.parse(job);
                                break;
                            case "object":
                                break;
                            default:
                                logger.debug(`Invalid job action. It must be a JSON.`);
                                return reject(new Error(`Invalid job action: ${config.jobAction}`));
                        }
                        // Broker
                        if(config.jobType === "EVENT REQUEST") {
                            jobRequest.broker = job;
                        }
                        // Http
                        else {
                            jobRequest.http = job;
                        }
                        let jobId = await this._createJob(metadata.tenant, jobRequest);
                        this._set(config.outJobId, jobId, message);
                        break;
                    }
                    case "REMOVE":
                    {
                        logger.debug("Executing remove operation ...");
                        let jobId = this._get(config.inJobId, message);
                        await this._removeJob(metadata.tenant, jobId);
                        break;
                    }
                    default:
                    {
                        logger.debug(`Invalid operation: ${config.operation}`);
                        return reject(new Error(`Invalid Operation: ${config.operation}`));
                    }
                }
            }
            catch(error) {
                logger.debug(`Failed to execute cron job request (${error}).`);
                return reject(error);
            }
            return resolve([message]);
        });
    }
}

module.exports = { Handler: DataHandler };
