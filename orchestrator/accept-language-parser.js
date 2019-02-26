/* jshint node: true */
/* jshint esversion: 6 */
"use strict";

let regex = /((([a-zA-Z]+(-[a-zA-Z0-9]+){0,2})|\*)(;q=[0-1](\.[0-9]+)?)?)*/g;

let isString = function (s) {
    return typeof (s) === 'string';
};

function parse(al) {
    let strings = (al || "").match(regex);
    return strings.map(function (m) {
        if (!m) {
            return;
        }

        let bits = m.split(';');
        let ietf = bits[0].split('-');
        let hasScript = ietf.length === 3;

        return {
            code: ietf[0],
            script: hasScript ? ietf[1] : null,
            region: hasScript ? ietf[2] : ietf[1],
            quality: bits[1] ? parseFloat(bits[1].split('=')[1]) : 1.0
        };
    }).filter(function (r) {
        return r;
    }).sort(function (a, b) {
        return b.quality - a.quality;
    });
}

function mapSupported(supportedLanguages) {
    let supported = supportedLanguages.map(function (support) {
        let bits = support.split('-');
        let hasScript = bits.length === 3;

        return {
            code: bits[0],
            script: hasScript ? bits[1] : null,
            region: hasScript ? bits[2] : bits[1]
        };
    });
    return supported;
}

function pick(supportedLanguages, acceptLanguage, options) {
    options = options || {};

    if (!supportedLanguages || !supportedLanguages.length || !acceptLanguage) {
        return null;
    }

    if (isString(acceptLanguage)) {
        acceptLanguage = parse(acceptLanguage);
    }
    let supported = mapSupported(supportedLanguages);

    for (let i = 0; i < acceptLanguage.length; i++) {
        let lang = acceptLanguage[i];
        let langCode = lang.code.toLowerCase();
        let langRegion = lang.region ? lang.region.toLowerCase() : lang.region;
        let langScript = lang.script ? lang.script.toLowerCase() : lang.script;
        for (let j = 0; j < supported.length; j++) {
            let supportedCode = supported[j].code.toLowerCase();
            let supportedScript = supported[j].script ? supported[j].script.toLowerCase() : supported[j].script;
            let supportedRegion = supported[j].region ? supported[j].region.toLowerCase() : supported[j].region;
            if (langCode === supportedCode &&
                (options.loose || !langScript || langScript === supportedScript) &&
                (options.loose || !langRegion || langRegion === supportedRegion)) {
                return supportedLanguages[j];
            }
        }
    }

    return null;
}

module.exports.parse = parse;
module.exports.pick = pick;
