"use strict";

var zmq = require('zeromq');
var ZooKeeper = require ('zookeeper');
var ZookeeperRWLock = require ('./ZookeeperRWLock.js');
var bodyParser = require("body-parser");
var express = require("express");
var app = express();
const DojotLogger = require("@dojot/dojot-module-logger");
const logger = DojotLogger.logger;

function checkField(target, field, message) {
  if (!target[field]) {
    throw new Error(message);
  }
}

const READ = 0;
const WRITE = 1;

/**
 * @description This class implements a context handler. It opens a ZeroMQ socket
 * (router type) and waits for commands to get and save contexts. These contexts
 * are stored in the zookeeper. This class ensures that the access to the context
 * is exclusive following the read/write lock procedure.
 *
 * The following messages are accepts by this handler:
 *
 * [rlock_and_get]: lock the context for reading and retrieve its content
 * message format: JSON
 * request:
 * {
 *   "command": "rlock_and_get",
 *   "data": {
 *     "context_name": <the context's name>
 *     "request_id": <a string that identifies the lock/unlock request, it must
 *                    be unique during the lock process>
 *   }
 * }
 * response:
 * on success:
 * {
 *   "request_id": <the request_id given in the request>
 *   "context_content": <the context context in utf8 format>
 *   "result": "ok"
 * }
 * on failure:
 * {
 *   "request_id": <the request_id given in the request>
 *   "result": "error"
 *   "reason": <a string that describes the reason>
 * }
 *
 * [wlock_and_get]: lock the context for writing and retrieve its content
 * message format: JSON
 * request:
 * {
 *   "command": "wlock_and_get",
 *   "data": {
 *     "context_name": <the context's name>
 *     "request_id": <a string that identifies the lock/unlock request, it must
 *                    be unique during the lock process>
 *   }
 * }
 * response:
 * on success:
 * {
 *   "request_id": <the request_id given in the request>
 *   "context_content": <the context context in utf8 format>
 *   "result": "ok"
 * }
 * on failure:
 * {
 *   "request_id": <the request_id given in the request>
 *   "result": "error"
 *   "reason": <a string that describes the reason>
 * }
 *
 * [lock_get_and_unlock]: lock the context for reading and retrieve its content and
 * unlock it immediately
 * message format: JSON
 * request:
 * {
 *   "command": "lock_get_and_unlock",
 *   "data": {
 *     "context_name": <the context's name>
 *     "request_id": <a string that identifies the request, it must
 *                    be unique during the process>
 *   }
 * }
 * response:
 * on success:
 * {
 *   "request_id": <the request_id given in the request>
 *   "context_content": <the context context in utf8 format>
 *   "result": "ok"
 * }
 * on failure:
 * {
 *   "request_id": <the request_id given in the request>
 *   "result": "error"
 *   "reason": <a string that describes the reason>
 * }
 *
 * [save_and_unlock]: saves a given context and removes the lock
 * message format: JSON
 * request:
 * {
 *   "command": "save_and_unlock",
 *   "data": {
 *     "request_id": <the request_id used in the lock request>
 *     "context_content": <the context context in utf8 format>
 *   }
 * }
 * response:
 * on success:
 * {
 *   "request_id": <the request_id given in the request>
 *   "result": "ok"
 * }
 * on failure:
 * {
 *   "request_id": <the request_id given in the request>
 *   "result": "error"
 *   "reason": <a string that describes the reason>
 * }
 *
 * [unlock]: just unlock the context
 * message format: JSON
 * request:
 * {
 *   "command": "unlock",
 *   "data": {
 *     "request_id": <the request_id used in the lock request>
 *   }
 * }
 * response:
 * on success:
 * {
 *   "request_id": <the request_id given in the request>
 *   "result": "ok"
 * }
 * on failure:
 * {
 *   "request_id": <the request_id given in the request>
 *   "result": "error"
 *   "reason": <a string that describes the reason>
 * }
 *
 * [dump]: dumps internal structures, for debug/development purpose
 * request:
 * {
 *   "command": "dump"
 * }
 * response:
 * None
 */
class ContextHandler {
  /**
   * @description Initializes the ContextHandler
   * @param {string} zookeeperAddr Zookeeper hostname or IP address
   * @param {int} zookeeperPort Zookeeper port
   * @param {int} zeroMQPort zeroMQ port
   * @param {int} holdLockTimeout how long a client can hold a lock (time in ms)
   * @param {int} waitLockTimeout how long a client can wait for a lock (time in ms)
   */
  constructor(zookeeperAddr, zookeeperPort, zeroMQPort, holdLockTimeout, waitLockTimeout) {
    this.zkAddr = zookeeperAddr;
    this.zkPort = zookeeperPort;
    this.zmqPort = zeroMQPort;
    this.holdLockTimeout = holdLockTimeout;
    this.waitLockTimeout = waitLockTimeout;
    this.controlMap = {};
    this.zkClient = null;
    this.zkRWLock = null;
    this.zmqSock = null;
  }

