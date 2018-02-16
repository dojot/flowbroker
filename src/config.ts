class Config {
  defaultLang: string;
  version: string;
  coreNodesDir: string;
  userDir: string;
  nodesDir: string[]

  constructor() {
    this.defaultLang = "en-US";
    this.version = "1.0.0";
    this.coreNodesDir = "./nodes";
    this.userDir = "";
    this.nodesDir = [];
  }
}
const CONFIG = new Config();

export { CONFIG };