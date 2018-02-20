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
import { CONFIG } from "./config";
import { REDModule, REDNodeList, REDPackage, REDNodeInfo, REDNode } from './types';
import { REDLoader } from "./loader";
import { REDi18n } from './i18n';


class REDLocalFileSystem {

    i18n: REDi18n;
    disableNodePathScan: boolean;
    iconFileExtensions: string[];

    constructor(i18n: REDi18n) {
        this.i18n = i18n;
        this.disableNodePathScan = false;
        this.iconFileExtensions = [".png", ".gif"];
    }

    getLocalFile(file: string): REDNode | null {
        try {
            fs.statSync(file.replace(/\.js$/, ".html"));
            let tempNode = new REDNode();
            tempNode.file = file;
            tempNode.module = "node-red";
            tempNode.name = path.basename(file).replace(/^\d+-/, "").replace(/\.js$/, "");
            tempNode.version = CONFIG.version;
            return tempNode;
        } catch (err) {
            return null;
        }
    }


    /**
     * Synchronously walks the directory looking for node files.
     * Emits 'node-icon-dir' events for an icon dirs found
     * @param dir the directory to search
     * @return an array of fully-qualified paths to .js files
     */
    getLocalNodeFiles(dir: string): REDNode[] {
        dir = path.resolve(dir);

        let result: REDNode[] = [];
        let files = [];
        try {
            files = fs.readdirSync(dir);
        } catch (err) {
            return result;
        }
        files.sort();
        for (let fn of files) {
            let stats = fs.statSync(path.join(dir, fn));
            if (stats.isFile()) {
                if (/\.js$/.test(fn)) {
                    let info = this.getLocalFile(path.join(dir, fn));
                    if (info) {
                        result.push(info);
                    }
                }
            } else if (stats.isDirectory()) {
                // Ignore /.dirs/, /lib/ /node_modules/
                if (!/^(\..*|lib|icons|node_modules|test|locales)$/.test(fn)) {
                    result = result.concat(this.getLocalNodeFiles(path.join(dir, fn)));
                }
            }
        };
        return result;
    }

    scanDirForNodesModules(dir: string, moduleName: string | null): REDModule[] {
        let results: REDModule[] = [];
        let scopeName;
        try {
            let files = fs.readdirSync(dir);
            if (moduleName) {
                let m = /^(?:(@[^/]+)[/])?([^@/]+)/.exec(moduleName);
                if (m) {
                    scopeName = m[1];
                    moduleName = m[2];
                }
            }
            for (let i = 0; i < files.length; i++) {
                let fn = files[i];
                if (/^@/.test(fn)) {
                    if (scopeName && scopeName === fn) {
                        // Looking for a specific scope/module
                        results = results.concat(this.scanDirForNodesModules(path.join(dir, fn), moduleName));
                        break;
                    } else {
                        results = results.concat(this.scanDirForNodesModules(path.join(dir, fn), moduleName));
                    }
                } else {
                    if (!moduleName || fn == moduleName) {
                        let pkgfn = path.join(dir, fn, "package.json");
                        try {
                            let pkg = require(pkgfn);
                            if (pkg['node-red']) {
                                let moduleDir = path.join(dir, fn);
                                results.push({ dir: moduleDir, package: pkg/*, local: true */});
                            }
                        } catch (err) {
                            if (err.code != "MODULE_NOT_FOUND") {
                                // TODO: handle unexpected error
                            }
                        }
                        if (fn == moduleName) {
                            break;
                        }
                    }
                }
            }
        } catch (err) {
        }
        return results;
    }

    /**
     * Scans the node_modules path for nodes
     * @param moduleName the name of the module to be found
     * @return a list of node modules: {dir,package}
     */
    scanTreeForNodesModules(moduleName: string | null): REDModule[] {
        let dir = CONFIG.coreNodesDir;
        let results: REDModule[] = [];
        let userDir;

        if (CONFIG.userDir) {
            userDir = path.join(CONFIG.userDir, "node_modules");
            results = this.scanDirForNodesModules(userDir, moduleName);
            for (let module of results) {
                module["local"] = true;
            }
        }

        if (dir) {
            let up = path.resolve(path.join(dir, ".."));
            while (up !== dir) {
                let pm = path.join(dir, "node_modules");
                if (pm != userDir) {
                    results = results.concat(this.scanDirForNodesModules(pm, moduleName));
                }
                dir = up;
                up = path.resolve(path.join(dir, ".."));
            }
        }
        return results;
    }

