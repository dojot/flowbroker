const { Issuer } = require('openid-client');
const { EventEmitter } = require('events');

/**
 * This module manages the connection with the keycloak. Being responsible for get access_token,
 * refresh access_token and retry on failure.
 */
module.exports = class KeycloakClientSession extends EventEmitter {
  /**
   * @constructor
   *
   * @param {string} keycloakUrl The keycloak uri
   * @param {string} tenant The tenant
   * @param {Keycloak Credentials} credentials The keycloak credentials
   * @param {dojot.Logger} logger the Dojot logger
   * @param {Obejct} options the options of connection
   */
  constructor(
    keycloakUrl, tenant, credentials, logger, options = { retryDelay: 5000 },
  ) {
    super();
    this.url = keycloakUrl;
    this.tenant = tenant;
    this.logger = logger;
    this.retryDelay = options.retryDelay;
    this.credentials = credentials;
    this.opened = false;
  }

  /**
   * Starts the connection keycloak
   *
   * @returns a promise
   *
   * @public
   */
  start() {
    const outerThis = this;
    this.opened = true;
    return new Promise((resolve, reject) => {
      outerThis.doAuthClient(
        this.credentials, resolve, reject,
      );
    });
  }

  /**
   * Authenticates on keycloak
   *
   * @param {Keycloak Credentials} credentials The keycloak credentials.
   * @param {Function} resolve The promise resolve method.
   * @param {function} reject The promise reject method.
   *
   * @private
   */
  async doAuthClient(
    credentials, resolve, reject,
  ) {
    const outerThis = this;
    try {
      if (this.opened) {
        const KeycloakIssuer = await Issuer.discover(`${this.url}/auth/realms/${this.tenant}`);

        outerThis.logger.debug(`Signing in ${this.tenant} keycloak`);
        outerThis.client = new KeycloakIssuer.Client({
          client_id: credentials.client_id,
          token_endpoint_auth_method: '',
          client_secret: credentials.client_secret,
        });

        outerThis.tokenSet = await this.client.grant(credentials);
        this.emit('update-token', outerThis.tokenSet);
        outerThis.logger.debug(`Signed in ${this.tenant} keycloak`);

        outerThis.setTimeRefresh(outerThis.tokenSet.expires_in);
      }
      resolve();
    } catch (error) {
      this.logger.error(error);
      if (this.opened) {
        this.logger.debug(`Retrying sign in ${this.tenant} keycloak`);
        setTimeout(() => {
          outerThis.doAuthClient(
            credentials, resolve, reject,
          );
        }, this.retryDelay);
      }
    }
  }

  /**
   * Schedules the  access_token refresh.
   *
   * @param {*} accessTokenTimelife the access token time life.
   *
   * @private
   */
  setTimeRefresh(accessTokenTimelife) {
    try {
      this.logger.debug('Starting refresh routine');
      this.refreshTimeout = setTimeout(this.refresh.bind(this), (accessTokenTimelife * 0.9) * 1000);
    } catch (error) {
      this.logger.error('Unable to start refresh routine');
    }
  }

  /**
   * Refresh access_token.
   *
   * @private
   */
  async refresh() {
    try {
      this.logger.debug('Starting authentication refresh');
      if (this.tokenSet.refresh_token) {
        this.tokenSet = await this.client.refresh(this.tokenSet.refresh_token);
        this.emit('update-token', this.tokenSet);
        this.setTimeRefresh(this.tokenSet.expires_in);
      } else {
        await this.start();
      }
      this.logger.debug('Authentication refresh successfully');
    } catch (refreshError) {
      this.logger.error(refreshError);
      this.start();
    }
  }

  /**
   * Closes the connection and all operations to keep it.
   *
   * @public
   */
  close() {
    clearTimeout(this.refreshTimeout);
    this.client = null;
    this.tokenSet = null;
    this.removeAllListeners();
    this.opened = false;
  }

  /**
   * Gets the set of tokens.
   *
   * @returns the set of tokens
   */
  getTokenSet() {
    return this.tokenSet ? this.tokenSet : null;
  }

  /**
   * Sets the set of tokens.
   *
   * @param {openid-client.TokenSet } tokenSet the set of tokens
   */
  setTokenSet(tokenSet) {
    this.tokenSet = tokenSet;
  }
};
