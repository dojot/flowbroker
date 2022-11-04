const config = require("./config");
const DojotHttpClient = require("./internal-sdk/http-client");
const DojotLogger = require("@dojot/dojot-module-logger");
const logger = DojotLogger.logger;


const httpClient = new DojotHttpClient({
  defaultClientOptions: {
    timeout: 12000,
  },
  logger: logger,
  defaultMaxNumberAttempts: 3,
  defaultRetryDelay: 5000,
});


async function getTenantList (){
  const response = await httpClient.request({
    method: 'GET',
    url: config.keycloak.tenants.url
  });

  return response.data.tenants;
}

module.exports = {
  getTenantList,
}