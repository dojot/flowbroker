"use strict";

/**
 * @description This class allows the client to get a context, in a exclusive way,
 * to modify or consult it.
 * This class allows to get contexts in some different namespaces, after the client
 * uses it, he need to call the saveContext, even if he did not modify it, to
 * allow others clients to retrieve the context.
 * 
 * WARNING: While you hold the context other clients interested in this context
 * cannot access it and will be blocked, so use it with wisdom and while it is
 * really necessary.
 * 
 * Contexts are organized into namespaces, the following hierarchy is used:
 * 
 *     [tenant]       - highest
 *        \/
 *      [flow]
 *        \/
 *      [node]
 *        \/
 *   [node instance]  - lowest
 *  
 * - tenant: is the highest hierarchy and everything is under it, the client is not
 * allowed to create or request any context in this layer;
 * - flow: is the highest hierarchy accessible to the clients, a context created
 * here is accessible in the flow layer, so be careful, using a context in this
 * layer can impact the flow as a whole;
 * - node: in this layer only nodes with the same type can access it
 * - node instance: in this layer only a specific node instance can access the
 * context, it is the lowest layer
 */
module.exports = class ContextHandler {
  constructor(contextClient) {
      this.client = contextClient;
  }

  /**
   * @description This method gets a specified context into flow layer
   * @param {string} contextName The desirable context name
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @returns a promise that:
   * on success:
   * gives an array which:
   *   the first position is the context id, the user must store it to use in the
   *     saveContext method;
   *   the second position is an object with context content, the user can modify
   *     it as your wish
   * WARNING: you must call the saveContext method after use the context
   * on failure:
   *   gives a string the describes the error
   */
  getFlowContext(contextName, tenant, flowId) {
    return new Promise ((resolve, reject) => {
      this.client.getContext(tenant + '/' + flowId + '/' + contextName).then(
        (values) => { resolve(values); },
        (error) => { reject(error); }
      );
    });
  }
  
  /**
   * @description This method gets a specified context into node layer
   * @param {string} contextName The desirable context name
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @returns a promise that:
   * on success:
   * gives an array which:
   *   the first position is the context id, the user must store it to use in the
   *     saveContext method;
   *   the second position is an object with context content, the user can modify
   *     it as your wish
   * WARNING: you must call the saveContext method after use the context
   * on failure:
   *   gives a string the describes the error
   */
  getNodeContext(contextName, tenant, flowId, node) {
    return new Promise ((resolve, reject) => {
      this.client.getContext(tenant + '/' + flowId + '/' + node + '/' + contextName).then(
        (values) => { resolve(values); },
        (error) => { reject(error); }
      )
    });
  }
  
  /**
   * @description This method gets a specified context into node instance layer
   * @param {string} contextName The desirable context name
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @returns a promise that:
   * on success:
   * gives an array which:
   *   the first position is the context id, the user must store it to use in the
   *     saveContext method;
   *   the second position is an object with context content, the user can modify
   *     it as your wish
   * WARNING: you must call the saveContext method after use the context
   * on failure:
   *   gives a string the describes the error
   */
  getNodeInstanceContext(contextName, tenant, flowId, node, nodeInstance) {
    return new Promise ((resolve, reject) => {
      this.client.getContext(tenant + '/' + flowId + '/' + node + '/' +
        nodeInstance + '/' + contextName).then(
          (values) => { resolve(values); },
          (error) => { reject(error); }
        );
    });
  }

  /**
   * @description This method saves the context content into context
   * @param {string} contextId the contextId received from the get*Context method
   * @param {object} contextContent the context content
   * @returns a promise that:
   * on success:
   *   no additional information is given
   * on failure:
   *   gives a string the describes the error
   */
  saveContext(contextId, contextContent) {
    return new Promise ((resolve, reject) => {
      this.client.saveContext(contextId, contextContent).then(
        () => { resolve(); },
        (error) => { reject(error); }
      );
    });  
  }

} // class