  init() {
    this.zmqSock = zmq.socket('router');

    this.zkClient = new ZooKeeper({
      connect: this.zkAddr.toString() + ':' + this.zkPort.toString(),
      timeout: 15000,
      debug_level: ZooKeeper.ZOO_LOG_LEVEL_WARN,
      host_order_deterministic: false
    });

  	this.zkClient.connect( (err) => {

      if (err) {
        logger.error(`Failed to connect on zookeeper. Error: ${err}`);
        return;
      }

      this.zkRWLock = new ZookeeperRWLock(this.zkClient);

      this.zkRWLock.init('context-manager').then( () => {
        this.zmqSock.on("message", (identity, request) => {
          let payload;
          let promise = undefined;

          //parse the payload
          try {
            payload = JSON.parse(request.toString());
          } catch (error) {
            logger.warn(`Invalid JSON format. Discarding request: ${request.toString()}`);
            return;
          }

          try {
            checkField(payload, 'command', "Request is missing command field");

            switch (payload.command) {
              case 'rlock_and_get':
                checkField(payload, 'data', "Request is missing data field");
                promise = this._lock_and_get(identity, payload.data, READ);
                break;
              case 'wlock_and_get':
                checkField(payload, 'data', "Request is missing data field");
                promise = this._lock_and_get(identity, payload.data, WRITE);
                break;
              case 'lock_get_and_unlock':
                checkField(payload, 'data', "Request is missing data field");
                promise = this._lock_and_get(identity, payload.data, READ).then( (response) => {
                  return this._unlock(identity, payload.data).then(() => {
                    return Promise.resolve(response);
                  });
                });
                break;
              case 'save_and_unlock':
                checkField(payload, 'data', "Request is missing data field");
                promise = this._save_and_unlock(identity, payload.data);
                break;
              case 'unlock':
                checkField(payload, 'data', "Request is missing data field");
                promise = this._unlock(identity, payload.data);
                break;
              case 'dump':
                this._dump();
                return;
              default:
                logger.warn(`Unknown command: ${payload.command}`);
                return;
            }

            promise.then( (response) => {
              this.zmqSock.send([identity, JSON.stringify(response)]);
            }).catch((response) => {
              if (response.request_id) {
                this.zmqSock.send([identity, JSON.stringify(response)]);
              } else {
                logger.warn(response);
              }
            });
          } catch (error) {
            logger.warn(`Exception: ${error}`);
            return;
          }
        }); // on message

        this.zmqSock.bind('tcp://*:' + this.zmqPort.toString(), (err) => {
          if (err) {
            logger.error(`Failed on bind the zmq port. Error: ${err}`);
            process.exit(1);
          } else {
            logger.info(`zmq listening on ${this.zmqPort}`);
          }
        });

        process.on('SIGINT', () => {
          this.zmqSock.close();
        });
      }).catch( () => {
        logger.error("Fail to init zookeeper lock");
        process.exit(1);
      });
    });
  }

  async _lock_and_get(identity, data, lockMode) {
    checkField(data, 'context_name', "Request is missing context_name field");
    checkField(data, 'request_id', "Request is missing request_id field");

    let targetLockMode;
    if (lockMode === READ) {
      targetLockMode = this.zkRWLock.rlock.bind(this.zkRWLock);
    } else {
      targetLockMode = this.zkRWLock.wlock.bind(this.zkRWLock);
    }

    return targetLockMode(data.context_name, this.waitLockTimeout).then( (lock) => {
      return new Promise( (resolve, reject) => {
        logger.debug(`ZMQ connection ${identity.toString('hex')}, requestId: ${data.request_id} acquired the lock ${lock.getDataPath()}`);

        // now that we have the lock, it is safe to retrieve the context content
        this.zkClient.a_get(lock.getDataPath(), false,
          (rc, error, stat, protectedData) => {
            if (rc !== 0) {
                logger.warn(`Failed to get data from context. Error: ${error}`);

                let response = {
                  request_id: data.request_id,
                  result: "error",
                  reason: "internal error"
                };
                return reject(response);
            }

            if (protectedData == null) {
              protectedData = "";
            }

            // configure a timer to control how long a requestor can hold a lock
            let timer = setTimeout(this._timeout, this.holdLockTimeout, lock, identity, data, this);
            this.controlMap[identity + '.' + data.request_id] = {
              lockMode: lockMode,
              lock: lock,
              timerToUnlock: timer
            };

            let response = {
              request_id: data.request_id,
              context_content: protectedData.toString('utf8'),
              result: "ok"
            };
            return resolve(response);
        }); // a_get
      });
    }).catch( (error) => {
      logger.error(`lock failed. Error: ${error}`);
      let response = {
        request_id: data.request_id,
        result: "error",
        reason: error
      };
      return Promise.reject(response);
    });
  } //_lock_and_get

