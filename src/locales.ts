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

import fs = require("fs");
import path = require("path");
import { REDNodeList } from './types';
import { REDi18n } from './i18n';
import { REDRegistry } from './registry';

export class REDLocale {
  i18n: REDi18n;
  nodes: REDRegistry;

  constructor(i18n: REDi18n, nodes: REDRegistry) {
      this.i18n = i18n;
      this.nodes = nodes;
  }

  get(namespace: string, lang: string, callback: (x: any) => void) {
      namespace = namespace.replace(/\.json$/,"");
      var prevLang = this.i18n.i.language;
      // Trigger a load from disk of the language if it is not the default
      this.i18n.i.loadLanguages(lang, () => {
          var catalog = this.i18n.getCatalog(namespace,lang);
          callback(catalog);
      });
      this.i18n.i.loadLanguages(prevLang, () => { });
  }

  getAllNodes(lngs: string) {
      var nodeList = this.nodes.getNodeList();
      var result: {
        [nodeId: string]: any
      } = {};
      for (let n of nodeList) {
        //   if (n.module !== "node-red") {
              result[n.id] = this.i18n.getCatalog(n.id,lngs)||{};
        //   }
      };
      return result;
  }
}
