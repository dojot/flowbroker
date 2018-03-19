var axios = require("axios");
var util = require('util');
var kafka = require('./kafka');


// TODO - remove the following
var change = require('./nodes/change/index').Handler;
var edge = require('./nodes/edge/index').Handler;
var email = require('./nodes/email/index').Handler;
var geo = require('./nodes/geo/index').Handler;
var http = require('./nodes/http/index').Handler;
var select = require('./nodes/switch/index').Handler;
var template = require('./nodes/template/index').Handler;
//
var nodes = {
  "change": new change(),
  "edgedetection": new edge(),
  "email": new email(),
  "geofence": new geo(),
  "http_request_out": new http(),
  "switch": new select(),
  "template": new template()
};

// TODO - this has to be configurable
const TENANCY_MANAGER_DEFAULTS = {
  "subject": "dojot.tenancy",
  "manager": "http://auth:5000"
}

// TODO - this has to be configurable
const INGESTION_SUBJECT = "device-data";


module.exports = class DeviceIngestor {
  /**
   * Constructor.
   * @param {FlowManagerBuilder} fmBuilder Builder instance to be used when parsing received events
   */
  constructor(fmBuilder) {
    // map of active consumers (used to detect topic rebalancing by kafka)
    this.consumers = {};
    this.fmBuiler = fmBuilder;
  }

  /**
   * Lists current known tenants in the platform
   * @return {[Promise]}  List of known tenants in the platform
   */
  listTenants() {
    return new Promise((resolve, reject) => {
      axios({
        'url': TENANCY_MANAGER_DEFAULTS.manager + '/admin/tenants'
      }).then((response) => {
        resolve(response.data.tenants);
      }).catch((error) => {
        reject(error);
      })
    })
  }

  /**
   * Initialize iotagent kafka consumers (for tenant and device events)
   * @return {[undefined]}
   */
  initConsumer() {
    let consumer = new kafka.Consumer('internal', TENANCY_MANAGER_DEFAULTS.subject, true);

    consumer.on('message', (data) => {
      let parsed = null;
      try {
        parsed = JSON.parse(data.value.toString());
      } catch (e) {
        console.error('Received tenancy event is not valid json. Ignoring.');
        return;
      }

      this.bootstrapTenant(parsed.tenant);
    });

    consumer.on('connect', () => {
      if (!this.consumers.hasOwnProperty('tenancy')) {
        // console.log('got connect event - tenancy');
        this.listTenants().then((tenants) => {
          for (let t of tenants) {
            this.bootstrapTenant(t);
          }
        }).catch((error) => {
          const message = "Failed to acquire existing tenancy contexts"
          console.error("[ingestor] %s\n", message, error);
          throw new InitializationError(message);
        })
        console.log('[ingestor] Tenancy context management initialized');
        this.consumers['tenancy'] = true;
      }
    })
  }

  /**
   * Given a tenant, initialize the related device event stream ingestor.
   *
   * @param  {[string]} tenant tenant which ingestion stream is to be initialized
   */
  bootstrapTenant(tenant) {
    const consumerid = tenant + ".device";
    if (this.consumers.hasOwnProperty(consumerid)) {
      console.log('[ingestor] Attempted to re-init device consumer for tenant:', tenant);
      return;
    }

    let consumer = new kafka.Consumer(tenant, INGESTION_SUBJECT);
    this.consumers[consumerid] = true;

    consumer.on('connect', () => {
      console.log(`[ingestor] Device consumer ready for tenant: ${tenant}`);
    })

    consumer.on('message', (data) => {
      let parsed = null;
      try {
        parsed = JSON.parse(data.value.toString());
      } catch (e) {
        console.error("[ingestor] Device event is not valid json. Ignoring.");
        return;
      }

      this.handleEvent(parsed);
    });

    consumer.on('error', (error) => {
      console.error('[ingestor:kafka] Consumer for tenant "%s" is errored.', tenant);
    });
  }

  handleFlow(event, flow, isTemplate) {
    const nodeMap = {};
    for (let node of flow.red) {
      nodeMap[node.id] = node;
    }

    function addNext(node, stack, message) {
      for (let output of node.wires) {
        for (let hop of output) {
          stack.push({hop: hop, message: message});
        }
      }
    }

    function iterateHops(node) {
      let next = [];
      addNext(node, next, event.attrs);
      while (next.length > 0) {
        const ctx = next.pop();
        const at = nodeMap[ctx.hop];
        console.log(`will handle node ${at.type}`);
        if (nodes.hasOwnProperty(at.type)) {
          nodes[at.type].handleMessage(at, ctx.message, (error, result) => {
            console.log(`got ${error}:${JSON.stringify(result)} from ${at.type}`);
          })
        }
        addNext(at, next, event.attrs);
      }
    }

    for (let head of flow.heads) {
      const node = nodeMap[head];
      // handle input by device
      if (node.hasOwnProperty('_device_id') &&
          (node._device_id == event.metadata.deviceid) &&
          (isTemplate == false)) {
        iterateHops(node);
      }

      // handle input by template
      if (node.hasOwnProperty('_device_template_id') &&
          (event.metadata.templates.includes(node._device_template_id)) &&
          (isTemplate == true)) {
        iterateHops(node);
      }
    }
  }

  handleEvent(event) {
    console.log(`[ingestor] got new device event: ${util.inspect(event, {depth: null})}`);
    let flowManager = this.fmBuiler.get(event.metadata.tenant);
    flowManager.getByDevice(event.metadata.deviceid).then((flowlist) => {
      for (let flow of flowlist) {
        this.handleFlow(event, flow, false);
      }
    })

    for (let template of event.metadata.templates) {
      flowManager.getByTemplate(template).then((flowlist) => {
        for (let flow of flowlist) {
          this.handleFlow(event, flow, true);
        }
      })
    }
  }
}
