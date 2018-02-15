class Config {
  defaultLang: string;
  version: string;
  coreNodesDir: string;
  userDir: string;
  nodesDir: string[]
}
const CONFIG = new Config();

export { CONFIG };