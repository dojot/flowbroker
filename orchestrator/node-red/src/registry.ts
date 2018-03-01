/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

//let UglifyJS = require("uglify-js");
import util = require("util");
import when = require("when");
import path = require("path");
import fs = require("fs");

import { REDNode, REDNodeList, REDPackage, REDIconPath } from './types';
import { REDLoader } from "./loader";
import { REDLocalFileSystem } from "./localfilesystem";
import { REDi18n } from './i18n';
import { REDLocale } from './locales';

class REDRegistry {
    loader: REDLoader;
    i18n: REDi18n;
    locales: REDLocale;
    localfilesystem: REDLocalFileSystem;
    nodeConfigCache: string;
    moduleConfigs: REDNodeList;
    nodeList: string[];
    nodeTypeToId: {
        [type: string]: string
    };

    moduleNodes: {
        [moduleName: string]: string[]
    };

    settings: {
        nodes: REDNodeList
    }


    icon_paths: {
        [moduleName: string]: [string];
    } = {
            "node-red": [path.resolve(__dirname + '/../public/icons')]
        };
    iconCache: {
        [iconName: string]: string;
    } = {};
    defaultIcon = path.resolve(__dirname + '/../public/icons/arrow-in.png');


    constructor() {
        this.nodeConfigCache = "";
        this.moduleConfigs = new REDNodeList();
        this.nodeList = [];
        this.nodeTypeToId = {};
        this.moduleNodes = {};
        this.settings = {
            nodes: new REDNodeList()
        }
        //  Node = require("../Node");
        //  events.removeListener("node-icon-dir",nodeIconDir);
        //  events.on("node-icon-dir",nodeIconDir);
        this.i18n = new REDi18n();
        this.localfilesystem = new REDLocalFileSystem(this.i18n);
        this.loader = new REDLoader(this, this.localfilesystem);
        this.locales = new REDLocale(this.i18n, this);
    }

    load() {
        console.log("[REGISTRY] Building promises for data load operations...");
        this.moduleConfigs = this.loadNodeConfigs();
        console.log("[REGISTRY] Building promise for i18n initialization...");
        let i18nInit = this.i18n.init();
        console.log("[REGISTRY] ... promise for i18n intialization build.");
        console.log("[REGISTRY] Building promise for node loader initialization...");
        let loaderInit = this.loader.load();
        console.log("[REGISTRY] ... promise for node loader initialization build.");
        console.log("[REGISTRY] ... all load promises were built.");
        console.log("[REGISTRY] Returning a 'settle' promise.");
        return when.settle([i18nInit, loaderInit]).then((value) => {
            console.log("[REGISTRY] Ok");
        }).catch((value) => {
            console.log("[REGISTRY] Failure");
        });
    }

    filterNodeInfo(n: REDNode) {
        let r: REDNode = {
            id: n.module + "/" + n.name,
            name: n.name,
            types: n.types,
            local: n.local || false,
            enabled: true,
            module: "",
            config: "",
            err: null,
            file: "",
            help: {},
            loaded: false,
            namespace: "",
            template: "",
            version: ""
        };
        if (n.hasOwnProperty("module")) {
            r.module = n.module;
        }
        return r;
    }



    getModule(id: string) {
        let parts = id.split("/");
        return parts.slice(0, parts.length - 1).join("/");
    }

    getNode(id: string) {
        let parts = id.split("/");
        return parts[parts.length - 1];
    }

