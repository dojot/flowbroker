"use strict";

const RLOCK = 0;
const WLOCK = 1;
const LOCK_UNLOCK = 2;

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
 * - tenant: is the highest hierarchy and everything is under it, be careful,
 * data stored here is shared whith everyone on the same tenant;
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
   * @description This method locks specified context into tenant layer using a
   * read lock and retrieves the context's content
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} contextName The desirable context name
   * @returns a promise that:
   * on success:
   *   gives an array which:
   *     the first position is the context id, the user must store it to use in
   *       the unlockContext methods;
   *     the second position is an object with context content, the user can
   *       modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   * WARNING: you must call the unlockContext methods after
   * use the context
   */
  async rlockAndGetTenantContext(tenant, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + contextName, RLOCK);
  }

  /**
   * @description This method locks specified context into tenant layer using a
   * write lock and retrieves the context's content
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} contextName The desirable context name
   * @returns a promise that:
   * on success:
   *   gives an array which:
   *     the first position is the context id, the user must store it to use in
   *       the saveAndUnlockContext/unlockContext methods;
   *     the second position is an object with context content, the user can
   *       modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   * WARNING: you must call the saveAndUnlockContext/unlockContext methods after
   * use the context
   */
  async wlockAndGetTenantContext(tenant, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + contextName, WLOCK);
  }

  /**
   * @description This method locks specified context into tenant layer using
   * the read lock mode, retrieves the context's content and releases the lock
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} contextName The desirable context name
   * @returns a promise that:
   * on success:
   *      an object with context content, the user can modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   */
  async getTenantContext(tenant, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + contextName, LOCK_UNLOCK);
  }

  /**
   * @description This method locks specified context into flow layer using a
   * read lock and retrieves the context's content
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @param {string} contextName The desirable context name
   * @returns a promise that:
   * on success:
   *   gives an array which:
   *     the first position is the context id, the user must store it to use in
   *       the unlockContext methods;
   *     the second position is an object with context content, the user can
   *       modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   * WARNING: you must call the unlockContext methods after
   * use the context
   */
  async rlockAndGetFlowContext(tenant, flowId, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + flowId + '/' + contextName, RLOCK);
  }

  /**
   * @description This method locks specified context into flow layer using a
   * write lock and retrieves the context's content
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @param {string} contextName The desirable context name
   * @returns a promise that:
   * on success:
   *   gives an array which:
   *     the first position is the context id, the user must store it to use in
   *       the saveAndUnlockContext/unlockContext methods;
   *     the second position is an object with context content, the user can
   *       modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   * WARNING: you must call the saveAndUnlockContext/unlockContext methods after
   * use the context
   */
  async wlockAndGetFlowContext(tenant, flowId, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + flowId + '/' + contextName, WLOCK);
  }

  /**
   * @description This method locks specified context into flow layer using
   * the read lock mode, retrieves the context's content and releases the lock
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @param {string} contextName The desirable context name
   * @returns a promise that:
   * on success:
   *      an object with context content, the user can modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   */
  async getFlowContext(tenant, flowId, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + flowId + '/' + contextName, LOCK_UNLOCK);
  }

  /**
   * @description This method locks specified context into node layer using a
   * read lock and retrieves the context's content
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @param {string} nodeId The node id which this the execution is running
   * @param {string} contextName The desirable context name
   * @returns a promise that:
   * on success:
   *   gives an array which:
   *     the first position is the context id, the user must store it to use in
   *       the unlockContext methods;
   *     the second position is an object with context content, the user can
   *       modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   * WARNING: you must call the unlockContext methods after
   * use the context
   */
  async rlockAndGetNodeContext(tenant, flowId, nodeId, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + flowId + '/' + nodeId +
      '/' + contextName, RLOCK);
  }

  /**
   * @description This method locks specified context into node layer using a
   * write lock and retrieves the context's content
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @param {string} nodeId The node id which this the execution is running
   * @param {string} contextName The desirable context name
   * @returns a promise that:
   * on success:
   *   gives an array which:
   *     the first position is the context id, the user must store it to use in
   *       the saveAndUnlockContext/unlockContext methods;
   *     the second position is an object with context content, the user can
   *       modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   * WARNING: you must call the saveAndUnlockContext/unlockContext methods after
   * use the context
   */
  async wlockAndGetNodeContext(tenant, flowId, nodeId, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + flowId + '/' + nodeId +
      '/' + contextName, WLOCK);
  }  

  /**
   * @description This method locks specified context into node layer using
   * the read lock mode, retrieves the context's content and releases the lock
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @param {string} nodeId The node id which this the execution is running
   * @param {string} contextName The desirable context name
   * @returns a promise that:
   * on success:
   *      an object with context content, the user can modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   */
  async getNodeContext(tenant, flowId, nodeId, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + flowId + '/' + nodeId +
      '/' + contextName, LOCK_UNLOCK);
  }

  /**
   * @description This method locks specified context into node instance layer
   * using a read lock and retrieves the context's content
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @param {string} nodeId The node id which this the execution is running
   * @param {string} nodeInstance The node instance which this the execution is
   * @param {string} contextName The desirable context name
   * running
   * @returns a promise that:
   * on success:
   *   gives an array which:
   *     the first position is the context id, the user must store it to use in
   *       the unlockContext methods;
   *     the second position is an object with context content, the user can
   *       modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   * WARNING: you must call the unlockContext methods after
   * use the context
   */
  async rlockAndGetNodeInstanceContext(tenant, flowId, nodeId, nodeInstance, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + flowId + '/' + nodeId +
      '/' + nodeInstance + '/' + contextName, RLOCK);
  }

  /**
   * @description This method locks specified context into node instance layer
   * using a write lock and retrieves the context's content
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @param {string} nodeId The node id which this the execution is running
   * @param {string} nodeInstance The node instance which this the execution is
   * @param {string} contextName The desirable context name
   * running
   * @returns a promise that:
   * on success:
   *   gives an array which:
   *     the first position is the context id, the user must store it to use in
   *       the saveAndUnlockContext/unlockContext methods;
   *     the second position is an object with context content, the user can
   *       modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   * WARNING: you must call the saveAndUnlockContext/unlockContext methods after
   * use the context
   */
  async wlockAndGetNodeInstanceContext(tenant, flowId, nodeId, nodeInstance, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + flowId + '/' + nodeId +
      '/' + nodeInstance + '/' + contextName, WLOCK);
  }

  /**
   * @description This method locks specified context into node instance layer using
   * the read lock mode, retrieves the context's content and releases the lock
   * @param {string} tenant The tenant who's the client belongs
   * @param {string} flowId The flow id which this the execution is running
   * @param {string} nodeId The node id which this the execution is running
   * @param {string} nodeInstance The node instance which this the execution is
   * @param {string} contextName The desirable context name
   * running
   * @returns a promise that:
   * on success:
   *      an object with context content, the user can modify it as its wish
   * on failure:
   *   gives a string that describes the error
   * 
   */
  async getNodeInstanceContext(tenant, flowId, nodeId, nodeInstance, contextName) {
    return this.client.lockAndGetContext(tenant + '/' + flowId + '/' + nodeId +
      '/' + nodeInstance + '/' + contextName, LOCK_UNLOCK);
  }

  /**
   * @description This method saves the context's content and unlocks it
   * @param {string} contextId the contextId received from the 
   * lockAndGet*Context methods
   * @param {object} contextContent the context content
   * @returns a promise that:
   * on success:
   *   no additional information is given
   * on failure:
   *   gives a string that describes the error
   */
  async saveAndUnlockContext(contextId, contextContent) {
    return this.client.unlockContext(contextId, true, contextContent);
  }

 /**
   * @description This method unlocks context without updating its content
   * @param {string} contextId the contextId received from the
   * lockAndGet*Context methods method
   * @returns a promise that:
   * on success:
   *   no additional information is given
   * on failure:
   *   gives a string that describes the error
   */
  async unlockContext(contextId) {
    return this.client.unlockContext(contextId, false);
  }

} // class
