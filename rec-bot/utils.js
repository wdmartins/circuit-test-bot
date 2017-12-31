'use strict';

const SUPPORT_LOCALES = {
    EN_US: 'en-US',
    DE_DE: 'de-DE'
}

var Utils = function(logger) {
    this.normalizeLocale = function (locale) {
        if (!SUPPORT_LOCALES[locale]) {
            logger.error(`[UTILS] ${locale} is an invalid or not supported locale. Returning en-US`);
            return 'en-US';
        }
        return SUPPORT_LOCALES[locale];
    }
}

module.exports = Utils;
