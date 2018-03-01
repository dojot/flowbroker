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

import when = require("when");
import fs = require("fs");
import path = require("path");
import util = require("util");
import { map } from "when";

import { REDNode, REDNodeList } from "./types";
import { CONFIG } from "./config"
import { REDRegistry } from "./registry";
import { REDLocalFileSystem } from "./localfilesystem";


class REDLoader {
    registry: REDRegistry;
    localfilesystem: REDLocalFileSystem;

    constructor(reg: REDRegistry, fs: REDLocalFileSystem) {
        this.registry = reg;
        this.localfilesystem = fs
    }

    load() {
        console.log("[LOADER] Retrieving a list of red-node files...");
        let nodeFiles = this.localfilesystem.getNodeFiles(false);
        console.log("[LOADER] ... a list of red-node files was built.");
        console.log("[LOADER] Returning a promise of loading this list...");
        return this.loadNodeFiles(nodeFiles);
    }

    loadNodeFiles(nodeFiles: REDNodeList) {
        console.log("[LOADER] Building node configuration load promises...");
        let promises: When.Promise<REDNode>[] = [];
        for (let module in nodeFiles) {
            /* istanbul ignore else */
            if (nodeFiles.hasOwnProperty(module)) {
                if (module == "node-red" || !this.registry.getModuleInfo(module)) {
                    let first = true;
                    for (let node in nodeFiles[module].nodes) {
                        /* istanbul ignore else */
                        if (nodeFiles[module].nodes.hasOwnProperty(node)) {
                            if (module != "node-red" && first) {
                                // Check the module directory exists
                                first = false;
                                let fn = nodeFiles[module].nodes[node].file;
                                let parts = fn.split("/");
                                let i = parts.length - 1;
                                for (; i >= 0; i--) {
                                    if (parts[i] == "node_modules") {
                                        break;
                                    }
                                }
                                let moduleFn = parts.slice(0, i + 2).join("/");

                                try {
                                    let stat = fs.statSync(moduleFn);
                                } catch (err) {
                                    // Module not found, don't attempt to load its nodes
                                    break;
                                }
                            }

                            try {
                                promises.push(this.loadNodeConfig(nodeFiles[module].nodes[node]))
                            } catch (err) {
                                //
                            }
                        }
                    }
                }
            }
        }
        console.log("[LOADER] ... all node configuration load promises were built.");
        console.log("[LOADER] Building a 'settle' promise to load all nodes from config files.")
        return when.settle(promises).then((descriptors: when.Descriptor<any>[]) => {
            console.log("[LOADER] Some of the promises from load all nodes from config files set were fulfilled.")
            let nodes = descriptors.map((r: when.Descriptor<REDNode>) => {
                if (r.value != undefined) {
                    this.registry.addNodeSet(r.value.id, r.value, r.value.version);
                    return r.value;
                }
                return null;
            });

            let filteredNodes: REDNode[] = [];
            for (let node of nodes) {
                if (node != undefined) {
                    filteredNodes.push(node)
                }
            }

            console.log("[LOADER] Filtered results length is " + filteredNodes.length);
            if (filteredNodes.length != 0) {
                return this.loadNodeSetList(filteredNodes);
            }
        }).catch((descriptors: When.Descriptor<REDNode>[]) => {
            console.log("[LOADER] None of the promises from load all nodes from config files set were fulfilled.")
            for (let d of descriptors) {
                if (d.state == "rejected") {
                    console.log("[LOADER] One promise was rejected: " + util.inspect(d.reason, {depth: null}));
                } else {
                    console.log("[LOADER] One promise was resolved: " + util.inspect(d.value, {depth: null}));
                }
            }
        });
    }