    saveNodeList() {
        let moduleList: REDNodeList = {};
        let hadPending = false;
        let hasPending = false;
        for (let module in this.moduleConfigs) {
            /* istanbul ignore else */
            if (this.moduleConfigs.hasOwnProperty(module)) {
                if (Object.keys(this.moduleConfigs[module].nodes).length > 0) {
                    if (!moduleList[module]) {
                        moduleList[module] = new REDPackage();
                        moduleList[module].name = module;
                        moduleList[module].version = this.moduleConfigs[module].version;
                        moduleList[module].local = this.moduleConfigs[module].local || false;
                    }
                    let nodes = this.moduleConfigs[module].nodes;
                    for (let node in nodes) {
                        /* istanbul ignore else */
                        if (nodes.hasOwnProperty(node)) {
                            let config = nodes[node];
                            let n = this.filterNodeInfo(config);
                            delete n.err;
                            delete n.file;
                            delete n.id;
                            n.file = config.file;
                            moduleList[module].nodes[node] = n;
                        }
                    }
                }
            }
        }

        this.settings.nodes = moduleList;
    }

    loadNodeConfigs(): REDNodeList {
        console.log("[REGISTRY] Loading node configs...");
        let configs = this.settings.nodes;

        if (configs['node-red']) {
            console.log("[REGISTRY] ... node configs were loaded.");
            return configs;
        } else {
            console.log("[REGISTRY] ... node configs were loaded (empty).");
            return {};
        }
    }

    addNodeSet(id: string, set: REDNode, version: string) {
        if (!set.err) {
            for (let t of set.types) {
                if (this.nodeTypeToId.hasOwnProperty(t)) {
                    set.err = new Error("Type already registered");
                }
            };
            if (!set.err) {
                for (let t of set.types) {
                    this.nodeTypeToId[t] = id;
                };
            }
        }
        this.moduleNodes[set.module] = this.moduleNodes[set.module] || [];
        this.moduleNodes[set.module].push(set.name);

        if (!this.moduleConfigs[set.module]) {
            this.moduleConfigs[set.module] = new REDPackage();
            this.moduleConfigs[set.module].name = set.module;
            this.moduleConfigs[set.module].local = set.local;
        }

        this.moduleConfigs[set.module].nodes[set.name] = set;
        this.nodeList.push(id);
        this.nodeConfigCache = "";
    }

    // removeNode(id: string) {
    //     let config = this.moduleConfigs[getModule(id)].nodes[getNode(id)];
    //     if (!config) {
    //         throw new Error("Unrecognised id: " + id);
    //     }
    //     delete this.moduleConfigs[getModule(id)].nodes[getNode(id)];
    //     let i = this.nodeList.indexOf(id);
    //     if (i > -1) {
    //         this.nodeList.splice(i, 1);
    //     }
    //     config.types.forEach((t) {
    //         let typeId = this.nodeTypeToId[t];
    //         if (typeId === id) {
    //             delete nodeConstructors[t];
    //             delete this.nodeTypeToId[t];
    //         }
    //     });
    //     config.enabled = false;
    //     config.loaded = false;
    //     this.nodeConfigCache = null;
    //     return filterNodeInfo(config);
    // }

    // removeModule(module) {
    //     if (!settings.available()) {
    //         throw new Error("Settings unavailable");
    //     }
    //     let nodes = this.moduleNodes[module];
    //     if (!nodes) {
    //         throw new Error("Unrecognised module: " + module);
    //     }
    //     let infoList = [];
    //     for (let i = 0; i < nodes.length; i++) {
    //         infoList.push(removeNode(module + "/" + nodes[i]));
    //     }
    //     delete this.moduleNodes[module];
    //     delete this.moduleConfigs[module];
    //     saveNodeList();
    //     return infoList;
    // }

    getNodeInfo(typeOrId: string) {
        let id = typeOrId;
        if (this.nodeTypeToId.hasOwnProperty(typeOrId)) {
            id = this.nodeTypeToId[typeOrId];
        }
        /* istanbul ignore else */
        if (id) {
            let module = this.moduleConfigs[this.getModule(id)];
            if (module) {
                let config = module.nodes[this.getNode(id)];
                if (config) {
                    let info = this.filterNodeInfo(config);
                    // if (config.hasOwnProperty("loaded")) {
                    //     info.loaded = config.loaded;
                    // }
                    info.version = module.version;
                    return info;
                }
            }
        }
        return null;
    }