    getModuleNodeFiles(module: REDModule): REDNode[] {

        let moduleDir = module.dir;
        let pkg = module.package;

        let nodes: {
            [nodeName: string]: string
        } = {};

        if (pkg['node-red'] != undefined) {
            nodes = pkg["node-red"]!.nodes || {}
        }
        let results: REDNode[] = [];
        let iconDirs = [];

        for (let n in nodes) {
            /* istanbul ignore else */
            if (nodes.hasOwnProperty(n)) {
                let file = path.join(moduleDir, nodes[n]);
                let tempNode = new REDNode();
                tempNode.file = file;
                tempNode.module = pkg.name;
                tempNode.name = n;
                tempNode.version = pkg.version;
                results.push(tempNode);
                let iconDir = path.join(moduleDir, path.dirname(nodes[n]), "icons");
                if (iconDirs.indexOf(iconDir) == -1) {
                    try {
                        fs.statSync(iconDir);
                        let iconList = this.scanIconDir(iconDir);
                        iconDirs.push(iconDir);
                    } catch (err) {
                    }
                }
            }
        }
        let examplesDir = path.join(moduleDir, "examples");
        try {
            fs.statSync(examplesDir)
        } catch (err) {
        }
        return results;
    }

    getNodeFiles(disableNodePathScan: boolean) {
        // Find all of the nodes to load
        let nodeFiles: REDNode[] = [];

        let dir = path.resolve(__dirname + '/../public/icons');
        let iconList = this.scanIconDir(dir);

        if (CONFIG.coreNodesDir) {
            nodeFiles = this.getLocalNodeFiles(path.resolve(CONFIG.coreNodesDir));
            let defaultLocalesPath = path.join(CONFIG.coreNodesDir, "core", "locales");
            this.i18n.registerMessageCatalog("node-red",defaultLocalesPath,"messages.json");
            defaultLocalesPath = path.join(CONFIG.coreNodesDir, "editor", "locales");
            this.i18n.registerMessageCatalog("editor",defaultLocalesPath,"editor.json");
            this.i18n.registerMessageCatalog("jsonata",defaultLocalesPath,"jsonata.json");
            this.i18n.registerMessageCatalog("infotips",defaultLocalesPath,"infotips.json");
        }

        if (CONFIG.userDir) {
            dir = path.join(CONFIG.userDir, "lib", "icons");
            iconList = this.scanIconDir(dir);

            dir = path.join(CONFIG.userDir, "nodes");
            nodeFiles = nodeFiles.concat(this.getLocalNodeFiles(dir));
        }
        if (CONFIG.nodesDir.length != 0) {
            let nodesDir = CONFIG.nodesDir;
            for (let i = 0; i < nodesDir.length; i++) {
                nodeFiles = nodeFiles.concat(this.getLocalNodeFiles(nodesDir[i]));
            }
        }

        let nodeList = new REDNodeList();
        nodeList["node-red"] = new REDPackage();
        nodeList["node-red"].name = "node-red";
        nodeList["node-red"].version = CONFIG.version;

        for (let node of nodeFiles) {
            nodeList["node-red"]["nodes"][node.name] = node;
        };

        if (!disableNodePathScan) {
            let modules = this.scanTreeForNodesModules(null);
            for (let module of modules) {
                let moduleFiles = this.getModuleNodeFiles(module);
                nodeList[module.package.name] = new REDPackage();
                nodeList[module.package.name].name = module.package.name;
                nodeList[module.package.name].version = module.package.version;
                nodeList[module.package.name].local = module.local || false;
                if (module.package['node-red'] != undefined) {
                    if (module.package['node-red']!.version) {
                        nodeList[module.package.name].redVersion = module.package['node-red']!.version;
                    }
                }
                for (let node of moduleFiles) {
                    node.local = module.local || false;
                    nodeList[module.package.name].nodes[node.name] = node;
                };
                nodeFiles = nodeFiles.concat(moduleFiles);
            };
        } else {
            console.log("node path scan disabled");
        }
        return nodeList;
    }

    getModuleFiles(module: string) {
        let nodeList: REDNodeList = {};

        let moduleFiles = this.scanTreeForNodesModules(module);
        if (moduleFiles.length === 0) {
            let err = new Error("nodes.registry.localfilesystem.module-not-found");
            throw err;
        }

        for (let moduleFile of moduleFiles) {
            let nodeModuleFiles = this.getModuleNodeFiles(moduleFile);
            nodeList[moduleFile.package.name].name = moduleFile.package.name;
            nodeList[moduleFile.package.name].version = moduleFile.package.version;

            if (moduleFile.package['node-red'] != undefined) {
                nodeList[moduleFile.package.name].redVersion = moduleFile.package['node-red']!.version;
            }
            for (let node of nodeModuleFiles) {
                nodeList[moduleFile.package.name].nodes[node.name] = node;
                nodeList[moduleFile.package.name].nodes[node.name].local = moduleFile.local || false;
            };
        };
        return nodeList;
    }

    scanIconDir(dir: string) {
        let iconList: string[] = [];
        try {
            let files = fs.readdirSync(dir);
            for (let file of files) {
                let stats = fs.statSync(path.join(dir, file));
                if (stats.isFile() && this.iconFileExtensions.indexOf(path.extname(file)) !== -1) {
                    iconList.push(file);
                }
            };
        } catch (err) {
        }
        return iconList;
    }
}

export { REDLocalFileSystem }
