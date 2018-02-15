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

import loader = require("./loader");
import { REDNode, REDNodeList, REDNodeFile, REDPackage } from "./types";

//  let events = require("../../events");

let Node;

let nodeConfigCache = "";
let moduleConfigs: REDNodeList = {};
let nodeList: string[] = [];
let nodeConstructors = {};

let nodeTypeToId: {
    [type: string] : string
} = {};

let moduleNodes: {
    [moduleName: string]: string []
} =  {};

let settings: {
    nodes: REDNodeList
} = {
    nodes: {}
}

function init() {
    moduleNodes = {};
    nodeTypeToId = {};
    nodeConstructors = {};
    nodeList = [];
    nodeConfigCache = "";
    //  Node = require("../Node");
    //  events.removeListener("node-icon-dir",nodeIconDir);
    //  events.on("node-icon-dir",nodeIconDir);

}

function load() {
    moduleConfigs = loadNodeConfigs();
}

function filterNodeInfo(n: REDNodeFile) {
    let r: REDNode  = {
        id: n.module + "/" + n.name,
        name: n.name,
        types: n.types,
        local: n.local || false,
        enabled: true,
        module: "",
        config: "",
        err: null,
        file: "",
        help: { },
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



function getModule(id: string) {
    let parts = id.split("/");
    return parts.slice(0, parts.length - 1).join("/");
}

function getNode(id: string) {
    let parts = id.split("/");
    return parts[parts.length - 1];
}

function saveNodeList() {
    let moduleList: REDNodeList = {};
    let hadPending = false;
    let hasPending = false;
    for (let module in moduleConfigs) {
        /* istanbul ignore else */
        if (moduleConfigs.hasOwnProperty(module)) {
            if (Object.keys(moduleConfigs[module].nodes).length > 0) {
                if (!moduleList[module]) {
                    moduleList[module] = {
                        name: module,
                        version: moduleConfigs[module].version,
                        local: moduleConfigs[module].local || false,
                        nodes: {}
                    };
                }
                let nodes = moduleConfigs[module].nodes;
                for (let node in nodes) {
                    /* istanbul ignore else */
                    if (nodes.hasOwnProperty(node)) {
                        let config = nodes[node];
                        let n = filterNodeInfo(config);
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

    settings.nodes = moduleList;
}

function loadNodeConfigs() : REDNodeList {
    let configs = settings.nodes;

    if (configs['node-red']) {
        return configs;
    } else {
        return {};
    }
}

function addNodeSet(id: string, set: REDNode, version: string) {
    if (!set.err) {
        for (let t of set.types) {
            if (nodeTypeToId.hasOwnProperty(t)) {
                set.err = new Error("Type already registered");
            }
        };
        if (!set.err) {
            for (let t of set.types)  {
                nodeTypeToId[t] = id;
            };
        }
    }
    moduleNodes[set.module] = moduleNodes[set.module] || [];
    moduleNodes[set.module].push(set.name);

    if (!moduleConfigs[set.module]) {
        moduleConfigs[set.module] = {
            name: set.module,
            nodes: {},
            local: set.local,
            redVersion: "",
            version: version || ""
        };
    }

    moduleConfigs[set.module].nodes[set.name] = set;
    nodeList.push(id);
    nodeConfigCache = "";
}

// function removeNode(id: string) {
//     let config = moduleConfigs[getModule(id)].nodes[getNode(id)];
//     if (!config) {
//         throw new Error("Unrecognised id: " + id);
//     }
//     delete moduleConfigs[getModule(id)].nodes[getNode(id)];
//     let i = nodeList.indexOf(id);
//     if (i > -1) {
//         nodeList.splice(i, 1);
//     }
//     config.types.forEach(function (t) {
//         let typeId = nodeTypeToId[t];
//         if (typeId === id) {
//             delete nodeConstructors[t];
//             delete nodeTypeToId[t];
//         }
//     });
//     config.enabled = false;
//     config.loaded = false;
//     nodeConfigCache = null;
//     return filterNodeInfo(config);
// }

// function removeModule(module) {
//     if (!settings.available()) {
//         throw new Error("Settings unavailable");
//     }
//     let nodes = moduleNodes[module];
//     if (!nodes) {
//         throw new Error("Unrecognised module: " + module);
//     }
//     let infoList = [];
//     for (let i = 0; i < nodes.length; i++) {
//         infoList.push(removeNode(module + "/" + nodes[i]));
//     }
//     delete moduleNodes[module];
//     delete moduleConfigs[module];
//     saveNodeList();
//     return infoList;
// }

function getNodeInfo(typeOrId: string) {
    let id = typeOrId;
    if (nodeTypeToId.hasOwnProperty(typeOrId)) {
        id = nodeTypeToId[typeOrId];
    }
    /* istanbul ignore else */
    if (id) {
        let module = moduleConfigs[getModule(id)];
        if (module) {
            let config = module.nodes[getNode(id)];
            if (config) {
                let info = filterNodeInfo(config);
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

function getFullNodeInfo(typeOrId: string) {
    // Used by index.enableNodeSet so that .file can be retrieved to pass
    // to loader.loadNodeSet
    let id = typeOrId;
    if (nodeTypeToId.hasOwnProperty(typeOrId)) {
        id = nodeTypeToId[typeOrId];
    }
    /* istanbul ignore else */
    if (id) {
        let module = moduleConfigs[getModule(id)];
        if (module) {
            return module.nodes[getNode(id)];
        }
    }
    return null;
}

function getNodeList(/** filter */) {
    let list = [];
    for (let module in moduleConfigs) {
        /* istanbul ignore else */
        if (moduleConfigs.hasOwnProperty(module)) {
            let nodes = moduleConfigs[module].nodes;
            for (let node in nodes) {
                /* istanbul ignore else */
                if (nodes.hasOwnProperty(node)) {
                    let nodeInfo = filterNodeInfo(nodes[node]);
                    nodeInfo.version = moduleConfigs[module].version;
                    // if (moduleConfigs[module].pending_version) {
                    //     nodeInfo.pending_version = moduleConfigs[module].pending_version;
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

function getModuleList() {
    //let list = [];
    //for (let module in moduleNodes) {
    //    /* istanbul ignore else */
    //    if (moduleNodes.hasOwnProperty(module)) {
    //        list.push(registry.getModuleInfo(module));
    //    }
    //}
    //return list;
    return moduleConfigs;

}

function getModuleInfo(module: string) {
    if (moduleNodes[module]) {
        let nodes = moduleNodes[module];
        let m: REDPackage = {
            name: module,
            version: moduleConfigs[module].version,
            local: moduleConfigs[module].local,
            nodes: {}
        };
        for (let i = 0; i < nodes.length; ++i) {
            let nodeInfo = filterNodeInfo(moduleConfigs[module].nodes[nodes[i]]);
            nodeInfo.version = m.version;
            m.nodes[nodeInfo.name] = nodeInfo;
        }
        return m;
    } else {
        return null;
    }
}

// function getCaller() {
//     let orig = Error.prepareStackTrace;
//     Error.prepareStackTrace = function (_, stack) { return stack; };
//     let err = new Error();
//     Error.captureStackTrace(err, arguments.callee);
//     let stack = err.stack;
//     Error.prepareStackTrace = orig;
//     stack.shift();
//     stack.shift();
//     return stack[0].getFileName();
// }

// function inheritNode(constructor) {
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

// function registerNodeConstructor(nodeSet, type, constructor) {
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

function getAllNodeConfigs(lang: string) {
    if (!nodeConfigCache) {
        let result = "";
        let script = "";
        for (let i = 0; i < nodeList.length; i++) {
            let id = nodeList[i];
            let config = moduleConfigs[getModule(id)].nodes[getNode(id)];
            // if (config.enabled && !config.err) {
                result += config.config;
                result += loader.getNodeHelp(config, lang || "en-US") || "";
                //script += config.script;
            // }
        }
        //if (script.length > 0) {
        //    result += '<script type="text/javascript">';
        //    result += UglifyJS.minify(script, {fromString: true}).code;
        //    result += '</script>';
        //}
        nodeConfigCache = result;
    }
    return nodeConfigCache;
}

function getNodeConfig(id: string, lang: string) {
    let config = moduleConfigs[getModule(id)];
    if (!config) {
        return null;
    }
    let configNode = config.nodes[getNode(id)];
    if (configNode) {
        let result = configNode.config;
        result += loader.getNodeHelp(configNode, lang || "en-US")

        //if (config.script) {
        //    result += '<script type="text/javascript">'+config.script+'</script>';
        //}
        return result;
    } else {
        return null;
    }
}

// function getNodeConstructor(type) {
//     let id = nodeTypeToId[type];

//     let config;
//     if (typeof id === "undefined") {
//         config = undefined;
//     } else {
//         config = moduleConfigs[getModule(id)].nodes[getNode(id)];
//     }

//     if (!config || (config.enabled && !config.err)) {
//         return nodeConstructors[type];
//     }
//     return null;
// }

function clear() {
    nodeConfigCache = "";
    moduleConfigs = {};
    nodeList = [];
    nodeConstructors = {};
    nodeTypeToId = {};
}

function getTypeId(type: string) {
    if (nodeTypeToId.hasOwnProperty(type)) {
        return nodeTypeToId[type];
    } else {
        return null;
    }
}

// function enableNodeSet(typeOrId: string) {
//     if (!settings.available()) {
//         throw new Error("Settings unavailable");
//     }

//     let id = typeOrId;
//     if (nodeTypeToId.hasOwnProperty(typeOrId)) {
//         id = nodeTypeToId[typeOrId];
//     }
//     let config;
//     try {
//         config = moduleConfigs[getModule(id)].nodes[getNode(id)];
//         delete config.err;
//         config.enabled = true;
//         nodeConfigCache = null;
//         settings.enableNodeSettings(config.types);
//         return saveNodeList().then(function () {
//             return filterNodeInfo(config);
//         });
//     } catch (err) {
//         throw new Error("Unrecognised id: " + typeOrId);
//     }
// }

// function disableNodeSet(typeOrId) {
//     if (!settings.available()) {
//         throw new Error("Settings unavailable");
//     }
//     let id = typeOrId;
//     if (nodeTypeToId.hasOwnProperty(typeOrId)) {
//         id = nodeTypeToId[typeOrId];
//     }
//     let config;
//     try {
//         config = moduleConfigs[getModule(id)].nodes[getNode(id)];
//         // TODO: persist setting
//         config.enabled = false;
//         nodeConfigCache = null;
//         settings.disableNodeSettings(config.types);
//         return saveNodeList().then(function () {
//             return filterNodeInfo(config);
//         });
//     } catch (err) {
//         throw new Error("Unrecognised id: " + id);
//     }
// }

// function cleanModuleList() {
//     let removed = false;
//     for (let mod in moduleConfigs) {
//         /* istanbul ignore else */
//         if (moduleConfigs.hasOwnProperty(mod)) {
//             let nodes = moduleConfigs[mod].nodes;
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
//                 if (moduleConfigs[mod] && !moduleNodes[mod]) {
//                     // For node modules, look for missing ones
//                     for (node in nodes) {
//                         /* istanbul ignore else */
//                         if (nodes.hasOwnProperty(node)) {
//                             removeNode(mod + "/" + node);
//                             removed = true;
//                         }
//                     }
//                     delete moduleConfigs[mod];
//                 }
//             }
//         }
//     }
//     if (removed) {
//         saveNodeList();
//     }
// }
// function setModulePendingUpdated(module, version) {
//     moduleConfigs[module].pending_version = version;
//     return saveNodeList().then(function () {
//         return getModuleInfo(module);
//     });
// }

let icon_paths = {
    "node-red": [path.resolve(__dirname + '/../../../../public/icons')]
};
let iconCache = {};
let defaultIcon = path.resolve(__dirname + '/../../../../public/icons/arrow-in.png');

function nodeIconDir(dir) {
    icon_paths[dir.name] = icon_paths[dir.name] || [];
    icon_paths[dir.name].push(path.resolve(dir.path));

    if (dir.icons) {
        if (!moduleConfigs[dir.name]) {
            moduleConfigs[dir.name] = {
                name: dir.name,
                nodes: {},
                icons: []
            };
        }
        let module = moduleConfigs[dir.name];
        if (module.icons === undefined) {
            module.icons = [];
        }
        dir.icons.forEach(function (icon) {
            if (module.icons.indexOf(icon) === -1) {
                module.icons.push(icon);
            }
        });
    }
}

function getNodeIconPath(module, icon) {
    let iconName = module + "/" + icon;
    if (iconCache[iconName]) {
        return iconCache[iconName];
    } else {
        let paths = icon_paths[module];
        if (paths) {
            for (let p = 0; p < paths.length; p++) {
                let iconPath = path.join(paths[p], icon);
                try {
                    fs.statSync(iconPath);
                    iconCache[iconName] = iconPath;
                    return iconPath;
                } catch (err) {
                    // iconPath doesn't exist
                }
            }
        }
        if (module !== "node-red") {
            return getNodeIconPath("node-red", icon);
        }

        return defaultIcon;
    }
}

function getNodeIcons() {
    let iconList = {};

    for (let module in moduleConfigs) {
        if (moduleConfigs.hasOwnProperty(module)) {
            if (moduleConfigs[module].icons) {
                iconList[module] = moduleConfigs[module].icons;
            }
        }
    }

    return iconList;
}

let registry = module.exports = {
    init: init,
    load: load,
    clear: clear,

    registerNodeConstructor: registerNodeConstructor,
    getNodeConstructor: getNodeConstructor,

    addNodeSet: addNodeSet,
    enableNodeSet: enableNodeSet,
    disableNodeSet: disableNodeSet,

    setModulePendingUpdated: setModulePendingUpdated,
    removeModule: removeModule,

    getNodeInfo: getNodeInfo,
    getFullNodeInfo: getFullNodeInfo,
    getNodeList: getNodeList,
    getModuleList: getModuleList,
    getModuleInfo: getModuleInfo,

    getNodeIconPath: getNodeIconPath,
    getNodeIcons: getNodeIcons,
    /**
     * Gets all of the node template configs
     * @return all of the node templates in a single string
     */
    getAllNodeConfigs: getAllNodeConfigs,
    getNodeConfig: getNodeConfig,

    getTypeId: getTypeId,

    saveNodeList: saveNodeList,

    cleanModuleList: cleanModuleList
};
