Circuit rec bot

Prerrequisites
- FFMPEG is needed to transcode audio files. Node module fluent-ffmpeg is used and requires ffmpeg >= 0.9 to work.
  If the FFMPEG_PATH environment variable is set, fluent-ffmpeg will use it as the full path to the ffmpeg executable. Otherwise, it will attempt to call ffmpeg directly (so it should be in your PATH).

- Google Cloud Speech API is used to obtain audio transcriptions. Refer to https://cloud.google.com/speech/docs/quickstart
  to setup an account, billing and get your application credentials

- The Cloud Speech API Client Libraries use GRPC. When running this application behind a proxy the environment variable http_proxy has to be set accordingly


