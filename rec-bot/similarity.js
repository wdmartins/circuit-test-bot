'use strict';

// String similarity
var similarity = require('similarity');

const MASTER_STRINGS_DEF = {
    'en-US': 'welcome to Circuit please enter the conference pin and push pound to confirm\n connecting to the conference'
}

var StringSimilarity = function(logger) {
    var masterString = MASTER_STRINGS_DEF['en-US'];

    this.getSimilarity = function(actual) {
        return similarity(masterString, actual);
    }

    this.getSimilarityByLocale = function(actual, locale) {
        return new Promise(function (resolve, reject) {
            if (!MASTER_STRINGS_DEF[locale]) {
                reject(`${locale} is an invalid or not supported locale`);
                return;
            }
            resolve(similarity(MASTER_STRINGS_DEF[locale], actual));
        });
    }

    this.setMasterString = function(master) {
        masterString = master;
    }

    this.setMasterStringByLocale = function(locale) {
        return new Promise(function (resolve, reject) {
            if (!MASTER_STRINGS_DEF[locale]) {
                reject(`${locale} is an invalid or not supported locale`);
                return;
            }
            msaterString = MASTER_STRINGS_DEF[locale];
            resolve(masterString);
        });
    }
}

module.exports = StringSimilarity;
