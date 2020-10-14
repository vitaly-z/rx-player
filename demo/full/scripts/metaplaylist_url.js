const preiodShifting = 0.15;

const MetaPlaylistDASHSmooth = {
  "type": "MPL",
  "version": "0.1",
  "dynamic": false,
  "contents": [
    {
      "url": "https://demo.unified-streaming.com/video/ateam/ateam.ism/ateam.mpd",
      "startTime": 0,
      "endTime": 101.47636666666666 + preiodShifting,
      "transport": "dash",
    },
    {
      "url": "https://demo.unified-streaming.com/video/ateam/ateam.ism/ateam.mpd",
      "startTime": 0 + 101.47636666666666 + preiodShifting,
      "endTime": 101.47636666666666 + 101.47636666666666 + (preiodShifting * 2),
      "transport": "dash",
    },
    {
      "url": "https://demo.unified-streaming.com/video/ateam/ateam.ism/ateam.mpd",
      "startTime": 0 + 101.47636666666666 + 101.47636666666666 + (preiodShifting * 2),
      "endTime": 101.47636666666666 + 101.47636666666666 + 101.47636666666666 + (preiodShifting * 3),
      "transport": "dash",
    },
  ],
};

const MetaPlaylistDASHSmoothBlob =
  new Blob([JSON.stringify(MetaPlaylistDASHSmooth)],
           {type : "application/json"});

export default URL.createObjectURL(MetaPlaylistDASHSmoothBlob);


