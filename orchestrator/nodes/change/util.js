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

function normalisePropertyExpression(str) {
    // This must be kept in sync with validatePropertyExpression
    // in editor/js/ui/utils.js

    let length = str.length;
    if (length === 0) {
        throw new Error("Invalid property expression: zero-length");
    }
    let parts = [];
    let start = 0;
    let inString = false;
    let inBox = false;
    let quoteChar;
    let v;
    for (let i = 0; i < length; i++) {
        let c = str[i];
        if (!inString) {
            if (c === "'" || c === '"') {
                if (i != start) {
                    throw new Error("Invalid property expression: unexpected " + c + " at position " + i);
                }
                inString = true;
                quoteChar = c;
                start = i + 1;
            } else if (c === '.') {
                if (i === 0) {
                    throw new Error("Invalid property expression: unexpected . at position 0");
                }
                if (start != i) {
                    v = str.substring(start, i);
                    if (/^\d+$/.test(v)) {
                        parts.push(parseInt(v));
                    } else {
                        parts.push(v);
                    }
                }
                if (i === length - 1) {
                    throw new Error("Invalid property expression: unterminated expression");
                }
                // Next char is first char of an identifier: a-z 0-9 $ _
                if (!/[a-z0-9\$\_]/i.test(str[i + 1])) {
                    throw new Error("Invalid property expression: unexpected " + str[i + 1] + " at position " + (i + 1));
                }
                start = i + 1;
            } else if (c === '[') {
                if (i === 0) {
                    throw new Error("Invalid property expression: unexpected " + c + " at position " + i);
                }
                if (start != i) {
                    parts.push(str.substring(start, i));
                }
                if (i === length - 1) {
                    throw new Error("Invalid property expression: unterminated expression");
                }
                // Next char is either a quote or a number
                if (!/["'\d]/.test(str[i + 1])) {
                    throw new Error("Invalid property expression: unexpected " + str[i + 1] + " at position " + (i + 1));
                }
                start = i + 1;
                inBox = true;
            } else if (c === ']') {
                if (!inBox) {
                    throw new Error("Invalid property expression: unexpected " + c + " at position " + i);
                }
                if (start != i) {
                    v = str.substring(start, i);
                    if (/^\d+$/.test(v)) {
                        parts.push(parseInt(v));
                    } else {
                        throw new Error("Invalid property expression: unexpected array expression at position " + start);
                    }
                }
                start = i + 1;
                inBox = false;
            } else if (c === ' ') {
                throw new Error("Invalid property expression: unexpected ' ' at position " + i);
            }
        } else {
            if (c === quoteChar) {
                if (i - start === 0) {
                    throw new Error("Invalid property expression: zero-length string at position " + start);
                }
                parts.push(str.substring(start, i));
                // If inBox, next char must be a ]. Otherwise it may be [ or .
                if (inBox && !/\]/.test(str[i + 1])) {
                    throw new Error("Invalid property expression: unexpected array expression at position " + start);
                } else if (!inBox && i + 1 !== length && !/[\[\.]/.test(str[i + 1])) {
                    throw new Error("Invalid property expression: unexpected " + str[i + 1] + " expression at position " + (i + 1));
                }
                start = i + 1;
                inString = false;
            }
        }

    }
    if (inBox || inString) {
        throw new Error("Invalid property expression: unterminated expression");
    }
    if (start < length) {
        parts.push(str.substring(start));
    }
    return parts;
}

function getMessageProperty(msg, expr) {
    let result = null;
    if (expr.indexOf('msg.') === 0) {
        expr = expr.substring(4);
    }
    let msgPropParts = normalisePropertyExpression(expr);
    msgPropParts.reduce(function (obj, key) {
        result = (typeof obj[key] !== "undefined" ? obj[key] : undefined);
        return result;
    }, msg);
    return result;
}

function setMessageProperty(msg, prop, value, createMissing) {
    if (typeof createMissing === 'undefined') {
        createMissing = (typeof value !== 'undefined');
    }
    if (prop.indexOf('msg.') === 0) {
        prop = prop.substring(4);
    }
    let msgPropParts = normalisePropertyExpression(prop);
    let length = msgPropParts.length;
    let obj = msg;
    let key;
    for (let i = 0; i < length - 1; i++) {
        key = msgPropParts[i];
        if (typeof key === 'string' || (typeof key === 'number' && !Array.isArray(obj))) {
            if (obj.hasOwnProperty(key)) {
                obj = obj[key];
            } else if (createMissing) {
                if (typeof msgPropParts[i + 1] === 'string') {
                    obj[key] = {};
                } else {
                    obj[key] = [];
                }
                obj = obj[key];
            } else {
                return null;
            }
        } else if (typeof key === 'number') {
            // obj is an array
            if (obj[key] === undefined) {
                if (createMissing) {
                    if (typeof msgPropParts[i + 1] === 'string') {
                        obj[key] = {};
                    } else {
                        obj[key] = [];
                    }
                    obj = obj[key];
                } else {
                    return null
                }
            } else {
                obj = obj[key];
            }
        }
    }
    key = msgPropParts[length - 1];
    if (typeof value === "undefined") {
        if (typeof key === 'number' && Array.isArray(obj)) {
            obj.splice(key, 1);
        } else {
            delete obj[key]
        }
    } else {
        obj[key] = value;
    }
}

module.exports = {
    getMessageProperty: getMessageProperty,
    setMessageProperty: setMessageProperty,
};