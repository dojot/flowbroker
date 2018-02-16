import util = require("util");
import {REDRegistry} from "./registry";
import { REDLoader } from "./loader";

let registry = new REDRegistry();

registry.load().done((value) => {
  console.log("registry.getAllNodeConfigs(): ");
  console.log(util.inspect(registry.getAllNodeConfigs("en-US"), { depth: null}))

  console.log("===============================================================");
  console.log("registry.getNodeList(): ");
  console.log(util.inspect(registry.getNodeList(), { depth: null}))

  // console.log("===============================================================");
  // console.log("registry.getNodeIcons(): ");
  // console.log(util.inspect(registry.getNodeIcons(), { depth: null}))

  console.log("===============================================================");
  console.log("registry.locales.getAllNodes(): ");
  registry.locales.get("node-red", "en-US", obj => {
    console.log(util.inspect(obj, { depth: null }));
  });
});
