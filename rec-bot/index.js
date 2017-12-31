'use strict';

// Electron
const ElectronHelper = require('./electron.js');

// Load configuration
const config = require('./config.json');
const packjson = require('./package.json');

// Logger
const bunyan = require('bunyan');

// Command Processing
const Commander = require('./commandProcess.js');

// Testing Configuration
const TestConfig = require('./testingConfiguration.js');

// Audio Transcoding
const transcoder = require('./transcoder.js');

// Audio Transcribing
const Transcriber = require('./transcriber.js');

// SDK logger
var sdkLogger = bunyan.createLogger({
    name: 'sdk',
    stream: process.stdout,
    level: config.sdkLogLevel
});

// Application logger
var logger = bunyan.createLogger({
    name: 'app',
    stream: process.stdout,
    level: 'info'
});

// Setup Electron
let debug = /--debug/.test(process.argv[2]);
var electronHelper = new ElectronHelper(logger, debug);

// Node utils
var util = require('util');
var assert = require('assert');

// Circuit SDK
logger.info('[TESTER]: get Circuit instance');
var Circuit = require('circuit-sdk');

logger.info('[TESTER]: Circuit set bunyan logger');
Circuit.setLogger(sdkLogger);

// Instantiate Circuit client
var client = new Circuit.Client({
    client_id: config.bot.client_id,
    client_secret: config.bot.client_secret,
    domain: config.bot.domain,
    scope: 'ALL'
});

// String similarity
var Similarity = require('./similarity.js');

// Utils
var RecUtils = require('./utils.js');

