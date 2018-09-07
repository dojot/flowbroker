"use strict";

var zmq = require('zeromq');
var uuidv4 = require('uuid/v4');

const RLOCK = 0;
const WLOCK = 1;
const LOCK_UNLOCK = 2;

module.exports = class ContextManagerClient {
  /**
   * 
   * @param {*} contextManagerHost The context manager address
   * @param {*} contextManagerPort The context manager port
   * @param {*} responseTimeout Response Timeout. How long the client should wait
   * for a response (to save/get a context). This time value is in ms.
   */
  constructor(contextManagerHost, contextManagerPort, responseTimeout) {
    this.contextMap = {};
    this.contextResponseTimeout = responseTimeout; // time in ms
    this.contextSocket = null;
    this.contextManagerHost = contextManagerHost;
    this.contextManagerPort = contextManagerPort;
  }  

  init() {
    this.contextSocket = zmq.socket('dealer');

    this.contextSocket.on("message", (reply) => {
      console.log("Received reply [%s]", reply.toString());
      let data = JSON.parse(reply);
    
      if (!this.contextMap.hasOwnProperty(data.request_id)) {
        console.log('request %s was expired', data.request_id);
        return;
      }
    
      let contextEntry = this.contextMap[data.request_id];
      clearTimeout(contextEntry.timer);
    
      if (contextEntry.state === 'waiting_lock_response') {
        if (data.result === 'ok') {
          console.log('locked');
          this.contextMap[data.request_id].state = 'processing';
          let context = {};
          if (data.context_content.length !== 0) {
            context = JSON.parse(data.context_content);
          }
          contextEntry.resolve([data.request_id, context]);
        } else {
          console.log('lock failed, reason: %s', data.reason);
          delete this.contextMap[data.request_id];
          contextEntry.reject('internal error');
        }
      } else if (contextEntry.state === 'waiting_unlock_response') {
        if (data.result === 'ok') {
          console.log('unlocked');
          delete this.contextMap[data.request_id];
          contextEntry.resolve();
        } else {
          console.log('unlock failed, reason: %s', data.reason);
          delete this.contextMap[data.request_id];
          contextEntry.reject();
        }
      } else if (contextEntry.state === 'waiting_lock_unlock_response') {
        if (data.result === 'ok') {
          console.log('get');
          delete this.contextMap[data.request_id];
          let context = {};
          if (data.context_content.length !== 0) {
            context = JSON.parse(data.context_content);
          }
          contextEntry.resolve(context);
        } else {
          console.log('get failed, reason: %s', data.reason);
          delete this.contextMap[data.request_id];
          contextEntry.reject('internal error');
        }
      } else {
        console.log('invalid state: %s', contextEntry.state);
        delete this.contextMap[data.request_id];
        contextEntry.reject();
      }      
    }); // on message

    this.contextSocket.connect("tcp://" + this.contextManagerHost + ":" + this.contextManagerPort);
    
    process.on('SIGINT', () => {
      this.contextSocket.close();
    });

    console.log('Context Manager Client initialized');
  }

  unlockContext(contextId, shouldSave, contextContext = undefined) {
    return new Promise ((resolve, reject) => {
      if (!this.contextMap.hasOwnProperty(contextId)) {
        console.log('Context not found: %s', contextId);
        reject('context not found');
        return;
      }
      let contextEntry = this.contextMap[contextId];
      if ( (contextEntry.lockMode === RLOCK) && (shouldSave) ) {
        console.log('trying to modify context\'s content while holding a read lock');
        reject('trying to modify context\'s content while holding a read lock');
        return;
      }

      let request = {
        command: "unlock",
        data: {
          request_id: contextId,          
        }
      };

      if (shouldSave) {
        request.command = "save_and_unlock";
        request.data.context_content = JSON.stringify(contextContext);
      }

      let timer = setTimeout((id, map) => {
          console.log("time out %s", id);
          let contextEntry = map[id];
          delete map[id];
          contextEntry.reject('timeout');
        }, this.contextResponseTimeout, contextId, this.contextMap);

      contextEntry.timer = timer;
      contextEntry.resolve = resolve;
      contextEntry.reject = reject;
      contextEntry.state = 'waiting_unlock_response';

      this.contextMap[contextId] = contextEntry;

      console.log('requesting to save a context');

      this.contextSocket.send(JSON.stringify(request));
    });
  }

  lockAndGetContext(contextName, lockMode) {
    return new Promise ((resolve, reject) => {
      let requestId = uuidv4().toString();
      let request = {
        command: "rlock_and_get",
        data: {
          context_name: contextName,
          request_id: requestId
        }
      }      

      let timer = setTimeout((id, map) => {
          console.log("time out %s", id);
          let contextEntry = map[id];
          delete map[id];
          contextEntry.reject('timeout');
        }, this.contextResponseTimeout, requestId, this.contextMap);

      let contextObj = {
        timer: timer,
        lockMode: lockMode,
        state: 'waiting_lock_response',
        resolve: resolve,
        reject: reject
      };

      if (lockMode === WLOCK) {
        request.command = "wlock_and_get";
      } else if (lockMode === LOCK_UNLOCK) {
        request.command = "lock_get_and_unlock";
        contextObj.state = 'waiting_lock_unlock_response';
      }

      this.contextMap[requestId] = contextObj;

      console.log('requesting to retrieve context: %s', contextName);
      this.contextSocket.send(JSON.stringify(request));
    }); 
  }
}
