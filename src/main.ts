import fs = require("fs");
import path = require("path");
import util = require("util");
import { appendFile } from "fs";

class NodeRedFileInfo {
  // Filename
  file: string;
  // Module name
  module: string;
  // Node name
  name: string;
  // Node version
  version: string;
}

/**
 * Return all files related to Node-RED in a folder (including its 
 * subdirectories).
 * 
 * If any error occurs while reading this directory, an empty list will be 
 * returned.
 * 
 * @param dir The directory to be searched.
 * @returns A list of file info.
 */
function getNodeRedFiles(dir: string, shouldDescend: (pathName: string) => boolean, processFileCbk: (filename: string) => void) {
  let currentPath = path.resolve(dir);

  let filenames: string[] = [];
  try {
    filenames = fs.readdirSync(dir);
  } catch (error) {
    console.log("Error while reading directory " + dir + ": " + error);
    console.log("Bailing out.");
  }

  for(let filename of filenames) {
    let fullPath = path.join(dir, filename);
    let stats = fs.statSync(fullPath);
    if (stats.isFile()) {
      processFileCbk(fullPath);
    } else if (stats.isDirectory() &&  shouldDescend(filename)) {
      // Descend.
      let subdirInfo = getNodeRedFiles(fullPath, shouldDescend, processFileCbk);
    }
  }
}

function gatherNodeFileInfo(dir: string) : NodeRedFileInfo [] {
  let ret: NodeRedFileInfo[] = [];
  let shouldDescend = (filePath: string) => {
    return !/^(\..*|lib|icons|node_modules|test|locales)$/.test(filePath)
  }
  let nodeInfoCbk = (filename: string) => { 
      try {
        // Check whether for each .js file there is also a .html file.
        fs.statSync(filename.replace(/\.js$/, ".html"));
        let fileInfo: NodeRedFileInfo = {
          file: filename,
          module: "node-red",
          name: path.basename(filename).replace(/^\d+-/, "").replace(/\.js$/, ""),
          version: "1.0.0"
        }
        ret.push(fileInfo);
      } catch (err) {
        // Do nothing - there is no such file.
      }
  };
  getNodeRedFiles(dir, shouldDescend, nodeInfoCbk);
  return ret;
}


let result = gatherNodeFileInfo("./nodes");

console.log("Results:");
console.log(util.inspect(result, {depth: null}));