    loadNodeConfig(fileInfo: REDNode): When.Promise<REDNode> {
        return when.promise((resolve) => {
            console.log("Loading node config for fileInfo " + fileInfo.name);
            let file = fileInfo.file;
            let module = fileInfo.module;
            let name = fileInfo.name;
            let version = fileInfo.version;

            let id = module + "/" + name;
            let info = this.registry.getNodeInfo(id);
            let isEnabled = true;
            if (info) {
                if (info.hasOwnProperty("loaded")) {
                    throw new Error(file + " already loaded");
                }
                isEnabled = info.enabled;
            }

            let node: REDNode = {
                id: id,
                module: module,
                name: name,
                file: file,
                template: file.replace(/\.js$/, ".html"),
                enabled: isEnabled,
                loaded: false,
                version: version,
                local: fileInfo.local,
                config: "",
                err: null,
                help: {},
                namespace: "",
                types: []
            };
            if (fileInfo.types != undefined) {
                node.types = fileInfo.types;
            }

            fs.readFile(node.template, 'utf8', (err, content) => {
                if (err) {
                    node.types = [];
                    if (err.code === 'ENOENT') {
                        if (!node.types) {
                            node.types = [];
                        }
                        node.err = "Error: " + node.template + " does not exist";
                    } else {
                        node.types = [];
                        node.err = err.toString();
                    }
                    resolve(node);
                } else {
                    let types = [];

                    let regExp = /<script (?:[^>]*)data-template-name\s*=\s*['"]([^'"]*)['"]/gi;
                    let match = null;

                    while ((match = regExp.exec(content)) !== null) {
                        types.push(match[1]);
                    }
                    node.types = types;

                    let langRegExp = /^<script[^>]* data-lang\s*=\s*['"](.+?)['"]/i;
                    regExp = /(<script[^>]* data-help-name=[\s\S]*?<\/script>)/gi;
                    match = null;
                    let mainContent = "";
                    let helpContent: {
                        [language: string]: string;
                    } = {};
                    let index = 0;
                    while ((match = regExp.exec(content)) !== null) {
                        mainContent += content.substring(index, regExp.lastIndex - match[1].length);
                        index = regExp.lastIndex;
                        let help = content.substring(regExp.lastIndex - match[1].length, regExp.lastIndex);

                        let lang = CONFIG.defaultLang;
                        if ((match = langRegExp.exec(help)) !== null) {
                            lang = match[1];
                        }
                        if (!helpContent.hasOwnProperty(lang)) {
                            helpContent[lang] = "";
                        }

                        helpContent[lang] += help;
                    }
                    mainContent += content.substring(index);

                    node.config = mainContent;
                    node.help = helpContent;
                    // TODO: parse out the javascript portion of the template
                    //node.script = "";
                    for (let i = 0; i < node.types.length; i++) {
                        if (this.registry.getTypeId(node.types[i])) {
                            node.err = node.types[i] + " already registered";
                            break;
                        }
                    }
                    fs.stat(path.join(path.dirname(file), "locales"), (err, stat) => {
                        if (!err) {
                            node.namespace = node.id;
                            this.registry.i18n.registerMessageCatalog(node.id,
                                path.join(path.dirname(file), "locales"),
                                path.basename(file, ".js") + ".json")
                                .then(() => {
                                    resolve(node);
                                });
                        } else {
                            node.namespace = node.module;
                            resolve(node);
                        }
                    });
                }
            });
        });
    }

    /**
     * Loads the specified node into the runtime
     * @param node a node info object - see loadNodeConfig
     * @return a promise that resolves to an update node info object. The object
     *         has the following properties added:
     *            err: any error encountered whilst loading the node
     *
     */
    loadNodeSet(node: REDNode) {
        let nodeDir = path.dirname(node.file);
        let nodeFn = path.basename(node.file);
        if (!node.enabled) {
            return when.resolve(node);
        } else {
        }

        // try {
        let loadPromise = null;
        // let r = require(node.file);
        // // This is where the from JS file is loaded into NodeRED
        // if (typeof r === "function") {
        //     let red = createNodeApi(node);
        //     let promise = r(red);
        //     if (promise != null && typeof promise.then === "function") {
        //         loadPromise = promise.then(() {
        //             node.enabled = true;
        //             node.loaded = true;
        //             return node;
        //         }).catch((err) {
        //             node.err = err;
        //             return node;
        //         });
        //     }
        // }
        if (loadPromise == null) {
            node.enabled = true;
            node.loaded = true;
            loadPromise = when.resolve(node);
        }
        return loadPromise;
        // } catch (err) {
        //     node.err = err;
        //     let stack = err.stack;
        //     let message;
        //     if (stack) {
        //         let i = stack.indexOf(node.file);
        //         if (i > -1) {
        //             let excerpt = stack.substring(i + node.file.length + 1, i + node.file.length + 20);
        //             let m = /^(\d+):(\d+)/.exec(excerpt);
        //             if (m) {
        //                 node.err = err + " (line:" + m[1] + ")";
        //             }
        //         }
        //     }
        //     return when.resolve(node);
        // }
    }

    loadNodeSetList(nodes: REDNode[]) {
        let promises = [];
        for (let node of nodes) {
            if (!node.err) {
                promises.push(this.loadNodeSet(node));
            } else {
                promises.push(node);
            }
        };

        return when.all(promises).then(() => {
            return this.registry.saveNodeList();
        });
    }

    addModule(module: string): when.Promise<any> {
        let nodes = [];
        if (this.registry.getModuleInfo(module)) {
            // TODO: nls
            let e = new Error("module_already_loaded");
            return when.reject(e);
        }
        try {
            let moduleFiles = this.localfilesystem.getModuleFiles(module);
            return this.loadNodeFiles(moduleFiles);
        } catch (err) {
            return when.reject(err);
        }
    }

    loadNodeHelp(node: REDNode, lang: string): string | null {
        let dir = path.dirname(node.template);
        let base = path.basename(node.template);
        let localePath = path.join(dir, "locales", lang, base);
        try {
            // TODO: make this async
            let content = fs.readFileSync(localePath, "utf8")
            return content;
        } catch (err) {
            return null;
        }
    }

    getNodeHelp(node: REDNode, lang: string): string | null {
        if (!node.help[lang]) {
            let help = this.loadNodeHelp(node, lang);
            if (help == null) {
                let langParts = lang.split("-");
                if (langParts.length == 2) {
                    help = this.loadNodeHelp(node, langParts[0]);
                }
            }
            if (help) {
                node.help[lang] = help;
            } else if (lang === CONFIG.defaultLang) {
                return null;
            } else {
                node.help[lang] = this.getNodeHelp(node, CONFIG.defaultLang);
            }
        }
        return node.help[lang];
    }
}

export { REDLoader }
