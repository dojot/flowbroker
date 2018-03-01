/* jshint node: true */
/* jshint esversion: 6 */
"use strict";

var express = require('express');
var bodyParser = require('body-parser');

var authChecker = require('./auth');
var FlowManagerBuilder = require('./flowManager').FlowManagerBuilder;
var FlowError = require('./flowManager').FlowError;
var MongoManager = require('./mongodb');

var mongoClient;
var FlowManager;

const app = express();
app.use(bodyParser.json()); // for parsing application/json

// all APIs should be invoked with valid dojot-issued JWT tokens
app.use(authChecker.authParse);
app.use(authChecker.authEnforce);

function validateMandatoryFields(body, fields) {
  for (let f of fields) {
    if (!body.hasOwnProperty(f))
      return "Missing mandatory field: " + f;
  }
}

function summarizeFlow(flow) {
  return {
    'label': flow.label,
    'enabled': flow.enabled,
    'id': flow.id,
    'flow': flow.red
  };
}

app.get('/v1/flow', (req, res) => {
  let fm = null;
  try {
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError)
      return res.status(e.httpStatus).send(e.payload());

    console.error(e);
    return res.status(500).send({"message": "Failed to switch tenancy context"});
  }

  fm.getAll().then((flows) => {
    let filtered = [];
    for (let flow of flows) {
      filtered.push(summarizeFlow(flow));
    }
    return res.status(200).send({'flows': filtered});
  }).catch((error) => {
    console.error(error);
    return res.status(500).send({'message': 'Failed to list flows'});
  });
});

app.post('/v1/flow', (req, res) => {
  let fm = null;
  try {
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError)
      return res.status(e.httpStatus).send(e.payload());

    console.error(e);
    return res.status(500).send({"message": "Failed to switch tenancy context"});
  }

  const error = validateMandatoryFields(req.body, ['label', 'flow']);
  if (error) {
    return res.status(400).send({'message': error});
  }

  fm.create(req.body.label, req.body.enabled, req.body.flow).then((parsed) => {
    return res.status(200).send(parsed.red);
  }).catch((error) => {
    if (error instanceof FlowError) {
      return res.status(error.httpStatus).send(error.payload());
    } else {
      console.error(error);
      return res.status(500).send({'message': 'failed to create flow'});
    }
  });
});

app.delete('/v1/flow', (req, res) => {
  let fm = null;
  try {
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError)
      return res.status(e.httpStatus).send(e.payload());

    console.error(e);
    return res.status(500).send({"message": "Failed to switch tenancy context"});
  }

  fm.removeAll().then(() => {
    return res.status(200).send({'message': 'All flows removed'});
  }).catch((error) => {
    console.error(error);
    return res.status(500).send({'message': 'failed to remove flows'});
  });
});

app.get('/v1/flow/:id', (req, res) => {
  let fm = null;
  try {
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError)
      return res.status(e.httpStatus).send(e.payload());

    console.error(e);
    return res.status(500).send({"message": "Failed to switch tenancy context"});
  }

  fm.get(req.params.id).then((flow) => {
    return res.status(200).send(summarizeFlow(flow));
  }).catch((error) => {
    if (error instanceof FlowError) {
      return res.status(error.httpStatus).send(error.payload());
    } else {
      console.error(error);
      return res.status(500).send({'message': 'Failed to get flow'});
    }
  });
});

app.put('/v1/flow/:id', (req, res) => {
  let fm = null;
  try {
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError)
      return res.status(e.httpStatus).send(e.payload());

    console.error(e);
    return res.status(500).send({"message": "Failed to switch tenancy context"});
  }

  fm.set(req.params.id, req.body.label, req.body.enabled, req.body.flow).then((flow) => {
    return res.status(200).send(summarizeFlow(flow));
  }).catch((error) => {
    if (error instanceof FlowError) {
      return res.status(error.httpStatus).send(error.payload());
    } else {
      console.error(error);
      return res.status(500).send({'message': 'Failed to update flows'});
    }
  });
});

app.delete('/v1/flow/:id', (req, res) => {
  let fm = null;
  try {
    fm = FlowManager.get(req.service);
  } catch (e) {
    if (e instanceof FlowError)
      return res.status(e.httpStatus).send(e.payload());

    console.error(e);
    return res.status(500).send({"message": "Failed to switch tenancy context"});
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
      console.error(error);
      return res.status(500).send({'message': 'Failed to remove flow'});
    }
  });
});

MongoManager.get().then((client) => {
  mongoClient = client;
  FlowManager = new FlowManagerBuilder(client);
  app.listen(80, () => {console.log('done');});
});
