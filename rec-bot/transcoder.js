'use strict';

const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');  
const mime = require('mime');  

//*********************************************************************
//* Transcodes from ogg opus to pcm
//* Run the command below to perform a manual trancoding
//* /opt/ffmpeg/ffmpeg -acodec opus -i test.raw -f s16le -acodec pcm_s16le -ar 16000 output.raw
//*********************************************************************
var transcode = function(fileIn, fileOut) {
    return new Promise(function(resolve, reject) {
        if (!fileIn || !fileOut) {
            throw new Error('You must specify a path for both input and output files.');
        }
        if (!fs.existsSync(fileIn)) {
            throw new Error(`Input file must exist. Input file: ${fileIn}`);
        }
        if (mime.lookup(fileIn).indexOf('audio') > -1) {
            try {
                ffmpeg()
                    .input(fileIn)
                    .outputOptions([
                        '-f s16le',
                        '-acodec pcm_s16le',
                        '-vn',
                        '-ac 1',
                        '-ar 16k',
                        '-map_metadata -1'
                    ])
                    .save(fileOut)
                    .on('end', () => resolve(fileOut));
            } catch (e) {
                reject(e);
            }
        } else {
            throw new Error('File must have audio mime.');
        }   
    });
}
module.exports.transcode = transcode;