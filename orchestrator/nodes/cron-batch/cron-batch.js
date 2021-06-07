"use strict";

const util = require('util');
const axios = require('axios');
const path = require('path');
const logger = require("@dojot/dojot-module-logger").logger;
const dojot = require('@dojot/flow-node');

class DataHandler extends dojot.DataHandlerBase {
    constructor() {
        super();
    }

    getNodeRepresentationPath() {
        return path.resolve(__dirname, 'cron-batch.html');
    }

    getMetadata() {
        return {
            'id': 'dojot/cron-batch',
            'name': 'cron-batch',
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
        const payload = { 
            'preferred_username': 'flowbroker',
            "iss": "http://internal/auth/realms/"+tenant,
             // to ensure backward compatibility
            'service': tenant,
            'username': 'flowbroker',
         };
        return (new Buffer('jwt schema').toString('base64')) + '.' +
        (new Buffer(JSON.stringify(payload)).toString('base64')) + '.' +
        (new Buffer('dummy signature').toString('base64'));
    }

    _removeSingleJob(tenant, jobId, timeout) {
        return new Promise((resolve, reject) => {
            axios({
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${this._makeJwtToken(tenant)}`
                },
                url: `http://cron:5000/cron/v1/jobs/${jobId}`,
                timeout: timeout
            }).then(response => {
                logger.debug(`Succeeded to remove cron job ${jobId}`, { filename: 'cron-batch' });
                return resolve();

            }).catch(error => {
                logger.error(`Failed to remove cron job ${jobId} (${error}).`, { filename: 'cron-batch' });
                return reject(error);
            });
        });
    }

    _removeMultipleJobs(tenant, jobIds, timeout) {
        let removePromises = [];
        for(let id of jobIds) {
            removePromises.push(this._removeSingleJob(tenant, id, timeout));
        }
        return Promise.all(removePromises);
    }

    _createSingleJob(tenant, jobRequest, timeout) {
        return new Promise((resolve, reject) => {
            axios({
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this._makeJwtToken(tenant)}`,
                    "Content-Type": "application/json"
                },
                url: `http://cron:5000/cron/v1/jobs`,
                data: JSON.stringify(jobRequest),
                timeout: timeout
            }).then(response => {
                let jobId = response.data.jobId;
                logger.debug(`Succeeded to create cron job ${jobId}`, { filename: 'cron-batch' });
                return resolve(jobId);

            }).catch(error => {
                logger.error(`Failed to create cron job (${JSON.stringify(error)}).`, { filename: 'cron-batch' });
                return reject(error);
            });
        });
    }

    _createMultipleJobs(tenant, requests, timeout) {
        let createPromises = [];
        for(let req of requests) {
            createPromises.push(this._createSingleJob(tenant, req, timeout));
        }
        return Promise.all(createPromises);
    }

    handleMessage(config, message, metadata) {
        let timeout = config.timeout;
        if (isNaN(timeout) || (timeout <= 0)) {
            return Promise.reject(new Error(`Invalid timeout.`));
        }
        logger.debug("Executing cron-batch node...", { filename: 'cron-batch' });
        return new Promise(async (resolve, reject) => {
            try {
                switch(config.operation) {
                    case "CREATE":
                    {
                        let requests = this._get(config.jobs, message);
                        if(!util.isArray(requests)) {
                            logger.debug(`The input must be an array of job requests.`, { filename: 'cron-batch' });
                            return reject(new Error(`The input must be an array of job requests.`));
                        }
                        let jobIds = await this._createMultipleJobs(metadata.tenant, requests, timeout);
                        this._set(config.outJobIds, jobIds, message);
                        break;
                    }
                    case "REMOVE":
                    {
                        let jobIds = this._get(config.inJobIds, message);
                        if(!util.isArray(jobIds)) {
                            logger.debug(`The input must be an array of job identifiers.`, { filename: 'cron-batch' });
                            return reject(new Error(`The input must be an array of job identifiers.`));
                        }
                        await this._removeMultipleJobs(metadata.tenant, jobIds, timeout);
                        break;
                    }
                    default:
                    {
                        logger.debug(`Invalid operation: ${config.operation}`, { filename: 'cron-batch' });
                        return reject(new Error(`Invalid Operation: ${config.operation}`));
                    }
                }
            }
            catch(error) {
                logger.error(`Failed to execute cron job requests (${error}).`, { filename: 'cron-batch' });
                return reject(error);
            }

            return resolve([message]);
        });
    }
}

module.exports = { Handler: DataHandler };
