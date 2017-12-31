'use strict';

// Imports the Google Cloud client library
const speech = require('@google-cloud/speech');
const fs = require('fs');
var chokidar = require('chokidar');
var FileAPI = require('file-api');
var File = FileAPI.File;
const path = require('path');

// Load configuration
var config = require('./config.json');

// Creates a client
const client = new speech.SpeechClient({
    keyFilename: config.keyFilename
});

// Logger
var bunyan = require('bunyan');

// Application logger
var logger = bunyan.createLogger({
    name: 'app',
    stream: process.stdout,
    level: 'info'
});

// IPC Communication
var ipc=require('node-ipc');
 
var Transcriber = function () {
    var self = this;
    var watcher;

    //***************************************
    // Initialize transcriber
    //***************************************
    this.init = function() {
        logger.info(`[APP]: initialize transcriber`);
        return new Promise(function(resolve, reject) {
            initIpcClient();
            resolve();
        });
    };

    //***************************************
    // Process new file
    //***************************************
    this.processNewFile = function(filename, locale) {
        logger.info(`[APP]: process new file with locale ${locale}`);
        return new Promise(function (resolve, reject) {

            // Reads a local audio file and converts it to base64
            const file = fs.readFileSync(filename);
            const audioBytes = file.toString('base64');

            // The audio file's encoding, sample rate in hertz, and BCP-47 language code
            const audio = {
                content: audioBytes,
            };
            const config = {
                encoding: 'LINEAR16',
                sampleRateHertz: 16000,
                languageCode: locale,
            };
            const request = {
                audio: audio,
                config: config,
            };

            // Detects speech in the audio file
            client.recognize(request)
            .then(data => {
                const response = data[0];
                const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n');
                logger.info(`Transcription: ${transcription}`);
                resolve(transcription);
            })
            .catch(err => {
                logger.error('ERROR:', err);
                reject(err);
            });
        });
    };

    //***************************************
    // Wait
    //***************************************
    this.wait = function() {
        function stillWaiting() {
            logger.info(`[APP]: Still waiting...`);
        }
        logger.info(`[APP]: just wait`);
        return new Promise(function (resolve, reject) {
            //setInterval(stillWaiting, 5000);
        });
    };

    //***************************************
    // Terminate
    //***************************************
    this.terminate = function() {
        logger.warn(`[APP] Terminated.`);
    };
}

function initIpcClient() {
    ipc.config.id   = 'trancriber';
    ipc.config.retry= 1500;
    ipc.config.silent = true;
    
    ipc.connectTo(
        'circuittestbot',
        function(){
            ipc.of.circuittestbot.on(
                'connect',
                function(){
                    ipc.log('## connected to circuittestbot ##'.rainbow, ipc.config.delay);
                    ipc.of.circuittestbot.emit(
                        'transcriber-ready'
                    )
                }
            );
            ipc.of.circuittestbot.on(
                'disconnect',
                function(){
                    ipc.log('disconnected from circuittestbot'.notice);
                }
            );
            ipc.of.circuittestbot.on(
                'audio-file-ready',
                function(data){
                    ipc.log('got a message from circuittestbot : '.debug, data);
                    var text= transcriber.processNewFile(data.file, data.locale).then(text => {
                        logger.info(`Transcribed text: ${text}`);
                        ipc.of.circuittestbot.emit(
                            'transcription-available',
                            text
                        )
                    });
                }
            );
        }
    );
}
//*********************************************************************
//* main
//*********************************************************************
var transcriber = new Transcriber();
transcriber.init()
    .then(transcriber.initFileSystem)
    .then(transcriber.watchFolder)
    .then(transcriber.wait)
    .catch(transcriber.terminate);
