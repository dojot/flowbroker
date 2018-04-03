var path = require('path');
var dojot = require('@dojot/flow-node');

class DataHandler extends dojot.DataHandlerBase {
  constructor(publisher) {
    super();
    this.publisher = publisher;
  }

  /**
     * Returns full path to html file
     * @return {string} String with the path to the node representation file
     */
  getNodeRepresentationPath() {
    return path.resolve(__dirname, 'actuate.html');
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      'id': 'dojot/actuate',
      'name': 'actuate',
      'module': 'dojot',
      'version': '1.0.0',
    }
  }

  /**
   * Returns object with locale data (for the given locale)
   * @param  {[string]} locale Locale string, such as "en-US"
   * @return {[object]}        Locale settings used by the module
   */
  getLocaleData(locale) {
    return {}
  }

  handleMessage(config, message, callback, tenant) {
    if ((config.attrs == undefined) || (config.attrs.length == 0)) {
      return callback(new Error('Invalid data source: field is mandatory'));
    }

    try {
      let output = {
        meta: {
          deviceid: config._device_id,
          service: tenant
        },
        metadata: {
          tenant: tenant
        },
        event: 'configure',
        data: {
          attrs: this._get(config.attrs, message),
          id: config._device_id
        }
      }
      // console.log('will publish (device out)', util.inspect(output, { depth: null }));
      this.publisher.publish(output);
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = {Handler: DataHandler};