  async _save_and_unlock(identity, data) {
    return new Promise ((resolve, reject) => {
      checkField(data, 'request_id', "Request is missing request_id field");
      checkField(data, 'context_content', "Request is missing context_content field");

      if (!this.controlMap.hasOwnProperty(identity + '.' + data.request_id)) {
        logger.error('entry does not exists');
        let response = {
          request_id: data.request_id,
          result: "error",
          reason: "lock does not exist"
        };
        return reject(response);
      }

      let controlEntry = this.controlMap[identity + '.' + data.request_id];
      if (controlEntry.lockMode === READ) {
        logger.error('invalid operation');
        let response = {
          request_id: data.request_id,
          result: "error",
          reason: "trying to write while holding a read lock"
        };
        return reject(response);
      }
      delete this.controlMap[identity + '.' + data.request_id];

      // cancel the lock hold timer
      clearTimeout(controlEntry.timerToUnlock);

      let buf = Buffer.from(data.context_content, 'utf8');

      logger.debug(`writing on ${controlEntry.lock.getDataPath()} data: ${buf}`);
      // -1 make it matches with any node's version
      this.zkClient.a_set(controlEntry.lock.getDataPath(), buf, -1, (rc, error) => {
        if (rc !== 0) {
          logger.error(`failed to write context data. Error ${error}`);
          let response = {
            request_id: data.request_id,
            result: "error",
            reason: "fail to write context"
          };
          return reject(response);
        }

        controlEntry.lock.unlock().then(() => {
          let response = {
            request_id: data.request_id,
            result: "ok"
          };
          return resolve(response);
        }).catch( () => {
          let response = {
            request_id: data.request_id,
            result: "error",
            reason: "internal error"
          };
          return reject(response);
        });
      });
    });
  } // _save_and_unlock

  async _unlock(identity, data) {
    checkField(data, 'request_id', "Request is missing request_id field");

    if (!this.controlMap.hasOwnProperty(identity + '.' + data.request_id)) {
      logger.error('entry does not exists');
      let response = {
        request_id: data.request_id,
        result: "error",
        reason: "lock does not exist"
      };
      return Promise.reject(response);
    }

    let controlEntry = this.controlMap[identity + '.' + data.request_id];
    delete this.controlMap[identity + '.' + data.request_id];

    // cancel the lock hold timer
    clearTimeout(controlEntry.timerToUnlock);

    return controlEntry.lock.unlock().then(() => {
        let response = {
          request_id: data.request_id,
          result: "ok"
        };
        return Promise.resolve(response);
      }).catch(() => {
        let response = {
          request_id: data.request_id,
          result: "error",
          reason: "internal error"
        };
        return Promise.reject(response);
      });
  } // _unlock

  _timeout(lock, identity, data, contextManager) {
    delete contextManager.controlMap[identity + '.' + data.request_id];

    logger.warn(`lock hold time timed out. identity: ${identity.toString('hex')} request: ${data.request_id} path: ${lock.getLockPath()}`);

	  lock.unlock().then(
      () => {
        logger.warn(`${lock.getLockPath()} was unlock because it exceeded the time to hold a lock`);
      },
      (error) => {
        logger.error(`Failed to unlock ${lock.getLockPath()} (hold lock timeout case). Error: ${error}`);
      }
	  );
  } // _timeout

  _dump() {
    let count = 0;
    for (let k in this.controlMap) {
      if (this.controlMap.hasOwnProperty(k)) {
        console.log(k);
        ++count;
      }
    }
    console.log("%d entries on control map", count);
  } // _dump
}


let zkHost = process.env.ZOOKEEPER_HOST || "zookeeper";
let zkPort = process.env.ZOOKEEPER_PORT || 2181;
let servicePort = process.env.SERVICE_PORT || 80;
let zmqPort = process.env.ZEROMQ_PORT || 5556;
let holdLockTimeout = process.env.HOLD_LOCK_TIMEOUT || 10000;
let waitLockTimeout = process.env.WAIT_LOCK_TIMEOUT || 30000;
let logLevel = process.env.LOG_LEVEL || 'info';

if (logger.setLevel(logLevel) !== 0) {
  logger.error(`Invalid logger level: ${logLevel}`);
  process.exit(1);
}

app.use(bodyParser.json());
app.use(DojotLogger.getHTTPRouter());
app.listen(servicePort, () => {
  logger.info(`Listening on port ${servicePort}.`);
});

let handler = new ContextHandler(zkHost,
                                 zkPort,
                                 zmqPort,
                                 holdLockTimeout,
                                 waitLockTimeout);
handler.init();
