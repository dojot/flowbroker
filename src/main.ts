import util = require("util");
import {REDRegistry} from "./registry";
import { REDLoader } from "./loader";

let registry = new REDRegistry();

registry.loader.load().then(() => {
  // console.log("registry.getAllNodeConfigs(): ");
  // console.log(util.inspect(registry.getAllNodeConfigs("en-US"), { depth: null}))

  // console.log("===============================================================");
  // console.log("registry.getNodeList(): ");
  // console.log(util.inspect(registry.getNodeList(), { depth: null}))

  // console.log("===============================================================");
  // console.log("registry.getNodeIcons(): ");
  // console.log(util.inspect(registry.getNodeIcons(), { depth: null}))

  console.log("===============================================================");
  console.log("registry.locales.getAllNodes(): ");
  console.log(util.inspect(registry.locales.getAllNodes("en-US"), { depth: null}))
});

