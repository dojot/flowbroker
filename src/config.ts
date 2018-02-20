import path = require("path");
class Config {
  defaultLang: string;
  version: string;
  coreNodesDir: string;
  userDir: string;
  nodesDir: string[]

  constructor() {
    this.defaultLang = "en-US";
    this.version = "1.0.0";
    this.coreNodesDir = "./nodes" /*path.resolve("./nodes")*/;
    this.userDir = "";
    this.nodesDir = [/*path.resolve("./node_modules")*/];
  }
}
const CONFIG = new Config();

export { CONFIG };