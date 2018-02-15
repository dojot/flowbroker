export class REDNode {
  // Associated node raw HTML file - without help script
  config: string;
  enabled: boolean;
  // associated .js file path (including the file itself)
  file: string;
  help: {
    // Localized node help (raw HTML)
    [language: string] : string | null;
  };
  // Node identifier (such as node-red/batch)
  id: string;
  loaded: boolean;
  local: boolean;
  // Module name (such as node-red)
  module: string;
  // Node name (such as batch)
  name: string;
  namespace: string;
  // HTML file path (including filename itself)
  template: string;
  // Exported types (such as ["batch"])
  types: string[];
  // Node version
  version: string;
  // To be inspected - not sure how this attribute is filled.
  err: string | Error | null;
}

export class REDNodeInfo {
    version: string;
    nodes: {
      [nodeName: string]: string;
    };
}

export interface REDPackage {
  name: string;
  version: string;
  local: boolean;
  nodes : {
    [nodeName: string]: REDNode
  };
  redVersion?: string;
  "node-red"? : REDNodeInfo;
}

export interface REDModule {
  package: REDPackage;
  dir: string;
  local?: boolean;
}


export class REDNodeList {
  [moduleName: string]: REDPackage
}