    getFullNodeInfo(typeOrId: string) {
        // Used by index.enableNodeSet so that .file can be retrieved to pass
        // to loader.loadNodeSet
        let id = typeOrId;
        if (this.nodeTypeToId.hasOwnProperty(typeOrId)) {
            id = this.nodeTypeToId[typeOrId];
        }
        /* istanbul ignore else */
        if (id) {
            let module = this.moduleConfigs[this.getModule(id)];
            if (module) {
                return module.nodes[this.getNode(id)];
            }
        }
        return null;
    }

    getNodeList(/** filter */) {
        let list = [];
        for (let module in this.moduleConfigs) {
            /* istanbul ignore else */
            if (this.moduleConfigs.hasOwnProperty(module)) {
                let nodes = this.moduleConfigs[module].nodes;
                for (let node in nodes) {
                    /* istanbul ignore else */
                    if (nodes.hasOwnProperty(node)) {
                        let nodeInfo = this.filterNodeInfo(nodes[node]);
                        nodeInfo.version = this.moduleConfigs[module].version;
                        // if (this.moduleConfigs[module].pending_version) {
                        //     nodeInfo.pending_version = this.moduleConfigs[module].pending_version;
                        // }
                        // if (!filter || filter(nodes[node])) {
                        list.push(nodeInfo);
                        // }
                    }
                }
            }
        }
        return list;
    }

    getModuleList() {
        //let list = [];
        //for (let module in this.moduleNodes) {
        //    /* istanbul ignore else */
        //    if (this.moduleNodes.hasOwnProperty(module)) {
        //        list.push(registry.getModuleInfo(module));
        //    }
        //}
        //return list;
        return this.moduleConfigs;

    }

    getModuleInfo(module: string) {
        if (this.moduleNodes[module]) {
            let nodes = this.moduleNodes[module];
            let m = new REDPackage();
            m.name = module;
            m.version = this.moduleConfigs[module].version;
            m.local = this.moduleConfigs[module].local;
            for (let i = 0; i < nodes.length; ++i) {
                let nodeInfo = this.filterNodeInfo(this.moduleConfigs[module].nodes[nodes[i]]);
                nodeInfo.version = m.version;
                m.nodes[nodeInfo.name] = nodeInfo;
            }
            return m;
        } else {
            return null;
        }
    }

    // getCaller() {
    //     let orig = Error.prepareStackTrace;
    //     Error.prepareStackTrace = (_, stack) { return stack; };
    //     let err = new Error();
    //     Error.captureStackTrace(err, arguments.callee);
    //     let stack = err.stack;
    //     Error.prepareStackTrace = orig;
    //     stack.shift();
    //     stack.shift();
    //     return stack[0].getFileName();
    // }

    // inheritNode(constructor) {
    //     if (Object.getPrototypeOf(constructor.prototype) === Object.prototype) {
    //         util.inherits(constructor, Node);
    //     } else {
    //         let proto = constructor.prototype;
    //         while (Object.getPrototypeOf(proto) !== Object.prototype) {
    //             proto = Object.getPrototypeOf(proto);
    //         }
    //         //TODO: This is a partial implementation of util.inherits >= node v5.0.0
    //         //      which should be changed when support for node < v5.0.0 is dropped
    //         //      see: https://github.com/nodejs/node/pull/3455
    //         proto.constructor.super_ = Node;
    //         //  if(Object.setPrototypeOf) {
    //         //      Object.setPrototypeOf(proto, Node.prototype);
    //         //  } else {
    //         //      // hack for node v0.10
    //         //      proto.__proto__ = Node.prototype;
    //         //  }
    //     }
    // }

    // registerNodeConstructor(nodeSet, type, constructor) {
    //     if (nodeConstructors.hasOwnProperty(type)) {
    //         throw new Error(type + " already registered");
    //     }
    //     //TODO: Ensure type is known - but doing so will break some tests
    //     //      that don't have a way to register a node template ahead
    //     //      of registering the constructor
    //     if (!(constructor.prototype instanceof Node)) {
    //         inheritNode(constructor);
    //     }

