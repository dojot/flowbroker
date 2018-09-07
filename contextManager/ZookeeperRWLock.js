'use strict';

var ZooKeeper = require ("zookeeper");
var ZooKeeperHelper = require ("./ZookeeperHelper.js");


const READ = 0;
const WRITE = 1;

function findNextElemToBeWatchedWriteCase(array, target) {
    let previous;
    let previousValue = 0;
    let targetValue = target.substring(6);

    array.forEach(element => {
        let elemValue = element.substring(6);
        if ( (elemValue > previousValue) && (elemValue < targetValue) ) {
            previousValue = elemValue;
            previous = element;
        }
    });

    if (previous === target) {
        return null;
    }
    return previous;
}

function findNextElemToBeWatchedReadCase(array, target) {
    let previous;
    let previousValue = 0;
    let targetValue = target.substring(6);

    array.forEach(element => {
        if (element.charAt(0) === 'w') {
            let elemValue = element.substring(6);
            if ( (elemValue > previousValue) && (elemValue < targetValue) ) {
                previousValue = elemValue;
                previous = element;
            }
        }
    });

    if (previous === target) {
        return null;
    }
    return previous;
}

/**
 * @description This class implements the zookeeper's recipe to read write locks
 * reference: https://zookeeper.apache.org/doc/r3.4.12/recipes.html#sc_recipes_Locks
 * access: September 05th 2018
 */
module.exports = class ZookeeperRWLock {

    /**
     * @description Basic constructor
     * @param {ZooKeeper} zk The zookeeper client with an active connection
     */
    constructor(zk) {
        this.libBasePath = "/zk-rwlocks"; // this is the base path on zookeeper,
                                          // all data created with this class
                                          // stays under this path
        this.zkClient = zk;               // The zookeeper client
    }

    /**
     * @description Initializes the
     * @param {string} appPathPrefix the path prefix, all data will be located
     * under this path (the path can not start with '/')
     */
    init(appPathPrefix) {
        return new Promise ((resolve, reject) => {

            if (appPathPrefix.startsWith('/')) {
                console.error('appPathPrefix can not start with /');
                return reject();
            }
            this.appPathPrefix = appPathPrefix;
            this.pathPrefix = this.libBasePath + "/" + appPathPrefix;
            ZooKeeperHelper.createPath("", this.pathPrefix, this.zkClient).then(
                () => {
                    resolve();
                }).catch(() => {
                    reject();
                }
            );
        });
    } // init

    rlock(dataName, waitLockTimeout) {
        return this._lock(dataName, waitLockTimeout, READ);
    }

    wlock(dataName, waitLockTimeout) {
        return this._lock(dataName, waitLockTimeout, WRITE);
    }

    /**
     * @description locks a specific data
     * @param {string} dataName the data to be locked, it can a name or a path. For
     * example, if a path is given, this method creates all znodes that belongs
     * to it
     * @param {int} waitLockTimeout how long (in ms) the user accept to wait
     * for the lock
     * @return a promise
     * on resolve:
     *  lock: a LockInstance object
     * on reject:
     *  error: a string with the error. It can be 'internal error' or 'time out'
     */
    _lock(dataName, waitLockTimeout, lockMode) {
        return new Promise ((resolve, reject) => {
            //todo: validate the input parameters

            let dataPath = this.pathPrefix + "/" + dataName;
            let lockPrefix = '/rlock-';
            if (lockMode === WRITE) {
                lockPrefix = '/wlock-'
            }
            ZooKeeperHelper.createPathIfNotExists(this.pathPrefix, dataName, this.zkClient).then(
                () => {
                    this.zkClient.a_create(dataPath + lockPrefix,
                        "",
                        ZooKeeper.ZOO_SEQUENCE | ZooKeeper.ZOO_EPHEMERAL,
                        (rc, error, path) => {
                            if (rc !== 0) {
                                console.log("lock znode create failed. Result: %d, error: '%s', path=%s", rc, error, path);
                                reject('internal error');
                                return;
                            } else {
                                console.log("created lock znode '%s' it can wait for the lock by %d ms", path, waitLockTimeout);
                                let lastBackslashIndex = path.lastIndexOf('/');
                                let lockNode = path.substr(lastBackslashIndex + 1);
                                let dataPath = path.substr(0, lastBackslashIndex);

                                let lockInstance = new LockInstance(this.zkClient, dataPath, lockNode);
                                let timer = setTimeout(this._lockWaitTimeout, waitLockTimeout, lockInstance, reject);

                                this._try_lock(dataPath, lockMode, lockNode, lockInstance, timer).
                                    then((lock) => {resolve(lock);}).catch(
                                         () => {reject('internal error');});
                                return;
                            }
                        }
                    );
                }
            ).catch(() => {
                console.log('Fail to create %s/%s', this.pathPrefix, dataName);
                reject('internal error');
            });
        });
    } // lock

    _try_lock(dataPath, lockMode, lockNode, lockInstance, timer) {
        return new Promise ((resolve, reject) => {
            console.log('trying acquire lock for ' + lockNode);
            this.zkClient.a_get_children(dataPath,
                false,
                (rc, error, children) => {
                if (rc !== 0) {
                    console.log("Unexpected error on get children. Result: %d. Error: '%s'", rc, error);
                    reject();
                    return;
                }
                let nodeToBeWatched;
                if (lockMode === READ) {
                    nodeToBeWatched = findNextElemToBeWatchedReadCase(children, lockNode);
                } else { // write case
                    nodeToBeWatched = findNextElemToBeWatchedWriteCase(children, lockNode);
                }
                if (!nodeToBeWatched) {
                    //lock acquired!
                    clearTimeout(timer);
                    console.log('%s/%s acquired the lock', dataPath, lockNode);
                    resolve(lockInstance);
                    return;
                }

                console.log('znode %s is watching %s/%s ', lockNode, dataPath, nodeToBeWatched);
                this.zkClient.aw_exists(dataPath + '/' + nodeToBeWatched,
                    (type, state, path) => {
                        if (state === ZooKeeper.ZOO_CONNECTED_STATE) {
                            console.log('event %d on %s', type, path);
                            this._try_lock(dataPath, lockMode, lockNode, lockInstance, timer).
                                then((lock) => {resolve(lock);},
                                     () => {reject();} );
                            return;
                        }
                        console.log('Unexpected state %d', state);
                        reject('internal error');
                        return;
                    },
                    (rc, error) => {
                        if (rc === ZooKeeper.ZNONODE) {
                            // selected lock znode does not exists any more,
                            // let's try again
                            console.log('Selected lock znode does not ' +
                                        'exist any more, trying again');
                            this._try_lock(dataPath, lockMode, lockNode, lockInstance, timer).
                                then((lock) => {resolve(lock);},
                                    () => {reject();} );
                            return;
                        } else if (rc === 0) {
                            return;
                        }
                        console.log("Unexpected behavior. Exists result: %d. Error:  '%s'", rc, error);
                        reject('internal error');
                        return;
                    }
                );
            });
        });
    } // _try_lock

    /**
     * @description this function deals with the timeout situation when the
     * client's stipulated time for wait for a lock has been reached
     * @param {LockInstance} lockInstance
     * @param {function} reject
     */
    _lockWaitTimeout(lockInstance, reject) {
        console.log("%s can not wait anymore. Timed out", lockInstance.getLockPath());
        lockInstance.unlock().then(() => {
            console.log("forced unlock on '%s'", lockInstance.getLockPath());
            reject('time out');
        }).catch(() => {
            console.log("forced unlock failed on '%s'", lockInstance.getLockPath());
            reject('internal error');
        });
    }
};

