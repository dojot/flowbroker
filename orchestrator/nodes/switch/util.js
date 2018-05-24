"use strict";
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

var jsonata = require("jsonata");

function normalisePropertyExpression(str) {
    // This must be kept in sync with validatePropertyExpression
    // in editor/js/ui/utils.js

    var length = str.length;
    if (length === 0) {
        throw new Error("Invalid property expression: zero-length");
    }
    var parts = [];
    var start = 0;
    var inString = false;
    var inBox = false;
    var quoteChar;
    var v;
    for (var i = 0; i < length; i++) {
        var c = str[i];
        if (!inString) {
            if (c === "'" || c === '"') {
                if (i !== start) {
                    throw new Error("Invalid property expression: unexpected " + c + " at position " + i);
                }
                inString = true;
                quoteChar = c;
                start = i + 1;
            } else if (c === '.') {
                if (i === 0) {
                    throw new Error("Invalid property expression: unexpected . at position 0");
                }
                if (start !== i) {
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
                if (start !== i) {
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
                if (start !== i) {
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
    var result = null;
    if (expr.indexOf('msg.') === 0) {
        expr = expr.substring(4);
    }
    var msgPropParts = normalisePropertyExpression(expr);
    msgPropParts.reduce(function (obj, key) {
        result = (typeof obj[key] !== "undefined" ? obj[key] : undefined);
        return result;
    }, msg);
    return result;
}

function evaluateNodeProperty(value, type, node, msg) {
    if (type === 'str') {
        return "" + value;
    } else if (type === 'num') {
        return Number(value);
    } else if (type === 'json') {
        return JSON.parse(value);
    } else if (type === 're') {
        return new RegExp(value);
    } else if (type === 'date') {
        return Date.now();
    } else if (type === 'bin') {
        var data = JSON.parse(value);
        return Buffer.from(data);
    } else if (type === 'msg' && msg) {
        return getMessageProperty(msg, value);
    } else if (type === 'flow' && node) {
        return node.context().flow.get(value);
    } else if (type === 'global' && node) {
        return node.context().global.get(value);
    } else if (type === 'bool') {
        return /^true$/i.test(value);
    } else if (type === 'jsonata') {
        var expr = prepareJSONataExpression(value, node);
        return evaluateJSONataExpression(expr, msg);
    }
    return value;
}

function prepareJSONataExpression(value, node) {
    var expr = jsonata(value);
    expr.assign('flowContext', function (val) {
        return node.context().flow.get(val);
    });
    expr.assign('globalContext', function (val) {
        return node.context().global.get(val);
    });
    expr._legacyMode = /(^|[^a-zA-Z0-9_'"])msg([^a-zA-Z0-9_'"]|$)/.test(value);
    return expr;
}

function evaluateJSONataExpression(expr, msg) {
    var context = msg;
    if (expr._legacyMode) {
        context = {msg: msg};
    }
    return expr.evaluate(context);
}


module.exports = {
    evaluateNodeProperty: evaluateNodeProperty,
};
