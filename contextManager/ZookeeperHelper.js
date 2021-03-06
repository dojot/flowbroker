"use strict";

var ZooKeeper = require ('zookeeper');
const logger = require("@dojot/dojot-module-logger").logger;


function _createNodes(basePath, pathArray, pathIndex, zkClient) {
    return new Promise ((resolve, reject) => {
        let newZNode = '';
        do {
            if (pathIndex === pathArray.length) {
                return resolve();
            }
            newZNode = pathArray[pathIndex];
            ++pathIndex;
        } while (newZNode === ''); //skip empty znode

        basePath = basePath + '/' + newZNode;

        zkClient.a_create (basePath, "", 0, (rc, error, path) => {
            if ( (rc !== 0) && (rc !== ZooKeeper.ZNODEEXISTS) ) {
                logger.error(`could not create znode: ${rc}, error: ${error}, path=${path}`, { filename: 'zkHelper' });
                return reject();
            }
            _createNodes(basePath, pathArray, pathIndex, zkClient).then(
                () => {
                    resolve();
                }).catch(() => {
                    reject();
                });
        });
    });
}

/**
 * @description creates 1 or more znodes based on the given path
 * @param {string} basePath the base path where the path will be created
 * @param {string} path the target path to be created
 * @param {ZooKeeper} zkClient the zookeeper client
 */
function createPath (basePath, path, zkClient) {
    return new Promise ((resolve, reject) => {
        let pathArray = path.split('/');
        _createNodes(basePath, pathArray, 0, zkClient).then(() => {
            resolve();
        }).catch(() => {
            reject();}
        );
    });
}

/**
 * @description creates 1 or more znodes based on the given path
 * @param {string} basePath the base path where the path will be created
 * @param {string} path the target path to be created
 * @param {ZooKeeper} zkClient the zookeeper client
 */
function createPathIfNotExists (basePath, path, zkClient) {
    return new Promise ((resolve, reject) => {
        let targetPath = basePath + '/' + path;
        zkClient.a_exists(targetPath, false, (rc, error) => {
            if (rc === ZooKeeper.ZNONODE) {
                createPath(basePath, path, zkClient).then(() => {
                    return resolve();
                }).catch(() => {
                    return reject();
                });
                return;
            } else if (rc === 0) {
                return resolve();
            }
            logger.error(`Unexpected behavior. Exists result: ${rc}. Error: ${error}`, { filename: 'zkHelper' });
            reject();
            return;
        });
    });
}

exports.createPath = createPath;
exports.createPathIfNotExists = createPathIfNotExists;