    //     let nodeSetInfo = getFullNodeInfo(nodeSet);
    //     if (nodeSetInfo) {
    //         if (nodeSetInfo.types.indexOf(type) === -1) {
    //             // A type is being registered for a known set, but for some reason
    //             // we didn't spot it when parsing the HTML file.
    //             // Registered a type is the definitive action - not the presence
    //             // of an edit template. Ensure it is on the list of known types.
    //             nodeSetInfo.types.push(type);
    //         }
    //     }

    //     nodeConstructors[type] = constructor;
    //     //  events.emit("type-registered",type);
    // }

    getAllNodeConfigs(lang: string) {
        if (!this.nodeConfigCache) {
            let result = "";
            let script = "";
            for (let i = 0; i < this.nodeList.length; i++) {
                let id = this.nodeList[i];
                let config = this.moduleConfigs[this.getModule(id)].nodes[this.getNode(id)];
                // if (config.enabled && !config.err) {
                result += config.config;
                result += this.loader.getNodeHelp(config, lang || "en-US") || "";
                //script += config.script;
                // }
            }
            //if (script.length > 0) {
            //    result += '<script type="text/javascript">';
            //    result += UglifyJS.minify(script, {fromString: true}).code;
            //    result += '</script>';
            //}
            this.nodeConfigCache = result;
        }
        return this.nodeConfigCache;
    }

    getNodeConfig(id: string, lang: string) {
        let config = this.moduleConfigs[this.getModule(id)];
        if (!config) {
            return null;
        }
        let configNode = config.nodes[this.getNode(id)];
        if (configNode) {
            let result = configNode.config;
            result += this.loader.getNodeHelp(configNode, lang || "en-US")

            //if (config.script) {
            //    result += '<script type="text/javascript">'+config.script+'</script>';
            //}
            return result;
        } else {
            return null;
        }
    }

    // getNodeConstructor(type) {
    //     let id = this.nodeTypeToId[type];

    //     let config;
    //     if (typeof id === "undefined") {
    //         config = undefined;
    //     } else {
    //         config = this.moduleConfigs[getModule(id)].nodes[getNode(id)];
    //     }

    //     if (!config || (config.enabled && !config.err)) {
    //         return nodeConstructors[type];
    //     }
    //     return null;
    // }

    clear() {
        this.nodeConfigCache = "";
        this.moduleConfigs = {};
        this.nodeList = [];
        this.nodeTypeToId = {};
    }

    getTypeId(type: string) {
        if (this.nodeTypeToId.hasOwnProperty(type)) {
            return this.nodeTypeToId[type];
        } else {
            return null;
        }
    }

    // enableNodeSet(this.typeOrId: string) {
    //     if (!settings.available()) {
    //         throw new Error("Settings unavailable");
    //     }

    //     let id = this.typeOrId;
    //     if (this.nodeTypeToId.hasOwnProperty(this.typeOrId)) {
    //         id = this.nodeTypeToId[this.typeOrId];
    //     }
    //     let config;
    //     try {
    //         config = this.moduleConfigs[getModule(id)].nodes[getNode(id)];
    //         delete config.err;
    //         config.enabled = true;
    //         this.nodeConfigCache = null;
    //         settings.enableNodeSettings(config.types);
    //         return saveNodeList().then(() {
    //             return filterNodeInfo(config);
    //         });
    //     } catch (err) {
    //         throw new Error("Unrecognised id: " + this.typeOrId);
    //     }
    // }

