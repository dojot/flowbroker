"use strict";

const path = require("path");
const dojot = require("@dojot/flow-node");
const handlebars = require("handlebars");
const mustache = require("mustache");
const logger = require("@dojot/dojot-module-logger").logger;

class DataHandler extends dojot.DataHandlerBase {
  constructor() {
    super();
    handlebars.registerHelper("stringify", function (context) {
      return JSON.stringify(context);
    });

    handlebars.registerHelper("math", function (
      lvalue,
      operator,
      rvalue,
      options
    ) {
      if (arguments.length < 4) {
        // Operator omitted, assuming "+"
        options = rvalue;
        rvalue = operator;
        operator = "+";
      }

      lvalue = parseFloat(lvalue);
      rvalue = parseFloat(rvalue);

      return {
        "+": lvalue + rvalue,
        "-": lvalue - rvalue,
        "*": lvalue * rvalue,
        "/": lvalue / rvalue,
        "%": lvalue % rvalue,
      }[operator];
    });

    handlebars.registerHelper("gte", function (first, second, opts) {
      if (first >= second) return opts.fn(this);
      else return opts.inverse(this);
    });

    handlebars.registerHelper("lte", function (first, second, opts) {
      if (first <= second) return opts.fn(this);
      else return opts.inverse(this);
    });

    handlebars.registerHelper("eq", function (first, second, opts) {
      if (first == second) return opts.fn(this);
      else return opts.inverse(this);
    });

    handlebars.registerHelper("date_parse_unix_timestamp", function (
      date,
      type
    ) {
      if (arguments.length <= 2) {
        type = "s";
      }
      let newDate = "";
      if (type == "s") {
        newDate = new Date(date);
      }
      if (type == "ms") {
        newDate = new Date(date * 1000);
      }

      newDate = newDate.toLocaleString("pt-PT", { hour12: false });
      return newDate;
    });

    handlebars.registerHelper("id_generator", function (size) {
      if (arguments.length <= 1) {
        size = 10;
      }
      var randomized = Math.ceil(Math.random() * Math.pow(10, size));
      var digit = Math.ceil(Math.log(randomized));
      while (digit > size) {
        digit = Math.ceil(Math.log(digit));
      }
      var id_unique = randomized + "-" + digit;
      return id_unique;
    });

    handlebars.registerHelper("age", function (date) {
      let day, month, year;
      if (date.indexOf("/") != -1) {
        [day, month, year] = date.split("/");
      } else if (date.indexOf("-") != -1) {
        [year, month, day] = date.split(" ")[0].split("-");
      } else {
        year = date.substring(0, 4);
        month = date.substring(4, 6);
        day = date.substring(6, 8);
      }
      const birthDate = new Date(year, month - 1, day);
      const now = new Date();

      function DaysInMonth(Y, M) {
        const date = new Date(Y, M, 1, 12);
        date.setDate(0);
        return date.getDate();
      }

      function datediff(date1, date2) {
        var y1 = date1.getFullYear(),
          m1 = date1.getMonth(),
          d1 = date1.getDate(),
          y2 = date2.getFullYear(),
          m2 = date2.getMonth(),
          d2 = date2.getDate();

        if (d1 < d2) {
          m1--;
          d1 += DaysInMonth(y2, m2);
        }
        if (m1 < m2) {
          y1--;
          m1 += 12;
        }

        return { years: y1 - y2, months: m1 - m2, days: d1 - d2 };
      }

      const result = datediff(now, birthDate);
      return JSON.stringify(result);
    });

    handlebars.registerHelper("set_attributes_recreation", function (
      attrs,
      return_attrs
    ) {
      let response = [];

      for (let attr in attrs) {
        for (let object of attrs[attr])
          if (return_attrs.indexOf(object.label) != -1)
            response.push({
              id: object.id,
              label: object.label,
              static_value: object.static_value,
              template_id: object.template_id,
            });
      }
      return JSON.stringify(response);
    });
  }

  /**
   * Returns full path to html file
   * @return {string} String with the path to the node representation file
   */
  getNodeRepresentationPath() {
    return path.resolve(__dirname, "template.html");
  }

  /**
   * Returns full path to locales
   * @returns String
   */
  getLocalesPath() {
    return path.resolve(__dirname, "./locales");
  }

  /**
   * Returns node metadata information
   * This may be used by orchestrator as a liveliness check
   * @return {object} Metadata object
   */
  getMetadata() {
    return {
      id: "dojot/template",
      name: "template",
      module: "dojot",
      version: "1.0.0",
    };
  }

  /**
   * Check if the node configuration is valid
   * @param {object} config  Configuration data for the node
   * @return {[boolean, object]} Boolean variable stating if the configuration is valid or not and error message
   */
  checkConfig() {
    return [true, null];
  }

  /**
   * Statelessly handle a single given message, using given node configuration parameters
   *
   * This method should perform all computation required by the node, transforming its inputs
   * into outputs. When such processing is done, the node should issue a call to the provided
   * callback, notifying either failure to process the message with given config, or the set
   * of transformed messages to be sent to the flow's next hop.
   *
   * @param  {[type]}       config   Node configuration to be used for this message
   * @param  {[type]}       message  Message to be processed
   * @return {[undefined]}
   */
  handleMessage(config, message, metadata) {
    var fullMessage = JSON.parse(JSON.stringify(message));
    fullMessage.payloadMetadata = JSON.parse(JSON.stringify(metadata));
    try {
      let templateData = config.template;
      let data = "";
      switch (config.syntax) {
        case "handlebars": {
          let template = handlebars.compile(templateData);
          data = template(fullMessage);
          break;
        }
        case "plain":
          data = config.template;
          break;
        case "mustache":
          data = mustache.render(templateData, fullMessage);
          break;
        default:
          logger.error(
            `Unsupported syntax on template node: ${config.syntax}`,
            {
              filename: "template",
            }
          );
          return Promise.reject("configuration error");
      }

      if (config.output === "json") {
        data = JSON.parse(data);
      }
      this._set(config.field, data, message);
      logger.debug("... template node was successfully executed.", {
        filename: "template",
      });
      return Promise.resolve([message]);
    } catch (error) {
      logger.debug("... template node was not successfully executed.", {
        filename: "template",
      });
      logger.error(`Error while executing template node: ${error}`, {
        filename: "template",
      });
      return Promise.reject(error);
    }
  }
}

// var main = new DojotHandler(new DataHandler());
module.exports = {
  Handler: DataHandler,
};
