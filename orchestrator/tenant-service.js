const config = require("./config");
const { WebUtils } = require("@dojot/microservice-sdk");

const httpClient = new WebUtils.DojotHttpClient({
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