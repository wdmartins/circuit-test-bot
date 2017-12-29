// Limitations: The bot can only be in a single call at a time. Multiple
// client crendentials app would be needed to be in multiple calls at
// the same time.

const config = require('electron').remote.require('./config.json');
var fs = require('fs');
var util = require('util');
var recordedBlobs = [];
var mediaRecorder;
var call;
var recordingOptions = {
    mimeType: 'audio/webm;codecs="opus"',
    audioBitsPerSecond: 16000
};
var audioElement;
var bridge;
// Create circuit SDK client instance
const client = new Circuit.Client(config.bot);

const { ipcRenderer } = require('electron');
const FIRST_PROMPT_RECORDING_TIME = 8000 // 8 seconds
const SECOND_PROMPT_RECORDING_TIME = 5000 // 5 seconds (includes sending the pin)

ipcRenderer.on("dialBridge", function(sender, confBridge) {
    bridge = confBridge;
    audioElement = document.querySelector('audio');
    if (!MediaRecorder.isTypeSupported(recordingOptions.mimeType)) {
        console.log(`[RENDERER] Error: mimeType ${recordingOptions.mimeType} is not supported`);
    }
    recordedBlobs = [];
    client.dialNumber(bridge.bridgeNumber, null, {audio: true, video: false})
    .then(c => call = c)
    .catch(error => console.error(`[RENDERER] Error dialing number. Error: ${error}`));
})

function setupCall(call) {
    var remoteAudioStream = client.getRemoteStreams(call.callId).find(s => s.getAudioTracks().length > 0);
    var remoteMediaStream = new MediaStream(remoteAudioStream.getAudioTracks());

    mediaRecorder = new MediaRecorder(remoteMediaStream, recordingOptions);
    mediaRecorder.onstop = handleStop;
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onerror = handleOnError;
    mediaRecorder.onstart = handleOnStart;

    console.log('[RENDERER] Start monitoring and recording');

    // For audio monitoring
    audioElement.srcObject = remoteAudioStream;

}

function handleOnStart() {
    console.log(`[RENDERER] Media Recording Started`);
}

function handleOnError(error) {
    console.error(`[RENDERER] MediaRecorder Error: ${error}`);
}
function handleStop() {
    console.log(`[RENDERER] Recording stop. BitsPerSecond: ${mediaRecorder.audioBitsPerSecond}`);
    var fileReader = new FileReader();
    fileReader.onload = function() {
      fs.writeFileSync(config.ogg_file, Buffer.from(new Uint8Array(this.result)));
    };
    fileReader.readAsArrayBuffer(new Blob(recordedBlobs, {type:'audio/webm;codecs="opus"'}));
    setTimeout(ipcRenderer.send('recordingReady', bridge), 3000);
    mediaRecorder = undefined;
}

function handleDataAvailable(event) {
    console.log(`[RENDERER] Recording data available`);
    if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
      }
}

function startRecording(stream) {
    console.log(`[RENDERER] Start Recording`);
    mediaRecorder.start(1000);
}

function endCall() {
    client.endCall(call.callId);
}

function stopRecording() {
    console.log(`[RENDERER] Stoping recorder. BitsPerSecond: ${mediaRecorder.audioBitsPerSecond}`);
    mediaRecorder && mediaRecorder.stop();
}

function processEvent(evt) {
    console.log(`[RENDERER] Process event` + util.inspect(evt, { showHidden: true, depth: null }));
    switch(evt.type) {
        case 'callStatus':
            // evt.reason === 'sdpConnected' should be enough here but sometimes I missed to record a second or two at
            // the beginning of the announcement
            if (evt.reason === 'callStateChanged' && (evt.call.state === 'Delivered' || evt.call.state === 'Active') 
                && !mediaRecorder) {
                setupCall(call);
                startRecording();
                setTimeout(sendPin, FIRST_PROMPT_RECORDING_TIME);
            } else {
                console.log(`[RENDERER] - ${evt.reason} - ${evt.call.state} - ${mediaRecorder}`);
            }
            break;
        case 'callEnded':
            stopRecording();
            break;
        default: 
            console.log(`[RENDERER] Ignoring evet ${evt.type}`);
            break;
    }
}

function sendPin() {
    if (bridge.pin) {
        console.log(`[RENDERER] Sending pin ${bridge.pin}`);
        client.sendDigits(call.callId, bridge.pin);
        setTimeout(endCall, SECOND_PROMPT_RECORDING_TIME);
    } else {
        endCall();
    }
}

// Program (async IIFE function)
(async () => {
    try {
        // Logon
        const user = await client.logon();
        console.log(`[RENDERER] Logged on as bot: ${user.emailAddress}`);
        Circuit.supportedEvents.forEach(function(e) {
            client.addEventListener(e, processEvent)
        });
    } catch (ex) {
        console.error(ex);
    }
})();