var Robot = function () {
    var self = this;
    var conversation = null;
    var commander = new Commander(logger);
    var testConfig = new TestConfig(logger);
    var recUtils = new RecUtils(logger);
    var similarity = new Similarity(logger);
    var transcriber;
    var user = {};
    var lastItemId;
    var testInterval;
    var currentBridge;

    //*********************************************************************
    //* initBot
    //*********************************************************************
    this.initBot = function () {
        logger.info(`[TESTER]: initialize testing bot`);
        return new Promise(function (resolve, reject) {
            transcriber = new Transcriber(logger, self.onTranscriptionReady);
            electronHelper.setIPCMainOn("recordingReady", robot.onRecordingReady);
            resolve();
        });
    };

    //*********************************************************************
    //* logonBot
    //*********************************************************************
    this.logonBot = function () {
        return new Promise(function(resolve, reject) {
            var retry;
            self.addEventListeners(client);
            var logon = function () {
                client.logon().then(logonUser => {
                    logger.info(`[TESTER]: Client created and logged as ${logonUser.userId}`);
                    user = logonUser;
                    clearInterval(retry);
                    setTimeout(resolve, 5000);
                }).catch(error => {
                    logger.error(`[TESTER]: Error logging Bot. Error: ${error}`);
                });
            }
            logger.info(`[TESTER]: Create bot instance with id: ${config.bot.client_id}`);
            retry = setInterval(logon, 2000);
        });
    };

    //*********************************************************************
    //* addEventListeners
    //*********************************************************************
    this.addEventListeners = function (client) {
        logger.info(`[TESTER]: addEventListeners`);
        Circuit.supportedEvents.forEach(function(e) {
            client.addEventListener(e, self.processEvent)
        });
    };

    //*********************************************************************
    //* logEvent -- helper
    //*********************************************************************
    this.logEvent = function (evt) {
        logger.info(`[TESTER]: ${evt.type} event received`);
        logger.debug(`[TESTER]:`, util.inspect(evt, { showHidden: true, depth: null }));
    };

    //*********************************************************************
    //* getConversation
    //*********************************************************************
    this.getConversation = function () {
        return new Promise(function (resolve, reject) {
            if (config.convId) {
                client.getConversationById(config.convId)
                    .then(conv => {
                        logger.info(`[TESTER]: checkIfConversationExists`);
                        if (conv) {
                            logger.info(`[TESTER]: conversation ${conv.convId} exists`);
                            resolve(conv);
                        } else {
                            logger.info(`[TESTER]: conversation with id ${conv.convId} does not exist`);
                            reject(`conversation with id ${conv.convId} does not exist`);
                        }
                    });
            } else {
                client.getDirectConversationWithUser(config.botOwnerEmail)
                    .then(conv => {
                        logger.info(`[TESTER]: checkIfConversationExists`);
                        if (conv) {
                            logger.info(`[TESTER]: conversation ${conv.convId} exists`);
                            resolve(conv);
                        } else {
                            logger.info(`[TESTER]: conversation does not exist, create new conversation`);
                            return client.createDirectConversation(config.botOwnerEmail);
                        }
                    });
            }
        });
    };

    //*********************************************************************
    //* say Hi
    //*********************************************************************
    this.sayHi = function (evt) {
        return new Promise(function (resolve, reject) {
            logger.info(`[TESTER]: say hi`);
            self.getConversation()
                .then(conv => {
                    logger.info(`[TESTER]: send conversation item`);
                    conversation = conv;
                    resolve();
                    return self.buildConversationItem(null, `Hi from ${config.bot.nick_name}`,
                        `I am ready`).
                        then(item => client.addTextItem(conversation.convId, item));
                });
        });
    };

    //*********************************************************************
    //* buildConversationItem
    //*********************************************************************
    this.buildConversationItem = function (parentId, subject, content, attachments) {
        return new Promise(function (resolve, reject) {
            var attach = attachments && [attachments];
            var item = {
                parentId: parentId,
                subject: subject,
                content: content,
                contentType: Circuit.Constants.TextItemContentType.RICH,
                attachments: attach
            };
            resolve(item);
        });
    };

    //*********************************************************************
    //* terminate -- helper
    //*********************************************************************
    this.terminate = function (err) {
        var error = new Error(err);
        logger.error(`[TESTER]: bot failed ${error.message}`);
        logger.error(error.stack);
        process.exit(1);
    };

    //*********************************************************************
    //* processEvent
    //*********************************************************************
    this.processEvent = function (evt) {
        self.logEvent(evt);
        switch (evt.type) {
            case 'itemAdded':
                self.processItemAddedEvent(evt);
                break;
            case 'itemUpdated':
                self.processItemUpdatedEvent(evt);
                break;
            case 'callStatus':
                self.processCallStatusEvent(evt);
                break;
            default:
                logger.info(`[TESTER]: unhandled event ${evt.type}`);
                break;
        }
    };

    //*********************************************************************
    //* processItemAddedEvent
    //*********************************************************************
    this.processItemAddedEvent = function (evt) {
        if (evt.item.text && evt.item.creatorId !== user.userId) {
            logger.info(`[TESTER] Recieved itemAdded event with itemId [${evt.item.itemId}] and content [${evt.item.text.content}]`);
            self.processCommand(evt.item.convId, evt.item.parentItemId || evt.item.itemId, evt.item.text.content);
        }
    };

    //*********************************************************************
    //* processItemUpdatedEvent
    //*********************************************************************
    this.processItemUpdatedEvent = function (evt) {
        if (evt.item.text && evt.item.creatorId !== user.userId) {
            if (evt.item.text.content) {
                var lastPart = evt.item.text.content.split('<hr/>').pop();
                logger.info(`[TESTER] Recieved itemUpdated event with: ${lastPart}`);
                self.processCommand(evt.item.parentItemId || evt.item.itemId, lastPart);
            }
        }
    };

    //*********************************************************************
    //* processCallStatusEvent
    //*********************************************************************
    this.processCallStatusEvent = function (evt) {
        logger.info(`[TESTER]: Received callStatus event with call state ${evt.call.state}`);
    };

    //*********************************************************************
    //* isItForMe?
    //*********************************************************************
    this.isItForMe = function (command) {
        return (command.indexOf('mention') !== -1 && command.indexOf(user.displayName) !== -1);
    };

    //*********************************************************************
    //* processCommand
    //*********************************************************************
    this.processCommand = function (convId, itemId, command) {
        logger.info(`[TESTER] Processing command: [${command}]`);
        if (self.isItForMe(command)) {
            var withoutName = command.substr(command.indexOf('</span> ') + 8);
            logger.info(`[TESTER] Command is for me. Processing [${withoutName}]`);
            commander.processCommand(withoutName, function (reply, params) {
                logger.info(`[TESTER] Interpreting command to ${reply} with parms ${JSON.stringify(params)}`);
                switch (reply) {
                    case 'status':
                        self.reportStatus(convId, itemId);
                        break;
                    case 'version':
                        self.reportVersion(convId, itemId);
                        break;
                    case 'showHelp':
                        self.showHelp(convId, itemId);
                        break;
                    case 'dial':
                        self.dial(convId, itemId, params);
                        break;
                    case 'startConfTest':
                        self.startConfTest(convId, itemId);
                        break;
                    case 'stopConfTest':
                        self.stopConfTest(convId, itemId);
                        break;
                    case 'setConfConf':
                        self.setTesterConfiguration(convId, itemId, params);
                        break;
                    case 'showConfConf':
                        self.showTesterConfiguration(convId, itemId);
                        break;
                    case 'shutdown':
                        self.shutdown();
                        break;
                    default:
                        logger.info(`[TESTER] I do not understand [${withoutName}]`);
                        self.buildConversationItem(itemId, null,
                            `I do not understand <b>[${withoutName}]</b>`).
                            then(item => client.addTextItem(convId || conversation.convId, item));
                        break;
                }
            });
        } else {
            logger.info(`[TESTER] Ignoring command: it is not for me`);
        }
    };

    //*********************************************************************
    //* reportStatus
    //*********************************************************************
    this.reportStatus = function (convId, itemId) {
        self.buildConversationItem(itemId, null,
            `Status <b>On</b>`).
            then(item => client.addTextItem(convId || conversation.convId, item));
    };

    //*********************************************************************
    //* reportVersion
    //*********************************************************************
    this.reportVersion = function (convId, itemId) {
        self.buildConversationItem(itemId, null,
            `Version: <b>${packjson.version}</b>`).
            then(item => client.addTextItem(convId || conversation.convId, item));
    };

    //*********************************************************************
    //* showHelp
    //*********************************************************************
    this.showHelp = function (convId, itemId) {
        logger.info(`[TESTER] Displaying help...`);
        commander.buildHelp().then(help => self.buildConversationItem(itemId, 'HELP', help)
            .then(item => client.addTextItem(convId || conversation.convId, item)));
    };

    //*********************************************************************
    //* dial phone number
    //*********************************************************************
    this.dial = function (convId, itemId, params) {
        if (!params || !params.length) {
            logger.error(`[TESTER] No number to dial`);
            self.buildConversationItem(itemId, `ERROR`, "Unable to dial. Number missing")
            .then(item => client.addTextItem(convId || conversation.convId, item));
        } else {
            logger.info(`[TESTER] Sending dial message to renderer`);
            currentBridge = {
                bridgeNumber: params[0],
                locale: recUtils.normalizeLocale(params.length > 2 ? params[2] : 'EN_US')
            }
            if (params.length > 1) {
                currentBridge.pin = params[1];
            }
            self.dialBridge(convId, itemId, currentBridge);
        }
    }

    //*********************************************************************
    //* dial a conference bridge
    //*********************************************************************
    this.dialBridge = function(convId, itemId, bridge) {
        logger.info(`[TESTER] Dial Bridge with number ${bridge.bridgeNumber} and locale ${bridge.locale}`);
        logger.info(`[TESTER] Keep Testing after this? ${testConfig.keepTesting()}`);
        electronHelper.send('dialBridge', bridge);
        self.buildConversationItem(itemId, `Dialing Bridge`, `Dialing ${bridge.bridgeNumber}` + ` ${bridge.pin ? bridge.pin : ''}` + ` with locale ${bridge.locale}`)
        .then(item => client.addTextItem(convId || conversation.convId, item));
        lastItemId = itemId;
        currentBridge = bridge;
    }

    //*********************************************************************
    //* terminate bot
    //*********************************************************************
    this.shutdown = function (reason) {
        logger.warn(`[TESTER] Shutting down. Reason: ${reason}`);
        client.logout();
        throw new Error('Terminated by user');
    }

    //*********************************************************************
    //* returns last conversation item id
    //*********************************************************************
    this.getLastItemId = function () {
        return lastItemId;
    }

    //*********************************************************************
    //* returns conversation id
    //*********************************************************************
    this.getConvId = function () {
        return conversation.convId;
    }

    //*********************************************************************
    //* Set the test parameters
    //*********************************************************************
    this.setTesterConfiguration = function(convId, itemId, params) {
        var err;
        if (!params || params.length === 0) {
            err = 'Parameters are not provided. Use help';
            self.sendErrorItem(err => self.sendErrorItem(convId, itemId, err));
        } else if (params.length === 3) {
            var config = {
                mode: params[0],
                times: params[1],
                timeBetweenTests: params[2]
            };
            testConfig.setConfig(config).then(function() {
                self.showTesterConfiguration(convId, itemId)
            }).catch(err => self.sendErrorItem(convId, itemId, err));
        } else if (params.length === 2) {
            testConfig.setConfigurationMode(params[0]).then(testConfig.setConfigurationTimes(params[1]).
            then(function() {
                self.showTesterConfiguration(convId, itemId)})).catch(err => self.sendErrorItem(convId, itemId, err));
        } else {
            testConfing.setConfigurationMode(params[0]).then(function () {
                self.showTesterConfiguration(convId, itemId)}).catch(err => self.sendErrorItem(convId, itemId, err));
        }
    }

    //*********************************************************************
    //* Show the test parameters
    //*********************************************************************
    this.showTesterConfiguration = function(convId, itemId) {
        testConfig.getConfiguration().then(config => self.buildConversationItem(itemId,
        'Testing Configuration', `Mode: ${config.mode}\nTimes: ${config.times} \nTime Between Tests(ms): ${config.timeBetweenTests}`)).
        then(item => client.addTextItem(convId, item));
    }

    //*********************************************************************
    //* Start conference bridge testing
    //*********************************************************************
    this.startConfTest = function(convId, itemId) {
        function test() {
            testConfig.getNextBridge()
            .then(bridge => self.dialBridge(convId, itemId, bridge))
            .catch(err => function(err) {
                self.sendErrorItem(convId, itemId, err);
            });
            if (!testInterval && testConfig.keepTesting()) {
                testInterval = setInterval(test, testConfig.getConfigurationTimeBetweenTests());
            }
            if (testInterval && !testConfig.keepTesting()) {
                clearInterval(testInterval);
                testInterval = undefined;
            }
        }
        client.changeConversationPin(convId)
        .then(self.getConferenceBridges)
        .then(self.setConferenceBridgesForTesting)
        .then(test)
        .catch(err => self.sendErrorItem(convId, itemId, err));
    }

    //*********************************************************************
    //* Get conference bridges
    //*********************************************************************
    this.getConferenceBridges = function(confDetails) {
        logger.info(`[TESTER] Get Conference Bridges`);
        return new Promise(function (resolve, reject) {
            var conferenceBridges = [];
            var pin = confDetails.pin;
            logger.info(`[TESTER] Conference Details: `);
            logger.info(`[TESTER] Pin: ${pin}`);
            if (confDetails.bridgeNumbers.length === 0) {
                resolve([]);
            }
            confDetails.bridgeNumbers.forEach(function (bridgeNumber, i) {
                logger.info(`[TESTER] Bridge Number: ${bridgeNumber.bridgeNumber}`);
                logger.info(`[TESTER] Locale: ${bridgeNumber.locale}`);
                conferenceBridges.push({
                    bridgeNumber: bridgeNumber.bridgeNumber,
                    locale: recUtils.normalizeLocale(bridgeNumber.locale),
                    pin: pin+'#'
                });
            });
            resolve(conferenceBridges);
        });
    }

    //*********************************************************************
    //* Set conference bridges for testing
    //*********************************************************************
    this.setConferenceBridgesForTesting = function(conferenceBridges) {
        logger.info(`[TESTER] Set Conference Bridges for Testing`);
        return new Promise(function(resolve, reject) {
            conferenceBridges.forEach(function(confBridge) {
                testConfig.addBridge({
                    bridgeNumber: confBridge.bridgeNumber,
                    locale: confBridge.locale,
                    pin: confBridge.pin
                });
            });
            resolve();
        });
    }

    //*********************************************************************
    //* Stop conference bridge testing
    //*********************************************************************
    this.stopConfTest = function(convId, itemId) {
        clearInterval(testInterval);
        testInterval = undefined;
        self.buildConversationItem(itemId, 'TESTING', 'Test will stop after current test is finished')
        .then(item => client.addTextItem(convId, item));
    }

    //*********************************************************************
    //* Show an error as a conversation item
    //*********************************************************************
    this.sendErrorItem = function (convId, itemId, err) {
        self.buildConversationItem(itemId, 'ERROR', err).then(item => client.addTextItem(convId, item));
    }

    //*********************************************************************
    //* onRecordingReady
    //*********************************************************************
    this.onRecordingReady = function () {
        logger.info(`[TESTER] Recording is ready for transcoding`);
        // Transcode file for google speech transcription
        transcoder.transcode(config.ogg_file, config.raw_file).then(function() {
            logger.info(`[TESTER] Transcoding complete`);
            transcriber.transcribe({locale: currentBridge.locale, file: config.raw_file});
        }).catch(e => logger.error(e)); 
    }

    //*********************************************************************
    //* onTranscriptionReady
    //*********************************************************************
    this.onTranscriptionReady = function (message, err) {
        if (!message) {
            self.sendErrorItem(convId, lastItemId, err);
            return;
        }
        logger.info(`[TESTER]: Transcription Available. ${message}`);
        similarity.getSimilarityByLocale(message, currentBridge.locale).then(simil =>
        robot.buildConversationItem(robot.getLastItemId(), `Transcription Available: similarity= ${simil.toFixed(4) * 100}%`, `${message}`)
        .then(item => client.addTextItem(robot.getConvId(), item)));
    }
}

//*********************************************************************
//* main
//*********************************************************************
var robot = new Robot();
robot.initBot()
    .then(robot.logonBot)
    .then(robot.sayHi)
    .catch(robot.terminate);