    // disableNodeSet(this.typeOrId) {
    //     if (!settings.available()) {
    //         throw new Error("Settings unavailable");
    //     }
    //     let id = this.typeOrId;
    //     if (this.nodeTypeToId.hasOwnProperty(this.typeOrId)) {
    //         id = this.nodeTypeToId[this.typeOrId];
    //     }
    //     let config;
    //     try {
    //         config = this.moduleConfigs[getModule(id)].nodes[getNode(id)];
    //         // TODO: persist setting
    //         config.enabled = false;
    //         this.nodeConfigCache = null;
    //         settings.disableNodeSettings(config.types);
    //         return saveNodeList().then(() {
    //             return filterNodeInfo(config);
    //         });
    //     } catch (err) {
    //         throw new Error("Unrecognised id: " + id);
    //     }
    // }

    // cleanModuleList() {
    //     let removed = false;
    //     for (let mod in this.moduleConfigs) {
    //         /* istanbul ignore else */
    //         if (this.moduleConfigs.hasOwnProperty(mod)) {
    //             let nodes = this.moduleConfigs[mod].nodes;
    //             let node;
    //             if (mod == "node-red") {
    //                 // For core nodes, look for nodes that are enabled, !loaded and !errored
    //                 for (node in nodes) {
    //                     /* istanbul ignore else */
    //                     if (nodes.hasOwnProperty(node)) {
    //                         let n = nodes[node];
    //                         if (n.enabled && !n.err && !n.loaded) {
    //                             removeNode(mod + "/" + node);
    //                             removed = true;
    //                         }
    //                     }
    //                 }
    //             } else {
    //                 if (this.moduleConfigs[mod] && !this.moduleNodes[mod]) {
    //                     // For node modules, look for missing ones
    //                     for (node in nodes) {
    //                         /* istanbul ignore else */
    //                         if (nodes.hasOwnProperty(node)) {
    //                             removeNode(mod + "/" + node);
    //                             removed = true;
    //                         }
    //                     }
    //                     delete this.moduleConfigs[mod];
    //                 }
    //             }
    //         }
    //     }
    //     if (removed) {
    //         saveNodeList();
    //     }
    // }
    // setModulePendingUpdated(module, version) {
    //     this.moduleConfigs[module].pending_version = version;
    //     return saveNodeList().then(() {
    //         return getModuleInfo(module);
    //     });
    // }

    nodeIconDir(dir: REDIconPath) {
        this.icon_paths[dir.name] = this.icon_paths[dir.name] || [];
        this.icon_paths[dir.name].push(path.resolve(dir.path));

        if (dir.icons) {
            if (!this.moduleConfigs[dir.name]) {
                this.moduleConfigs[dir.name] = new REDPackage();
                this.moduleConfigs[dir.name].name = dir.name;
            }
            let module = this.moduleConfigs[dir.name];
            if (module.icons === undefined) {
                module.icons = [];
            }
            for (let icon of dir.icons) {
                if (module.icons.indexOf(icon) === -1) {
                    module.icons.push(icon);
                }
            };
        }
    }

    getNodeIconPath(module: string, icon: string): string {
        let iconName = module + "/" + icon;
        if (this.iconCache[iconName]) {
            return this.iconCache[iconName];
        } else {
            let paths = this.icon_paths[module];
            if (paths) {
                for (let p = 0; p < paths.length; p++) {
                    let iconPath = path.join(paths[p], icon);
                    try {
                        fs.statSync(iconPath);
                        this.iconCache[iconName] = iconPath;
                        return iconPath;
                    } catch (err) {
                        // iconPath doesn't exist
                    }
                }
            }
            if (module !== "node-red") {
                return this.getNodeIconPath("node-red", icon);
            }

            return this.defaultIcon;
        }
    }

    getNodeIcons() {
        let iconList: {
            [moduleName: string]: string[];
        } = {};

        for (let module in this.moduleConfigs) {
            if (this.moduleConfigs.hasOwnProperty(module)) {
                if (this.moduleConfigs[module].icons) {
                    iconList[module] = this.moduleConfigs[module].icons;
                }
            }
        }

        return iconList;
    }
}


export { REDRegistry }