/**
 * @description this class represents a lock instance, you receive it from the
 * ZookeeperLock.lock method when you acquire the lock and should use it to
 * unlock the data
 */
class LockInstance {
    constructor(zk, dataPath, lockNode) {
        this.zkClient = zk;
        this.dataPath = dataPath;
        this.lockPath = dataPath + '/' + lockNode;
    }

    /**
     * @description unlocks the this lock instance. This function returns
     * a promise that:
     * on resolve: no parameter is provided and the lock was successfully unlocked
     * on reject: one parameter is provided describing the problem, where it can
     * be 'internal error' or 'already unlocked'
     */
    unlock() {
        return new Promise ((resolve, reject) => {
            this.zkClient.a_delete_(this.lockPath, -1, (rc, error) => {
                if (rc === 0) {
                    console.log('Unlocking %s', this.lockPath);
                    resolve();
                } else if (rc !== ZooKeeper.ZNONODE) {
                    console.log("Unexpected behavior. Delete result: %d. Error: '%s'", rc, error);
                    reject('internal error');
                } else {
                    // if rc is ZNONODE, it means that someone else called the
                    // unlock function before, could it be direct or indirectly (timeout)
                    console.log("lock already unlocked: %s", this.lockPath);
                    reject('already unlocked');
                }
            });
        });
    }

    getDataPath() {
        return this.dataPath;
    }

    getLockPath() {
        return this.lockPath;
    }
}