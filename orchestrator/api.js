/* jshint node: true */
/* jshint esversion: 6 */
"use strict";

var express = require('express');
var bodyParser = require('body-parser');

var authChecker = require('./auth');
var FlowError = require('./flowManager').FlowError;

var NodeAPI = require('./node-red/src/index');

var healthCheck = require('@dojot/healthcheck');
const logger = require("@dojot/dojot-module-logger").logger;
const DojotLogger = require("@dojot/dojot-module-logger");

// initialized by init()
var FlowManager;

const app = express();
app.use(DojotLogger.getHTTPRouter()); // adds the endpoint '/log'
app.use(bodyParser.json()); // for parsing application/json
// all APIs should be invoked with valid dojot-issued JWT tokens
app.use(authChecker.authParse);
app.use(authChecker.authEnforce);
// allow FE to retrieve available nodes (node-red API)
const nodeHandler = new NodeAPI();
nodeHandler.registerExpress(app);

function validateMandatoryFields(body, fields) {
  for (let f of fields) {
    if (!body.hasOwnProperty(f)) {
      return "Missing mandatory field: " + f;
    }
  }
}

function summarizeFlow(flow) {
  return {
    'name': flow.label,
    'enabled': flow.enabled,
    'id': flow.id,
    'flow': flow.red,
    'created': flow.created.getTime(),
    'updated': flow.updated.getTime(),
  };
}

function summarizeNode(node) {
  return {
    'id': node.id,
    'image': node.image
  };
}

app.post('/v1/node', (req, res) => {
  return res.status(405).send();
  // const error = validateMandatoryFields(req.body, ['image', 'id']);
  // if (error) {
  //   return res.status(400).send({ 'message': error });
  // }

  // nodeManager.addRemoteNode(req.body.image, req.body.id, req.service).then(() => {
  //   return res.status(200).send({ message: 'ok' });
  // }).catch((error) => {
  //   if (error instanceof InvalidFlowError) {
  //     return res.status(400).send({ message: error.message });
  //   }
  //   return res.status(500).send({ message: 'Failed to add node: ' + error.message });
  // });
});

app.delete('/v1/node/:id', (req, res) => {
  return res.status(405).send();
  // nodeManager.delRemoteNode(req.params.id, req.service).then(() => {
  //   return res.status(200).send({ message: 'ok' });
  // }).catch((error) => {
  //   logger.error(error, { filename: 'api' });
  //   return res.status(500).send({ message: 'Failed to remove node.', error: error.message });
  // });
});

app.delete('/v1/node', (req, res) => {
  return res.status(405).send();
  // nodeManager.getAll(req.service).then((nodes) => {
  //   var promises = [];
  //   for (let node of nodes) {
  //     promises.push(nodeManager.delRemoteNode(node.id, req.service));
  //   }

  //   Promise.all(promises).then(() => {
  //     return res.status(200).send({ message: 'ok' });
  //   }).catch((error) => {
  //     logger.error(error, { filename: 'api' });
  //     return res.status(500).send({ message: 'Failed to remove node.', error: error.message });
  //   });

  // }).catch((error) => {
  //   logger.error(error, { filename: 'api' });
  //   return res.status(500).send({ 'message': 'Failed to list nodes' });
  // });
});

app.get('/v1/node', (req, res) => {
  return res.status(405).send();
  // nodeManager.getAll(req.service).then((nodes) => {
  //   let filtered = [];
  //   for (let node of nodes) {
  //     filtered.push(summarizeNode(node));
  //   }
  //   return res.status(200).send({ 'nodes': filtered });
  // }).catch((error) => {
  //   logger.error(error, { filename: 'api' });
  //   return res.status(500).send({ 'message': 'Failed to list nodes' });
  // });
});

app.get('/v1/flow', async (req, res) => {
  let fm = null;
  try {
    logger.debug(`Get Flow manager for ${req.service}`);
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError) {
      return res.status(e.httpStatus).send(e.payload());
    }

    logger.error(e, { filename: 'api' });
    return res.status(500).send({ "message": "Failed to switch tenancy context" });
  }

  logger.debug(`Get Flows...`);
  try{
    const flows = await fm.getAll();
    let filtered = [];
    for (let flow of flows) {
      filtered.push(summarizeFlow(flow));
    }
    logger.debug("Return flows");
    return res.status(200).send({ 'flows': filtered });
  } catch (error) {
    logger.error(error, { filename: 'api' });
    return res.status(500).send({ 'message': 'Failed to list flows' });
  }
});

