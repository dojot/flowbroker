const configLanguage = require("./config").language;
const parser = require('./accept-language-parser');

class Locale {
    /**
     * Get the language based on request (accept-language) of client
     * Parse the accept-language, and based on priority of each language, choose a available language,.
     *
     * @param requestFromClient The request of the client
     * @returns {string}
     */
    static getSlugLanguage(requestFromClient) {
        const {supportedLanguages, mapSimilarLanguage} = configLanguage;
        const languagePick = parser.pick(supportedLanguages, requestFromClient.headers["accept-language"]);
        return supportedLanguages.includes(languagePick) ?
            languagePick : (
                mapSimilarLanguage[languagePick] ?
                    mapSimilarLanguage[languagePick] : mapSimilarLanguage.default);
    }

    /**
     * Get the default language from config
     * @returns {string}
     */
    static getSlugDefaultLanguage() {
        const {mapSimilarLanguage} = configLanguage;
        return mapSimilarLanguage.default;
    }
}

module.exports = Locale;
