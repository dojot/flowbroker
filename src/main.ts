import fs = require("fs");
import path = require("path");
import util = require("util");

class Settings {
  version: "1.0.0"
}
let settings = new Settings();

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
function getNodeFiles(dir: string) : NodeRedFileInfo[]{
  let ret: NodeRedFileInfo[] = [];
  let currentPath = path.resolve(dir);

  let filenames: string[] = [];
  try {
    filenames = fs.readdirSync(dir);
  } catch (error) {
    console.log("Error while reading directory " + dir + ": " + error);
    console.log("Bailing out.");
    return ret;
  }

  for(let filename of filenames) {
    let fullPath = path.join(dir, filename);
    let stats = fs.statSync(fullPath);
    if (stats.isFile()) {
      try {
        // Add to file info list.
        fs.statSync(fullPath.replace(/\.js$/, ".html"));
        let fileInfo: NodeRedFileInfo = {
          file: fullPath,
          module: "node-red",
          name: path.basename(fullPath).replace(/^\d+-/, "").replace(/\.js$/, ""),
          version: settings.version
        }
        ret.push(fileInfo);
      } catch (err) {
        // Do nothing - there is no 
      }
      
    } else if (stats.isDirectory() && !/^(\..*|lib|icons|node_modules|test|locales)$/.test(filename)) {
      // Descend.
      let subdirInfo = getNodeFiles(fullPath);
      ret = ret.concat(subdirInfo);
    }
  }

  return ret;
}


let result = getNodeFiles("./nodes");

console.log("Results:");
console.log(util.inspect(result, {depth: null}));