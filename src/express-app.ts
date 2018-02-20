import express = require("express")
import { REDRegistry } from "./registry";
import { REDLoader } from "./loader";
import fs = require("fs");

class ExpressApp {
  app: express.Express;
  registry: REDRegistry;
  isStarted: boolean;
  keymap: any;

  constructor() {
    this.app = express();
    this.registry = new REDRegistry();
    this.registerEndpoints();
    this.isStarted = false;
    this.keymap = JSON.parse(fs.readFileSync("./src/keymap.json", "utf-8"));
  }

  start(port: Number, callback: () => void) {
    this.registry.load().done((value) => {
      console.log("All nodeRED nodes were loaded. Starting application.")
      this.app.listen(port, callback);
    })
  }

  getNodesHandler(req: express.Request, res: express.Response) {
    if (this.isStarted) {
      res.send("Module is not yet fully loaded.")
    }

    if (req.accepts("application/json")) {
      console.log("Retrieving application/json type")
      let nodeList = this.registry.getNodeList();
      let reparsedList: any[] = [];
      for (let node of nodeList) {
        let newNode: any = {};
        newNode["id"] = node.id;
        newNode["name"] = node.name;
        newNode["types"] = node.types;
        newNode["enabled"] = node.enabled;
        newNode["local"] = node.local;
        newNode["module"] = node.module;
        newNode["version"] = node.version;
        reparsedList.push(newNode);
      }
      res.json(reparsedList);
    } else if (req.accepts("text/html")) {
      console.log("Retrieving text/html type")
      res.send(JSON.stringify(this.registry.getAllNodeConfigs("en-US")));
    }
  }

  getLocaleHandler (req: express.Request, res: express.Response) {
    if (this.isStarted) {
      res.send("Module is not yet fully loaded.")
    }
    this.registry.locales.get(req.params["moduleid"], "en-US", (answer: any) => {
      res.send(JSON.stringify(answer));
    })
  };

  getKeymapHandler (req: express.Request, res: express.Response) {
    res.send(JSON.stringify(this.keymap));
  };

  registerEndpoints() {
    this.app.get(
      "/nodes",
      (req: express.Request, res: express.Response) => {
        this.getNodesHandler(req, res);
      }
    );
    this.app.get(
      "/locales/:moduleid",
      (req: express.Request, res: express.Response) => {
        this.getLocaleHandler(req, res);
      }
    );
    this.app.get(
      "/red/keymap.json",
      (req: express.Request, res: express.Response) => {
        this.getKeymapHandler(req, res);
      }
    );

    this.app.get(
      "/red/keymap.json",
      (req: express.Request, res: express.Response) => {
        this.getKeymapHandler(req, res);
      }
    );
    
    this.app.use(express.static('public'));
  }
}

export { ExpressApp }