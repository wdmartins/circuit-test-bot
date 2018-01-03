'use strict';

// IPC communication with transcriber process
const ipc = require('node-ipc');

var Transcriber = function (log, onTranscriptionReadyCB) {
    var logger = log;
    var onTranscriptionReady = onTranscriptionReadyCB;
    var self = this;
    var socket;

    this.init = function() {
        if (!log) {
            console.error(`Logger must be provided`);
            return;
        }
        if (!onTranscriptionReady) {
            logger.error(`TranscriptionReady CB must be provided`);
        }
        self.initIpcServer(onTranscriptionReady);
        logger.info(`[TRANSCRIBER] Initialized`);
    }

    this.transcribe = function(audioFileData) {
        logger.info(`[TRANSCRIBER] Start transcription`);
        if (!audioFileData) {
            logger.error(`Audio File Data must be provided`);
            return;
        }
        if (!socket) {
            onTranscriptionReady(null, `ERROR: Transcriber process is not ready`);
            return;
        }
        ipc.server.emit(socket, 'audio-file-ready', {locale: audioFileData.locale, file: audioFileData.file});
    }

    this.initIpcServer = function (onTranscriptionReady) {
        ipc.config.id = 'circuittestbot';
        ipc.config.retry = 1500;
        ipc.config.silent = true;
        ipc.serve(function() {
            ipc.server.on('transcriber-ready', function(message,st) {
                logger.info(`[TRANSCRIBER] Transcriber is ready. ${message}`);
                socket = st;
            });
            ipc.server.on('transcription-available', function(message, st) {
                onTranscriptionReady(message)
            });
        });
        ipc.server.start();
    }

    self.init();
}

module.exports = Transcriber;