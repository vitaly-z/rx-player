import RxPlayer from "../../../src";

/**
 * Test every player at an initial, idle state.
 *
 * Breaking a test here will means with an high confidence that the API contract
 * is broken.
 */

describe("initial idle state", () => {
  describe("constructor", () => {
    it("should create a video element if no videoElement option is given", () => {
      const player = new RxPlayer();
      const videoElement = player.getVideoElement();
      expect(videoElement).not.toBeNull();
      expect(videoElement).not.toBeUndefined();
      player.dispose();
    });

    it("should use the video element given as videoElement", () => {
      const videoElement = document.createElement("VIDEO");
      document.body.appendChild(videoElement);
      const player = new RxPlayer({
        videoElement,
      });
      expect(videoElement instanceof HTMLMediaElement).toEqual(true);
      player.dispose();
    });
  });

  describe("static members", () => {
    describe("ErrorTypes", () => {
      it("should expose static ErrorTypes property", () => {
        expect(typeof RxPlayer.ErrorTypes).toEqual("object");
      });
    });

    describe("ErrorCodes", () => {
      it("should expose static ErrorCodes property", () => {
        expect(typeof RxPlayer.ErrorTypes).toEqual("object");
      });
    });
  });

  describe("initial state", () => {
    const player = new RxPlayer();

    afterAll(() => player.dispose());

    describe("getError", () => {
      it("should have no error by default", () => {
        expect(player.getError()).toEqual(null);
      });
    });

    describe("getManifest", () => {
      it("should return null in getManifest by default", () => {
        expect(player.getManifest()).toEqual(null);
      });
    });

    describe("getCurrentAdaptations", () => {
      it("should return null in getCurrentAdaptations by default", () => {
        expect(player.getCurrentAdaptations()).toEqual(null);
      });
    });

    describe("getCurrentRepresentations", () => {
      it("should return null in getCurrentRepresentations by default", () => {
        expect(player.getCurrentRepresentations()).toEqual(null);
      });
    });

    describe("getNativeTextTrack", () => {
      it("should return null in getNativeTextTrack by default", () => {
        expect(player.getNativeTextTrack()).toEqual(null);
      });
    });

    describe("getPlayerState", () => {
      it("should return \"STOPPED\" in getPlayerState by default", () => {
        expect(player.getPlayerState()).toEqual("STOPPED");
      });
    });

    describe("isLive", () => {
      it("should return false in isLive by default", () => {
        expect(player.isLive()).toEqual(false);
      });
    });

    describe("getUrl", () => {
      it("should return undefined in getUrl by default", () => {
        expect(player.getUrl()).toEqual(undefined);
      });
    });

    describe("getVideoDuration", () => {
      it("should return the video element initial duration in getVideoDuration by default", () => {

        // ! HAHA ! NaN is not === to NaN
        expect(player.getVideoDuration()).toEqual(
          player.getVideoElement().duration
        );
      });
    });

    describe("getVideoBufferGap", () => {
      it("should return Infinity in getVideoBufferGap by default", () => {
        expect(player.getVideoBufferGap()).toEqual(Infinity);
      });
    });

    describe("getVideoLoadedTime", () => {
      it("should return 0 in getVideoLoadedTime by default", () => {
        expect(player.getVideoLoadedTime()).toEqual(0);
      });
    });

    describe("getVideoPlayedTime", () => {
      it("should return 0 in getVideoPlayedTime by default", () => {
        expect(player.getVideoPlayedTime()).toEqual(0);
      });
    });

    describe("getWallClockTime", () => {
      it("should return 0 in getWallClockTime by default", () => {
        expect(player.getWallClockTime()).toEqual(0);
      });
    });

    describe("getPosition", () => {
      it("should return 0 in getPosition by default", () => {
        expect(player.getPosition()).toEqual(0);
      });
    });

    describe("getPlaybackRate", () => {
      it("should return 1 in getPlaybackRate by default", () => {
        expect(player.getPlaybackRate()).toEqual(1);
      });
    });

    describe("getVolume", () => {
      it("should return 1 in getVolume by default", () => {
        expect(player.getVolume()).toEqual(1);
      });
    });

    describe("isFullscreen", () => {
      it("should return false in isFullscreen by default", () => {
        expect(player.isFullscreen()).toEqual(false);
      });
    });

    describe("getAvailableVideoBitrates", () => {
      it("should return [] in getAvailableVideoBitrates by default", () => {
        expect(player.getAvailableVideoBitrates()).toEqual([]);
      });
    });

    describe("getAvailableAudioBitrates", () => {
      it("should return [] in getAvailableAudioBitrates by default", () => {
        expect(player.getAvailableAudioBitrates()).toEqual([]);
      });
    });

    describe("getVideoBitrate", () => {
      it("should return undefined in getVideoBitrate by default", () => {
        expect(player.getVideoBitrate()).toEqual(undefined);
      });
    });

    describe("getAudioBitrate", () => {
      it("should return undefined in getAudioBitrate by default", () => {
        expect(player.getVideoBitrate()).toEqual(undefined);
      });
    });

    describe("getMaxVideoBitrate", () => {
      it("should return Infinity in getMaxVideoBitrate by default", () => {
        expect(player.getMaxVideoBitrate()).toEqual(Infinity);
      });
    });

    describe("getMaxAudioBitrate", () => {
      it("should return Infinity in getMaxAudioBitrate by default", () => {
        expect(player.getMaxAudioBitrate()).toEqual(Infinity);
      });
    });

    describe("getWantedBufferAhead", () => {
      it("should return 30 in getWantedBufferAhead by default", () => {
        expect(player.getWantedBufferAhead()).toEqual(30);
      });
    });

    describe("getMaxBufferBehind", () => {
      it("should return Infinity in getMaxBufferBehind by default", () => {
        expect(player.getMaxBufferBehind()).toEqual(Infinity);
      });
    });

    describe("getMaxBufferAhead", () => {
      it("should return Infinity in getMaxBufferAhead by default", () => {
        expect(player.getMaxBufferAhead()).toEqual(Infinity);
      });
    });

    describe("getPlaybackRate/setPlaybackRate", () => {
      it("should allow to change the playback rate through setPlaybackRate", () => {
        expect(player.setPlaybackRate(4)).toEqual(undefined);
        expect(player.getPlaybackRate()).toEqual(4);

        expect(player.setPlaybackRate(3)).toEqual(undefined);
        expect(player.getPlaybackRate()).toEqual(3);

        expect(player.setPlaybackRate(2)).toEqual(undefined);
        expect(player.getPlaybackRate()).toEqual(2);

        expect(player.setPlaybackRate(1.5)).toEqual(undefined);
        expect(player.getPlaybackRate()).toEqual(1.5);

        expect(player.setPlaybackRate(0.7)).toEqual(undefined);
        expect(player.getPlaybackRate()).toEqual(0.7);

        expect(player.setPlaybackRate(1)).toEqual(undefined);
        expect(player.getPlaybackRate()).toEqual(1);
      });
    });

    describe("seekTo", () => {
      it("should throw in seekTo by default", () => {
        expect(() => player.seekTo()).toThrow();
        expect(() => player.seekTo(54)).toThrow();
        expect(() => player.seekTo({ relative: 5 })).toThrow();
        expect(() => player.seekTo({ position: 5 })).toThrow();
        expect(() => player.seekTo({ wallClockTime: 5 })).toThrow();
      });
    });

    describe("exitFullscreen", () => {
      it("should allow exitFullscreen by default", () => {
        expect(player.exitFullscreen()).toEqual(undefined);
      });
    });

    describe("setFullscreen", () => {
      it("should allow setFullscreen by default", () => {
        expect(player.setFullscreen()).toEqual(undefined);

        // TODO remove for v3.0.0
        expect(player.setFullscreen(false)).toEqual(undefined);
      });
    });

    describe("getVolume/setVolume", () => {
      it("should throw in setVolume by default if no volume has been given", () => {
        expect(() => player.setVolume()).toThrow();
      });

      it("should set the volume in setVolume by default if a volume has been given", () => {
        expect(player.setVolume(1)).toEqual(undefined);
        expect(player.setVolume(0.5)).toEqual(undefined);
        expect(player.getVolume()).toEqual(0.5);
        expect(player.getVideoElement().volume).toEqual(0.5);

        expect(player.setVolume(1)).toEqual(undefined);
        expect(player.getVolume()).toEqual(1);
        expect(player.getVideoElement().volume).toEqual(1);
      });
    });

    describe("mute/unMute/isMute", () => {
      it("should set the volume to 0 in mute by default", () => {
        const videoElement = player.getVideoElement();
        if (videoElement.muted) {
          videoElement.muted = false;
        }
        player.setVolume(1);

        expect(player.mute()).toEqual(undefined);
        expect(player.getVolume()).toEqual(0);
        expect(videoElement.volume).toEqual(0);
        expect(videoElement.muted).toEqual(false);
        expect(player.isMute()).toEqual(true);
        player.unMute();
        expect(player.isMute()).toEqual(false);
      });

      it("should unmute the volume at the previous value in unMute by default", () => {
        // back to a "normal" state.
        player.unMute();
        const videoElement = player.getVideoElement();
        if (videoElement.muted) {
          videoElement.muted = false;
        }
        expect(player.isMute()).toEqual(false);
        player.setVolume(1);

        player.setVolume(0.8);
        expect(player.getVolume()).toEqual(0.8);
        expect(videoElement.volume).toEqual(0.8);

        player.mute();
        expect(player.isMute()).toEqual(true);
        expect(player.getVolume()).toEqual(0);
        expect(videoElement.volume).toEqual(0);

        player.unMute();
        expect(player.isMute()).toEqual(false);
        expect(player.getVolume()).toEqual(0.8);
        expect(videoElement.volume).toEqual(0.8);
      });

      it("should return false in isMute by default", () => {
        expect(player.isMute()).toEqual(false);
      });

      it("should return true in isMute if the volume is equal to 0", () => {
        const oldVolume = player.getVolume();

        expect(player.isMute()).toEqual(false);

        player.setVolume(0);
        expect(player.isMute()).toEqual(true);
        player.setVolume(oldVolume);
        expect(player.isMute()).toEqual(false);

        player.mute();
        expect(player.isMute()).toEqual(true);
        player.unMute();
        expect(player.isMute()).toEqual(false);

        player.mute();
        expect(player.isMute()).toEqual(true);
        player.setVolume(oldVolume);
        expect(player.isMute()).toEqual(false);
        player.unMute();
        expect(player.isMute()).toEqual(false);

        player.setVolume(oldVolume);
      });
    });

    describe("setAudioBitrate/getManualAudioBitrate", () => {
      it("should have a -1 manual audio bitrate by default", () => {
        expect(player.getManualAudioBitrate()).toEqual(-1);
      });

      it("should update manual audio bitrate when calling setAudioBitrate", () => {
        const oldManual = player.getManualAudioBitrate();

        player.setAudioBitrate(84);
        expect(player.getManualAudioBitrate()).toEqual(84);
        player.setAudioBitrate(-1);
        expect(player.getManualAudioBitrate()).toEqual(-1);
        player.setAudioBitrate(0);
        expect(player.getManualAudioBitrate()).toEqual(0);

        player.setAudioBitrate(oldManual);
        expect(player.getManualAudioBitrate()).toEqual(oldManual);
      });
    });

    describe("setVideoBitrate/getManualVideoBitrate", () => {
      it("should have a -1 manual video bitrate by default", () => {
        expect(player.getManualVideoBitrate()).toEqual(-1);
      });

      it("should update manual video bitrate when calling setVideoBitrate", () => {
        const oldManual = player.getManualVideoBitrate();

        player.setVideoBitrate(84);
        expect(player.getManualVideoBitrate()).toEqual(84);

        player.setVideoBitrate(-1);
        expect(player.getManualVideoBitrate()).toEqual(-1);

        player.setVideoBitrate(0);
        expect(player.getManualVideoBitrate()).toEqual(0);

        player.setVideoBitrate(oldManual);
        expect(player.getManualVideoBitrate()).toEqual(oldManual);
      });
    });

    describe("setMaxVideoBitrate/getMaxVideoBitrate", () => {
      it("should update the maximum video bitrate when calling setMaxVideoBitrate by default", () => {
        const oldMax = player.getManualVideoBitrate();

        expect(player.setMaxVideoBitrate(Infinity)).toEqual(undefined);
        expect(player.getMaxVideoBitrate()).toEqual(Infinity);

        expect(player.setMaxVideoBitrate(500)).toEqual(undefined);
        expect(player.getMaxVideoBitrate()).toEqual(500);

        expect(player.setMaxVideoBitrate(3)).toEqual(undefined);
        expect(player.getMaxVideoBitrate()).toEqual(3);

        expect(player.setMaxVideoBitrate(Infinity)).toEqual(undefined);
        expect(player.getMaxVideoBitrate()).toEqual(Infinity);

        expect(player.setMaxVideoBitrate(oldMax)).toEqual(undefined);
        expect(player.getMaxVideoBitrate()).toEqual(oldMax);
      });
    });

    describe("setMaxAudioBitrate/getMaxAudioBitrate", () => {
      it("should update the maximum audio bitrate when calling setMaxAudioBitrate by default", () => {
        const oldMax = player.getManualAudioBitrate();

        expect(player.setMaxAudioBitrate(Infinity)).toEqual(undefined);
        expect(player.getMaxAudioBitrate()).toEqual(Infinity);

        expect(player.setMaxAudioBitrate(500)).toEqual(undefined);
        expect(player.getMaxAudioBitrate()).toEqual(500);

        expect(player.setMaxAudioBitrate(3)).toEqual(undefined);
        expect(player.getMaxAudioBitrate()).toEqual(3);

        expect(player.setMaxAudioBitrate(Infinity)).toEqual(undefined);
        expect(player.getMaxAudioBitrate()).toEqual(Infinity);

        expect(player.setMaxAudioBitrate(oldMax)).toEqual(undefined);
        expect(player.getMaxAudioBitrate()).toEqual(oldMax);
      });
    });

    describe("getMaxBufferBehind/setMaxBufferBehind", () => {
      it("should update the max buffer behind through setMaxBufferBehind by default", () => {
        expect(player.setMaxBufferBehind(50)).toEqual(undefined);
        expect(player.getMaxBufferBehind()).toEqual(50);

        expect(player.setMaxBufferBehind(Infinity)).toEqual(undefined);
        expect(player.getMaxBufferBehind()).toEqual(Infinity);
      });
    });

    describe("getMaxBufferAhead/setMaxBufferAhead", () => {
      it("should update the max buffer behind through setMaxBufferAhead by default", () => {
        expect(player.setMaxBufferAhead(50)).toEqual(undefined);
        expect(player.getMaxBufferAhead()).toEqual(50);

        expect(player.setMaxBufferAhead(Infinity)).toEqual(undefined);
        expect(player.getMaxBufferAhead()).toEqual(Infinity);
      });
    });

    describe("getWantedBufferAhead/setWantedBufferAhead", () => {
      it("should update the buffer goal through setWantedBufferAhead by default", () => {
        expect(player.setWantedBufferAhead(50)).toEqual(undefined);
        expect(player.getWantedBufferAhead()).toEqual(50);

        expect(player.setWantedBufferAhead(Infinity)).toEqual(undefined);
        expect(player.getWantedBufferAhead()).toEqual(Infinity);
      });
    });

    describe("getAvailableAudioTracks", () => {
      it("should return an empty array through getAvailableAudioTracks by default", () => {
        expect(player.getAvailableAudioTracks()).toEqual([]);
      });
    });

    describe("getAvailableTextTracks", () => {
      it("should return an empty array through getAvailableTextTracks by default", () => {
        expect(player.getAvailableTextTracks()).toEqual([]);
      });
    });

    describe("getAvailableVideoTracks", () => {
      it("should return an empty array through getAvailableVideoTracks by default", () => {
        expect(player.getAvailableVideoTracks()).toEqual([]);
      });
    });

    describe("getAudioTrack", () => {
      it("should return undefined through getAudioTrack by default", () => {
        expect(player.getAudioTrack()).toEqual(undefined);
      });
    });

    describe("getTextTrack", () => {
      it("should return undefined through getTextTrack by default", () => {
        expect(player.getTextTrack()).toEqual(undefined);
      });
    });

    describe("getVideoTrack", () => {
      it("should return undefined through getVideoTrack by default", () => {
        expect(player.getVideoTrack()).toEqual(undefined);
      });
    });

    describe("setAudioTrack", () => {
      it("should throw in setAudioTrack by default", () => {
        expect(() => player.setAudioTrack()).toThrow();
        expect(() => player.setAudioTrack("test")).toThrow();
      });
    });

    describe("setTextTrack", () => {
      it("should throw in setTextTrack by default", () => {
        expect(() => player.setTextTrack()).toThrow();
        expect(() => player.setTextTrack("test")).toThrow();
      });
    });

    describe("setVideoTrack", () => {
      it("should throw in setVideoTrack by default", () => {
        expect(() => player.setVideoTrack()).toThrow();
        expect(() => player.setVideoTrack("test")).toThrow();
      });
    });

    describe("disableTextTrack", () => {
      it("should disable text tracks in disableTextTrack by default", () => {
        expect(player.disableTextTrack()).toEqual(undefined);
        expect(player.getTextTrack()).toEqual(undefined);
      });
    });

    describe("getPreferredAudioTracks", () => {
      it("should return an empty array through getPreferredAudioTracks by default", () => {
        expect(player.getPreferredAudioTracks()).toEqual([]);
      });
    });

    describe("getPreferredTextTracks", () => {
      it("should return an empty array through getPreferredTextTracks by default", () => {
        expect(player.getPreferredTextTracks()).toEqual([]);
      });
    });

    describe("setPreferredAudioTracks", () => {
      it("should allow setting preferred audio tracks by default", () => {
        expect(player.getPreferredAudioTracks()).toEqual([]);
        player.setPreferredAudioTracks(["fr", "en"]);
        expect(player.getPreferredAudioTracks()).toEqual(["fr", "en"]);
        player.setPreferredAudioTracks([
          { language: "it", audioDescription: true },
          { language: "pt", audioDescription: false },
          { language: "pt", audioDescription: true },
        ]);
        expect(player.getPreferredAudioTracks()).toEqual([
          { language: "it", audioDescription: true },
          { language: "pt", audioDescription: false },
          { language: "pt", audioDescription: true },
        ]);
      });
    });

    describe("setPreferredTextTracks", () => {
      it("should return an empty array through getPreferredTextTracks by default", () => {
        expect(player.getPreferredTextTracks()).toEqual([]);
        player.setPreferredTextTracks(["fr", "en"]);
        expect(player.getPreferredTextTracks()).toEqual(["fr", "en"]);
        player.setPreferredTextTracks([
          { language: "it", closedCaption: true },
          { language: "pt", closedCaption: false },
          { language: "pt", closedCaption: true },
        ]);
        expect(player.getPreferredTextTracks()).toEqual([
          { language: "it", closedCaption: true },
          { language: "pt", closedCaption: false },
          { language: "pt", closedCaption: true },
        ]);
      });
    });

    describe("getImageTrackData", () => {
      it("should return null in getImageTrackData by default", () => {
        expect(player.getImageTrackData()).toEqual(null);
      });
    });

    describe("getMinimumPosition", () => {
      it("should return null in getMinimumPosition by default", () => {
        expect(player.getMinimumPosition()).toEqual(null);
      });
    });

    describe("getMaximumPosition", () => {
      it("should return null in getMaximumPosition by default", () => {
        expect(player.getMinimumPosition()).toEqual(null);
      });
    });
  });
});
