'use strict';
var DEFAULT_CONFIG = {
    mode: 'ENGLISH',  // ENGLISH bridge, ALL bridges
    times: 'ENDLESS', // 'ONCE', 'ENDLESS'
    timeBetweenTests: 60000, // Every minute
    bridges: []
}


var TestingConfiguration = function(log) {
    var self = this;
    var config = DEFAULT_CONFIG;
    var bridgeCount = 0;
    var logger = log;
    var testNumber = 0;

    function validateMode(mode) {
        if (!mode || (mode !== 'ENGLISH' && mode !== 'ALL')) {
            return `Invalid Configuration Mode ${mode}`;
        }
        return;
    }

    function validateTimes(times) {
        if (!times || (times !== 'ONCE' && times !== 'ENDLESS')) {
            return `Invalid Configuration Times ${times}`;
        }
        return;
    }

    function validateTimeBetweenTests(time) {
        if (!time) {
            return `Invalid Configuration timeBetweenTests ${time}`;
        }
        if (time < 60000) {
            return `TimeBetweenTests is too short ${time}`;
        }
    }

    function validateBridge(bridge) {
        //TODO: Verify it has number, pin and locale
        return;
    }

    this.setConfig = function (configuration) {
        return new Promise(function (resolve, reject) {
            if (!configuration) {
                reject("Invalid Configuration");
            }
            var err = validateMode(configuration.mode) ||
                validateTimes(configuration.times) ||
                validateTimeBetweenTests(configuration.timeBetweenTests);

            if (err) {
                reject(err);
                return;
            }
            config = configuration;
            resolve(config);
        });
    }

    this.setConfigurationMode = function (mode) {
        return new Promise(function (resolve, reject) {
            var err = validateMode(mode);
            if (err) {
                reject(err);
                return;
            }
            config.mode = mode;
            resolve(config)
        });
    }

    this.setConfigurationTimes = function (times) {
        return new Promise(function (resolve, reject) {
            var err = validateTimes(times);
            if (err) {
                reject(err);
                return;
            }
            config.times = times;
            resolve(config);
        });
    }

    this.setConfigurationTimeBetweenTests = function (timeBetweenTests) {
        return new Promise(function (resolve, reject) {
            var err = validateTimeBetweenTests(timeBetweenTests);
            if (err) {
                reject(err);
                return;
            }
            config.timeBetweenTests = timeBetweenTests;
            resolve(config);
        });
    }

    this.getConfiguration = function (){
        return new Promise(function (resolve, reject) {
            resolve(config);
        });
    }

    this.getConfigurationMode = function () {
        return config.mode;
    }

    this.getConfigurationTimes =  function () {
        return config.times;
    }

    this.getConfigurationTimeBetweenTests = function () {
        return config.timeBetweenTests;
    }

    this.addBridge = function (bridge) {
        return new Promise(function (resolve, reject) {
            var err = validateBridge();
            if (err) {
                reject(err);
                return;
            }
            config.bridges.push(bridge);
            resolve(config.bridges);
        });
    }

    this.getNextBridge = function() {
        return new Promise(function (resolve, reject) {
            if (!config.bridges || config.bridges.length === 0) {
                reject("There are no bridges configured");
                return;
            }
            if (bridgeCount >= config.bridges.length) {
                bridgeCount = 0;
            }
            resolve(config.bridges[bridgeCount]);
            bridgeCount++;
        });
    }

    this.keepTesting = function() {
        return config.times === `ENDLESS`;
    }

    this.getBridgeByLocale = function() {
        return new Promise(function (resolve, reject) {
            reject("getBridgeByLocale is not implemented yet");
        });
    }

    logger.info(`[CONFIG] Tester Configuration initialized`);
}

module.exports = TestingConfiguration;