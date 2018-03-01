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

import i18n = require("i18next");
import when = require("when");
import path = require("path");
import fs = require("fs");
import util = require("util");

import { REDi18nCatalog, REDNodeList } from './types';

export class REDi18n {
  defaultLang: string;
  i = i18n;

  resourceMap: {
    [namespace: string]: {
      basedir: string;
      file: string;
    };
  };
  resourceCache: {
    [namespace: string]: {
      [language: string]: any;
    };
  };

  constructor() {
    this.defaultLang = "en-US";
    this.resourceCache = {};
    this.resourceMap = {};
  }

  registerMessageCatalogs(catalogs: REDi18nCatalog[]) {
    var promises = catalogs.map(catalog => {
      return this.registerMessageCatalog(
        catalog.namespace,
        catalog.dir,
        catalog.file
      );
    });
    return when.settle(promises);
  }

  registerMessageCatalog(namespace: string, dir: string, file: string) {
    return when.promise((resolve, reject) => {
      this.resourceMap[namespace] = { basedir: dir, file: file };
      this.i.loadNamespaces([namespace], () => { resolve(0); });
    });
  }

  mergeCatalog(fallback: any, catalog: any) : void {
    for (var k in fallback) {
      if (fallback.hasOwnProperty(k)) {
        if (!catalog[k]) {
          catalog[k] = fallback[k];
        } else if (typeof fallback[k] === "object") {
          this.mergeCatalog(fallback[k], catalog[k]);
        }
      }
    }
  }

  // Not actually sure how this is used.
  MessageFileLoader = {
      type: "backend",
      read: (lng: string, ns: string, callback: any) => {
          if (this.resourceMap[ns]) {
              var file = path.join(this.resourceMap[ns].basedir,lng,this.resourceMap[ns].file);
              //console.log(file);
              fs.readFile(file,"utf8",(err,content) => {
                  if (err) {
                      callback(err);
                  } else {
                      try {
                          this.resourceCache[ns] = this.resourceCache[ns]||{};
                          this.resourceCache[ns][lng] = JSON.parse(content.replace(/^\uFEFF/, ''));
                          //console.log(resourceCache[ns][lng]);
                          if (lng !== this.defaultLang) {
                            this.mergeCatalog(this.resourceCache[ns][this.defaultLang],this.resourceCache[ns][lng]);
                          }
                          callback(null, this.resourceCache[ns][lng]);
                      } catch(e) {
                          callback(e);
                      }
                  }
              });
          } else {
              callback(new Error("Unrecognised namespace"));
          }
      }

  }

  init() {
    console.log("[I18N] Building promise for i18n initialization.");
    return when.promise((resolve, reject) => {
      console.log("[I18N] Loading MessageFileLoader plugin...");
      this.i.use(this.MessageFileLoader);
      console.log("[I18N] Initializing i18n...");
      this.i.init(
        {
          ns: [],
          defaultNS: "runtime",
          fallbackLng: [this.defaultLang]
        },
        (error) => {
          console.log("[I18N] ... i18n initialization finished.");
          console.log("[I18N] Error is: " + util.inspect(error, {depth: null}));
          if (error) {
            console.log("[I18N] Rejecting initialization promise.");
            // reject(error);
            resolve(0);
          } else {
            console.log("[I18N] Resolving initialization promise.");
            resolve(0);
          }
        }
      );
    });
  }

  getCatalog(namespace: string, lang: string) {
    var result = null;
    lang = lang || this.defaultLang;
    if (this.resourceCache.hasOwnProperty(namespace)) {
      result = this.resourceCache[namespace][lang];
      if (!result) {
        var langParts = lang.split("-");
        if (langParts.length == 2) {
          result = this.resourceCache[namespace][langParts[0]];
        }
      }
    }
    return result;
  }
}
