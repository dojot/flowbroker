"use strict";

module.exports = class ContextHandler {
    constructor(contextClient) {
        this.client = contextClient;
    }

    saveContext(contextId, contextContext) {
        return new Promise ((resolve, reject) => {
            this.client.saveContext(contextId, contextContext).then(
              () => { resolve(); },
              (error) => { reject(error); }
            );
          });  
    }

    getFlowContext(contextName, tenant, flowId) {
        return new Promise ((resolve, reject) => {
          this.client.getContext(tenant + '/' + flowId + '/' + contextName).then(
            (values) => { resolve(values); },
            (error) => { reject(error); }
          );
        });
      }
    
      getNodeContext(contextName, tenant, flowId, node) {
        return new Promise ((resolve, reject) => {
          this.client.getContext(tenant + '/' + flowId + '/' + node + '/' + contextName).then(
            (values) => { resolve(values); },
            (error) => { reject(error); }
          )
        });
      }
    
      getNodeInstanceContext(contextName, tenant, flowId, node, nodeInstance) {
        return new Promise ((resolve, reject) => {
          this.client.getContext(tenant + '/' + flowId + '/' + node + '/' +
            nodeInstance + '/' + contextName).then(
              (values) => { resolve(values); },
              (error) => { reject(error); }
            );
        });
      }
}