/* jshint node: true */
/* jshint esversion: 6 */
"use strict";

const NodeCache = require( "node-cache" );
const jwt = require('jsonwebtoken');
const { DojotHttpClient, KeycloakClientSession } = require('./internal-sdk/index')
const config = require('./config');

const DojotLogger = require("@dojot/dojot-module-logger");
const logger = DojotLogger.logger;

const tenantCache = new NodeCache( { stdTTL: 100, checkperiod: 7200 } );
const httpClient = new DojotHttpClient({
  defaultClientOptions: {
    baseURL: config.keycloak.url,
    timeout: 12000,
  },
  logger: logger,
  defaultMaxNumberAttempts: 3,
  defaultRetryDelay: 5000,
});

async function getSession(tenantId) {
  try {
    const session = new KeycloakClientSession(
      config.keycloak.url,
      tenantId,
      {
        client_id: config.keycloak['client.id'],
        client_secret: config.keycloak['client.secret'],
        grant_type: "client_credentials",
      },
      logger,
      { retryDelay: 5000 },
    )
    await session.start()
    return session;
  } catch (error) {
    logger.error(error.message);
    throw error;
  }
}

/**
 * Format certificate in x5c format
 *
 * @param {string} base64PublicKey Public key in base64
 *
 * @returns rsa cerficate
 */
function formatCertificate(certificateBody) {
  let certificate = '-----BEGIN CERTIFICATE-----\n';
  const chucks = certificateBody.match(/.{1,64}/g);
  certificate += chucks.join('\n');
  certificate += '\n-----END CERTIFICATE-----';

  return certificate;
}

async function getTenantData(tenantId) {
  logger.debug('retrieving cached tenant data');
  const tenantData = tenantCache.get(tenantId);
  if (tenantData) {
    logger.debug('found cached tenant data');
    return tenantData;
  }
  logger.debug('there is no cached tenant data');

  try {
    logger.debug('looking up tenant data in keycloak')
    const response = await httpClient.request({
      method: 'GET',
      url: `/auth/realms/${tenantId}/protocol/openid-connect/certs`,
    });

    const certs = response.data.keys.find((key) => key.use === 'sig');
    const tenantData = {
      id: tenantId,
      signatureKey: {
        algorithm: certs.alg,
        certificate: formatCertificate(certs.x5c[0]),
      },
    };

    logger.debug('writing cached tenant data');
    const success = tenantCache.set(tenantId, tenantData);
    if( !success){
      logger.error('failed to write cache tenant data');
    }

    return tenantData;

  } catch (error) {
    logger.error(error)
  }
}

async function authParse(req, res, next) {
  let prefix;
  let tokenRaw;
  let requestTenant;

  try {
    [prefix, tokenRaw] = req.headers.authorization.split(' ');
  } catch (error) {
    return next();
  }

  if (prefix === 'Bearer') {
    let tenant;
    let tokenDecoded;

    try {
      logger.debug('Decoding access_token.');
      tokenDecoded = jwt.decode(tokenRaw);
      logger.debug('Getting tenant.');
      requestTenant = tokenDecoded.iss.split('/').pop();
      tenant = await getTenantData(requestTenant);
    } catch (decodedError) {
      logger.debug(decodedError)
      return res.status(401).send({ message: 'Invalid access_token'});
    }

    if (tenant) {
      logger.debug('Verify access_token.');
      jwt.verify(
        tokenRaw,
        tenant.signatureKey.certificate,
        { algorithms: tenant.signatureKey.algorithm },
        (verifyTokenError) => {
          if (verifyTokenError) {
            logger.debug(verifyTokenError.message);
            return res.status(401).send({ message: verifyTokenError.message });
          }
          logger.debug('Successfully verified.');
          req.service = tenant.id;
          req.user = tokenDecoded.preferred_username;
          req.userid = tokenDecoded.sid;
          next();
        },
      );
    } else {
      return res.status(401).send({ message: 'Tenant not found'});
    }
  } else {
    return res.status(401).send({ message: 'Invalid authorization header'});
  }
}

function authEnforce(req, res, next) {
  if (req.path.match(/(\.png|svg$)|(keymap\.json$)|(healthcheck$)/)){
    logger.debug(`will ignore ${req.path}`, { filename: 'auth' });
    return next();
  }

  if (req.user === undefined || req.user.trim() === "" ) {
    // valid token must be supplied
    logger.error(`Got invalid request: user is not defined in token: ${req.get('authorization')}`, { filename: 'auth' });
    return res.status(401).send(new UnauthorizedError());
  }

  if (req.service === undefined || req.service.trim() === "" ) {
    // valid token must be supplied
    return res.status(401).send(new UnauthorizedError());
  }

  next();
}

module.exports = {
  authParse: authParse,
  authEnforce: authEnforce,
  getSession: getSession
};