app.post('/v1/flow', (req, res) => {
  let fm = null;
  try {
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError) {
      return res.status(e.httpStatus).send(e.payload());
    }

    logger.error(e, { filename: 'api' });
    return res.status(500).send({ "message": "Failed to switch tenancy context" });
  }

  const error = validateMandatoryFields(req.body, ['name', 'flow']);
  if (error) {
    return res.status(400).send({ 'message': error });
  }

  fm.create(req.body.name, req.body.enabled, req.body.flow).then((parsed) => {
    return res.status(200).send({
      'message': 'ok',
      'flow': summarizeFlow(parsed)
    });
  }).catch((error) => {
    logger.error(error, { filename: 'api' });
    if (error instanceof FlowError) {
      return res.status(error.httpStatus).send(error.payload());
    } else {
      return res.status(500).send({ 'message': 'failed to create flow' });
    }
  });
});

app.delete('/v1/flow', (req, res) => {
  let fm = null;
  try {
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError) {
      return res.status(e.httpStatus).send(e.payload());
    }

    logger.error(e, { filename: 'api' });
    return res.status(500).send({ "message": "Failed to switch tenancy context" });
  }

  fm.removeAll().then(() => {
    return res.status(200).send({ 'message': 'All flows removed' });
  }).catch((error) => {
    logger.error(error, { filename: 'api' });
    return res.status(500).send({ 'message': 'failed to remove flows' });
  });
});

app.get('/v1/flow/:id', (req, res) => {
  let fm = null;
  try {
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError) {
      return res.status(e.httpStatus).send(e.payload());
    }

    logger.error(e, { filename: 'api' });
    return res.status(500).send({ "message": "Failed to switch tenancy context" });
  }

  fm.get(req.params.id).then((flow) => {
    return res.status(200).send({
      'message': 'ok',
      'flow': summarizeFlow(flow)
    });
  }).catch((error) => {
    if (error instanceof FlowError) {
      return res.status(error.httpStatus).send(error.payload());
    } else {
      logger.error(error, { filename: 'api' });
      return res.status(500).send({ 'message': 'Failed to get flow' });
    }
  });
});

app.put('/v1/flow/:id', (req, res) => {
  let fm = null;
  try {
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError) {
      return res.status(e.httpStatus).send(e.payload());
    }

    logger.error(e, { filename: 'api' });
    return res.status(500).send({ "message": "Failed to switch tenancy context" });
  }

  fm.set(req.params.id, req.body.name, req.body.enabled, req.body.flow).then((flow) => {
    return res.status(200).send({
      'message': 'ok',
      'flow': summarizeFlow(flow)
    });
  }).catch((error) => {
    if (error instanceof FlowError) {
      return res.status(error.httpStatus).send(error.payload());
    } else {
      logger.error(error, { filename: 'api' });
      return res.status(500).send({ 'message': 'Failed to update flows' });
    }
  });
});

app.delete('/v1/flow/:id', (req, res) => {
  let fm = null;
  try {
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError) {
      return res.status(e.httpStatus).send(e.payload());
    }

    logger.error(e, { filename: 'api' });
    return res.status(500).send({ "message": "Failed to switch tenancy context" });
  }

  fm.remove(req.params.id).then((flow) => {
    return res.status(200).send({
      'message': 'flow removed',
      'flow': summarizeFlow(flow)
    });
  }).catch((error) => {
    if (error instanceof FlowError) {
      return res.status(error.httpStatus).send(error.payload());
    } else {
      logger.error(error, { filename: 'api' });
      return res.status(500).send({ 'message': 'Failed to remove flow' });
    }
  });
});

module.exports = {
  init: (flowManager, healthChecker) => {
    FlowManager = flowManager;
    app.use(healthCheck.getHTTPRouter(healthChecker));
    app.listen(80, () => {
      logger.info(' Service listening on port 80', { filename: 'api' });
    });
  }
};
