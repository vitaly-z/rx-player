/**
 * # Player Module
 *
 * Instanciate a new RxPlayer, link its state and this module's state, provide
 * actions to allow easy interactions with the player to the rest of the
 * application.
 */

import RxPlayer from "rx-player";
import { linkPlayerEventsToState } from "./events.js";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import $handleCatchUpMode from "./catchUp";

const PLAYER = ({ $destroy, state }, { videoElement, textTrackElement }) => {
  const player = new RxPlayer({
    limitVideoWidth: false,
    stopAtEnd: false,
    throttleVideoBitrateWhenHidden: true,
    videoElement,
  });

  // facilitate DEV mode
  window.RxPlayer = RxPlayer;
  window.player = window.rxPlayer = player;

  const _cache = {};
  /* eslint-disable no-console */
  if (player) {
    setInterval(() => {
      const now = Date.now();
      console.log(">>> Searching for discontinuities...", now);
      const manifest = player.getManifest();
      if (manifest) {
        const { periods } = manifest;
        const nbrPeriods = periods.length;
        for (let i = 0; i < nbrPeriods; i++) {
          const period = periods[i];
          const nextPeriod = periods[i + 1];
          if (nextPeriod) {
            const { adaptations: nextAdaptations } = nextPeriod;
            const { video: nextVideo, audio: nextAudio } = nextAdaptations;
            const nextPeriodHasVideoContent =
              nextVideo.reduce((A, videoAdaptation) => {
                const { representations } = videoAdaptation;
                const representationsHasVideoContent =
                  representations.reduce((R, videoRep) => {
                    const hasContent = !!videoRep.index.getFirstPosition();
                    return hasContent || R;
                  }, false);
                return A || representationsHasVideoContent;
              }, false);

            const nextPeriodHasAudioContent =
              nextAudio.reduce((A, audioAdaptation) => {
                const { representations } = audioAdaptation;
                const representationsHasAudioContent =
                  representations.reduce((R, audioRep) => {
                    const hasContent = !!audioRep.index.getFirstPosition();
                    return hasContent || R;
                  }, false);
                return A || representationsHasAudioContent;
              }, false);

            const { adaptations } = period;
            const { video, audio } = adaptations;
            const videoLen = video.length;
            const audioLen = audio.length;
            if (nextPeriodHasVideoContent) {
              for (let v = 0; v < videoLen; v++) {
                const videoAdaptation = video[v];
                const { representations } = videoAdaptation;
                for (let vr = 0; vr < representations.length; vr++) {
                  const representation = representations[vr];
                  const lastPosition = representation.index.getLastPosition();
                  const ids = period.id +
                              videoAdaptation.id +
                              representation.id +
                              lastPosition +
                              period.end;
                  if (!_cache[ids]) {
                    if (period.end != null &&
                        lastPosition != null &&
                        period.end > lastPosition) {
                      _cache[ids] = true;
                      console.warn(">>>\n",
                                   "Gap at end of video period\n",
                                   "period id:", period.id, "\n",
                                   "adaptation id:", videoAdaptation.id, "\n",
                                   "representation id:", representation.id, "\n",
                                   "last index pos:", lastPosition, "\n",
                                   "period end:", period.end, "\n",
                                   "now:", now);
                    }
                  }
                }
              }
            }
            if (nextPeriodHasAudioContent) {
              for (let a = 0; a < audioLen; a++) {
                const audioAdaptation = audio[a];
                const { representations } = audioAdaptation;
                for (let ar = 0; ar < representations.length; ar++) {
                  const representation = representations[ar];
                  const lastPosition = representation.index.getLastPosition();
                  const ids = period.id +
                              audioAdaptation.id +
                              representation.id +
                              lastPosition +
                              period.end;
                  if (!_cache[ids]) {
                    if (period.end != null &&
                        lastPosition != null &&
                        period.end > lastPosition) {
                      _cache[ids] = true;
                      console.warn(">>>\n",
                                   "Gap at end of audio period\n",
                                   "period id:", period.id, "\n",
                                   "adaptation id:", audioAdaptation.id, "\n",
                                   "representation id:", representation.id, "\n",
                                   "last index pos:", lastPosition, "\n",
                                   "period end:", period.end, "\n",
                                   "now:", now);
                    }
                  }
                }
              }
            }
          }
        }
      } else {
        console.log(">>> No manifest on player");
      }
    }, 5 * 1000);
  }
  /* eslint-enable no-console */

  // initial state. Written here to easily showcase it exhaustively
  state.set({
    audioBitrate: undefined,
    audioBitrateAuto: true,
    autoPlayBlocked: false,
    availableAudioBitrates: [],
    availableLanguages: [],
    availableSubtitles: [],
    availableVideoBitrates: [],
    availableVideoTracks: [],
    bufferGap: undefined,
    bufferedData: null,
    cannotLoadMetadata: false,
    currentTime: undefined,
    duration: undefined,
    error: null,
    hasCurrentContent: false,
    hasEnded: false,
    images: [],
    isBuffering: false,
    isCatchUpEnabled: false,
    isCatchingUp: false,
    isContentLoaded: false,
    isLive: false,
    isLoading: false,
    isPaused: false,
    isReloading: false,
    isSeeking: false,
    isStopped: true,
    language: undefined,
    liveGap: undefined,
    loadedVideo: null,
    lowLatencyMode: false,
    maximumPosition: undefined,
    minimumPosition: undefined,
    playbackRate: player.getPlaybackRate(),
    subtitle: undefined,
    videoBitrate: undefined,
    videoBitrateAuto: true,
    videoTrackId: undefined,
    volume: player.getVolume(),
    wallClockDiff: undefined,
  });

  linkPlayerEventsToState(player, state, $destroy);

  const $switchCatchUpMode = new Subject();
  $handleCatchUpMode($switchCatchUpMode, player, state)
    .pipe(takeUntil($destroy))
    .subscribe();

  // dispose of the RxPlayer when destroyed
  $destroy.subscribe(() => player.dispose());

  return {
    SET_VOLUME: (volume) => {
      player.setVolume(volume);
    },

    LOAD: (arg) => {
      player.loadVideo(Object.assign({
        textTrackElement,
        networkConfig: {
          segmentRetry: Infinity,
          manifestRetry: Infinity,
          offlineRetry: Infinity,
        },
        manualBitrateSwitchingMode: "direct",
        transportOptions: { checkMediaSegmentIntegrity: true },
      }, arg));
      state.set({
        loadedVideo: arg,
        lowLatencyMode: arg.lowLatencyMode === true,
      });
    },

    PLAY: () => {
      player.play();

      const { isStopped, hasEnded } = state.get();
      if (!isStopped && !hasEnded) {
        state.set({ isPaused: false });
      }
    },

    PAUSE: () => {
      player.pause();

      const { isStopped, hasEnded } = state.get();
      if (!isStopped && !hasEnded) {
        state.set({ isPaused: true });
      }
    },

    STOP: () => {
      player.stop();
    },

    SEEK: (position) => {
      player.seekTo({ position });
    },

    MUTE: () => {
      player.mute();
    },

    UNMUTE: () => {
      player.unMute();
    },

    SET_AUDIO_BITRATE: (bitrate) => {
      player.setAudioBitrate(bitrate || -1);
      state.set({ audioBitrateAuto: !bitrate });
    },

    SET_VIDEO_BITRATE: (bitrate) => {
      player.setVideoBitrate(bitrate || -1);
      state.set({ videoBitrateAuto: !bitrate });
    },

    SET_AUDIO_TRACK: (track) => {
      player.setAudioTrack(track.id);
    },

    SET_VIDEO_TRACK: (track) => {
      player.setVideoTrack(track.id);
    },

    DISABLE_VIDEO_TRACK: () => {
      player.disableVideoTrack();
    },

    SET_SUBTITLES_TRACK: (track) => {
      player.setTextTrack(track.id);
    },

    DISABLE_SUBTITLES_TRACK: () => {
      player.disableTextTrack();
    },

    SET_PLAYBACK_RATE: (rate) => {
      player.setPlaybackRate(rate);
      state.set({ playbackRate: rate });
    },

    ENABLE_LIVE_CATCH_UP() {
      $switchCatchUpMode.next(true);
    },

    DISABLE_LIVE_CATCH_UP() {
      $switchCatchUpMode.next(false);
    },
  };
};

export default PLAYER;
