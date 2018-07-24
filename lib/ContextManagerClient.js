"use strict";

var zmq = require('zeromq');
var uuidv4 = require('uuid/v4');

module.exports = class ContextManagerClient {
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
          delete this.contextMap[data.request_id];
          contextEntry.resolve();
        } else {
          console.log('unlock failed, reason: %s', data.reason);
          delete this.contextMap[data.request_id];
          contextEntry.reject();
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

  saveContext(contextId, contextContext) {
    return new Promise ((resolve, reject) => {
      if (!this.contextMap.hasOwnProperty(contextId)) {
        console.log('Context not found: %s', contextId);
        reject('context not found');
        return;
      }
      let contextEntry = this.contextMap[contextId];

      let request = {
        command: "save_and_unlock",
        data: {
          request_id: contextId,
          context_content: JSON.stringify(contextContext)
        }
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

  getContext(contextName) {
    return new Promise ((resolve, reject) => {
      let requestId = uuidv4().toString();
      let request = {
        command: "lock_and_get",
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

      this.contextMap[requestId] = {
        timer: timer,
        state: 'waiting_lock_response',
        resolve: resolve,
        reject: reject
      };

      console.log('requesting to retrieve context: %s', contextName);

      this.contextSocket.send(JSON.stringify(request));
    }); 
  }
}
