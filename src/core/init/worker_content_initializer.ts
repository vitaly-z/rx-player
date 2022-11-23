/**
 * Copyright 2015 CANAL+ Group
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { hasEMEAPIs } from "../../compat";
import {
  EncryptedMediaError,
  MediaError,
  NetworkError,
  OtherError,
  RequestError,
} from "../../errors";
import { INetworkErrorCode } from "../../errors/error_codes";
import log from "../../log";
import sendMessage from "../../main/send_message";
import {
  IKeySystemOption,
  IPlayerError,
} from "../../public_types";
import assert from "../../utils/assert";
import idGenerator from "../../utils/id_generator";
import createSharedReference, {
  IReadOnlySharedReference,
  ISharedReference,
} from "../../utils/reference";
import TaskCanceller, {
  CancellationSignal,
} from "../../utils/task_canceller";
import {
  ISentError,
  ISentManifest,
  IWorkerMessage,
} from "../../worker";
import { IAdaptiveRepresentationSelectorArguments } from "../adaptive";
import { PlaybackObserver } from "../api";
import ContentDecryptor, {
  ContentDecryptorState,
  IContentProtection,
} from "../decrypt";
import { IManifestFetcherSettings } from "../fetchers/manifest/manifest_fetcher";
import { ITextTrackSegmentBufferOptions } from "../segment_buffers";
import { IAudioTrackSwitchingMode } from "../stream";
import { ContentInitializer } from "./types";
import getInitialTime, {
  IInitialTimeOptions,
} from "./utils/get_initial_time";
import getLoadedReference from "./utils/get_loaded_reference";
import performInitialSeekAndPlay from "./utils/initial_seek_and_play";
import RebufferingController from "./utils/rebuffering_controller";
import listenToMediaError from "./utils/throw_on_media_error";

const generateContentId = idGenerator();

/**
 * @class WorkerContentInitializer
 */
export default class WorkerContentInitializer extends ContentInitializer {
  /** Constructor settings associated to this `WorkerContentInitializer`. */
  private _settings : IInitializeArguments;
  /**
   * `TaskCanceller` allowing to abort everything that the
   * `WorkerContentInitializer` is doing.
   */
  private _initCanceller : TaskCanceller;

  private _isPrepared : boolean;

  /**
   * Create a new `WorkerContentInitializer`, associated to the given
   * settings.
   * @param {Object} settings
   */
  constructor(settings : IInitializeArguments) {
    super();
    this._settings = settings;
    this._initCanceller = new TaskCanceller();
    this._isPrepared = false;
  }

  /**
   * Perform non-destructive preparation steps, to prepare a future content.
   * For now, this mainly mean loading the Manifest document.
   */
  public prepare(): void {
    if (this._isPrepared || this._initCanceller.isUsed) {
      return;
    }
    this._isPrepared = true;
    const { adaptiveOptions,
            worker } = this._settings;
    const { wantedBufferAhead,
            maxVideoBufferSize,
            maxBufferAhead,
            maxBufferBehind } = this._settings.bufferOptions;
    const initialVideoBitrate = adaptiveOptions.initialBitrates.video;
    const initialAudioBitrate = adaptiveOptions.initialBitrates.audio;
    sendMessage(worker,
                { type: "prepare",
                  value: { contentId: generateContentId(),
                           url: this._settings.url,
                           lowLatencyMode: this._settings.lowLatencyMode,
                           initialVideoBitrate,
                           initialAudioBitrate,
                           manifestRetryOptions: this._settings.manifestRequestSettings,
                           segmentRetryOptions: this._settings.segmentRequestOptions } });

    const limitVideoWidth = adaptiveOptions.throttlers.limitWidth.video ??
                            createSharedReference(Infinity);
    const throttleVideo = adaptiveOptions.throttlers.throttle.video ??
                          createSharedReference(Infinity);
    const throttleVideoBitrate = adaptiveOptions.throttlers.throttleBitrate.video ??
                                 createSharedReference(Infinity);
    const minAudioBitrate = adaptiveOptions.minAutoBitrates.audio ??
                            createSharedReference(0);
    const minVideoBitrate = adaptiveOptions.minAutoBitrates.video ??
                            createSharedReference(0);
    const maxAudioBitrate = adaptiveOptions.maxAutoBitrates.audio ??
                            createSharedReference(Infinity);
    const maxVideoBitrate = adaptiveOptions.maxAutoBitrates.video ??
                            createSharedReference(Infinity);
    const manualAudioBitrate = adaptiveOptions.manualBitrates.audio ??
                               createSharedReference(-1);
    const manualVideoBitrate = adaptiveOptions.manualBitrates.video ??
                               createSharedReference(-1);
    bindNumberReferencesToWorker(worker,
                                 this._initCanceller.signal,
                                 [wantedBufferAhead, "wantedBufferAhead"],
                                 [maxVideoBufferSize, "maxVideoBufferSize"],
                                 [maxBufferAhead, "maxBufferAhead"],
                                 [maxBufferBehind, "maxBufferBehind"],
                                 [minAudioBitrate, "minAudioBitrate"],
                                 [minVideoBitrate, "minVideoBitrate"],
                                 [maxAudioBitrate, "maxAudioBitrate"],
                                 [maxVideoBitrate, "maxVideoBitrate"],
                                 [manualAudioBitrate, "manualAudioBitrate"],
                                 [manualVideoBitrate, "manualVideoBitrate"],
                                 [limitVideoWidth, "limitVideoWidth"],
                                 [throttleVideo, "throttleVideo"],
                                 [throttleVideoBitrate, "throttleVideoBitrate"]);
  }

  /**
   * @param {HTMLMediaElement} mediaElement
   * @param {Object} playbackObserver
   */
  public start(
    mediaElement : HTMLMediaElement,
    playbackObserver : PlaybackObserver
  ): void {
    this.prepare(); // Load Manifest if not already done
    if (this._initCanceller.isUsed) {
      return ;
    }

    /** Send content protection initialization data. */
    const lastContentProtection = createSharedReference<IContentProtection | null>(null);

    const mediaSourceStatus = createSharedReference<MediaSourceInitializationStatus>(
      MediaSourceInitializationStatus.Nothing
    );

    const drmInitialization = this._initializeContentDecryption(
      mediaElement,
      lastContentProtection,
      mediaSourceStatus,
      this._initCanceller.signal
    );

    /** Translate errors coming from the media element into RxPlayer errors. */
    listenToMediaError(mediaElement,
                       (error : MediaError) => this._onFatalError(error),
                       this._initCanceller.signal);

    const onmessage = (msg: MessageEvent<IWorkerMessage>) => {
      switch (msg.data.type) {
        case "media-source": {
          const handle = msg.data.value;
          const listenCanceller = new TaskCanceller({
            cancelOn: this._initCanceller.signal,
          });
          mediaSourceStatus.onUpdate((currStatus) => {
            if (currStatus === MediaSourceInitializationStatus.Ready) {
              listenCanceller.cancel();
              mediaElement.srcObject = handle;
              mediaSourceStatus.setValue(MediaSourceInitializationStatus.Attached);
            }
          }, { emitCurrentValue: true, clearSignal: listenCanceller.signal });
          break;
        }

        case "warning":
          this.trigger("warning", formatError(msg.data.value));
          break;

        case "error":
          this._onFatalError(formatError(msg.data.value));
          break;

        case "encryption-data-encountered":
          lastContentProtection.setValue(msg.data.value);
          break;

        case "ready-to-start": {
          const loadedManifest = msg.data.value.manifest;
          const listenCanceller = new TaskCanceller({
            cancelOn: this._initCanceller.signal,
          });
          drmInitialization.onUpdate(initializationStatus => {
            if (initializationStatus.isInitialized) {
              listenCanceller.cancel();
              this._startPlayback(initializationStatus.drmSystemId,
                                  loadedManifest,
                                  mediaElement,
                                  playbackObserver);
            }
          }, { emitCurrentValue: true, clearSignal: listenCanceller.signal });
          break;
        }

      }
    };

    this._settings.worker.onmessage = onmessage;
    this._initCanceller.signal.register(() => {
      if (this._settings.worker.onmessage === onmessage) {
        this._settings.worker.onmessage = null;
      }
    });
  }

  public dispose(): void {
    this._initCanceller.cancel();
  }

  private _onFatalError(err : unknown) {
    if (this._initCanceller.isUsed) {
      return;
    }
    this.trigger("error", err);
    this._initCanceller.cancel();
  }

  private _initializeContentDecryption(
    mediaElement : HTMLMediaElement,
    lastContentProtection : IReadOnlySharedReference<null | IContentProtection>,
    mediaSourceStatus : ISharedReference<MediaSourceInitializationStatus>,
    cancelSignal : CancellationSignal
  ) : IReadOnlySharedReference<IDrmInitializationStatus> {
    const { keySystems } = this._settings;
    const listenCanceller = new TaskCanceller({ cancelOn: cancelSignal });
    if (keySystems.length === 0) {
      lastContentProtection.onUpdate((data) => {
        if (data === null) { // initial value
          return;
        }
        listenCanceller.cancel();
        log.error("Init: Encrypted event but EME feature not activated");
        const err = new EncryptedMediaError("MEDIA_IS_ENCRYPTED_ERROR",
                                            "EME feature not activated.");
        this._onFatalError(err);
      }, { clearSignal: listenCanceller.signal });
      mediaSourceStatus.setValue(MediaSourceInitializationStatus.Ready);
      return createSharedReference({ isInitialized: true,
                                     drmSystemId: undefined });
    } else if (!hasEMEAPIs()) {
      lastContentProtection.onUpdate((data) => {
        if (data === null) { // initial value
          return;
        }
        listenCanceller.cancel();
        log.error("Init: Encrypted event but no EME API available");
        const err = new EncryptedMediaError("MEDIA_IS_ENCRYPTED_ERROR",
                                            "Encryption APIs not found.");
        this._onFatalError(err);
      }, { clearSignal: listenCanceller.signal });
      mediaSourceStatus.setValue(MediaSourceInitializationStatus.Ready);
      return createSharedReference({ isInitialized: true,
                                     drmSystemId: undefined });
    }

    const drmStatusRef = createSharedReference<IDrmInitializationStatus>({
      isInitialized: false,
      drmSystemId: undefined,
    });

    log.debug("Init: Creating ContentDecryptor");
    const contentDecryptor = new ContentDecryptor(mediaElement, keySystems);

    contentDecryptor.addEventListener("decipherabilityStatusChange", (statuses) => {
      sendMessage(this._settings.worker, { type: "decipherabilityStatusChange",
                                           value: statuses });
    });
    contentDecryptor.addEventListener("stateChange", (state) => {
      if (state === ContentDecryptorState.WaitingForAttachment) {
        const mediaSourceStatusListenerCanceller = new TaskCanceller({
          cancelOn: listenCanceller.signal,
        });
        mediaSourceStatus.onUpdate((currStatus) => {
          if (currStatus === MediaSourceInitializationStatus.Nothing) {
            mediaSourceStatus.setValue(MediaSourceInitializationStatus.Ready);
          } else if (currStatus === MediaSourceInitializationStatus.Attached) {
            mediaSourceStatusListenerCanceller.cancel();
            if (state === ContentDecryptorState.WaitingForAttachment) {
              contentDecryptor.attach();
            }
          }
        }, { clearSignal: mediaSourceStatusListenerCanceller.signal,
             emitCurrentValue: true });
      } else if (state === ContentDecryptorState.ReadyForContent) {
        drmStatusRef.setValue({ isInitialized: true,
                                drmSystemId: contentDecryptor.systemId });
        contentDecryptor.removeEventListener("stateChange");
      }
    });

    contentDecryptor.addEventListener("error", (error) => {
      listenCanceller.cancel();
      this._onFatalError(error);
    });

    contentDecryptor.addEventListener("warning", (error) => {
      this.trigger("warning", error);
    });

    lastContentProtection.onUpdate((data) => {
      if (data === null) {
        return;
      }
      contentDecryptor.onInitializationData(data);
    }, { clearSignal: listenCanceller.signal });

    listenCanceller.signal.register(() => {
      contentDecryptor.dispose();
    });

    return drmStatusRef;
  }

  private _startPlayback(
    drmSystemId : string | undefined,
    manifest : ISentManifest,
    mediaElement : HTMLMediaElement,
    playbackObserver : PlaybackObserver
  ) {
    log.debug("Init: Calculating initial time");
    const { worker,
            lowLatencyMode,
            startAt,
            bufferOptions,
            speed,
            autoPlay } = this._settings;
    const { manualBitrateSwitchingMode,
            enableFastSwitching,
            audioTrackSwitchingMode,
            onCodecSwitch } = bufferOptions;
    const initialTime = getInitialTime(manifest, lowLatencyMode, startAt);
    log.debug("Init: Initial time calculated:", initialTime);

    const { autoPlayResult, initialPlayPerformed, initialSeekPerformed } =
      performInitialSeekAndPlay(mediaElement,
                                playbackObserver,
                                initialTime,
                                autoPlay,
                                (err) => this.trigger("warning", err),
                                this._initCanceller.signal);

    if (this._initCanceller.isUsed) {
      return;
    }

    /**
     * Class trying to avoid various stalling situations, emitting "stalled"
     * events when it cannot, as well as "unstalled" events when it get out of one.
     */
    const rebufferingController = new RebufferingController(playbackObserver,
                                                            null, // XXX TODO
                                                            speed);
    rebufferingController.addEventListener("stalled", (evt) =>
      this.trigger("stalled", evt));
    rebufferingController.addEventListener("unstalled", () =>
      this.trigger("unstalled", null));
    rebufferingController.addEventListener("warning", (err) =>
      this.trigger("warning", err));
    this._initCanceller.signal.register(() => {
      rebufferingController.destroy();
    });
    rebufferingController.start();

    initialPlayPerformed.onUpdate((isPerformed, stopListening) => {
      if (isPerformed) {
        stopListening();
        // XXX TODO
        // streamEventsEmitter(manifest,
        //                     mediaElement,
        //                     playbackObserver,
        //                     (evt) => this.trigger("streamEvent", evt),
        //                     (evt) => this.trigger("streamEventSkip", evt),
        //                     cancelSignal);
      }
    }, { clearSignal: this._initCanceller.signal, emitCurrentValue: true });

    playbackObserver.listen(sendNewPlaybackObservation);

    /**
     * Emit a "loaded" events once the initial play has been performed and the
     * media can begin playback.
     * Also emits warning events if issues arise when doing so.
     */
    autoPlayResult
      .then(() => {
        getLoadedReference(playbackObserver,
                           mediaElement,
                           false,
                           this._initCanceller.signal)
          .onUpdate((isLoaded, stopListening) => {
            if (isLoaded) {
              stopListening();
              this.trigger("loaded", { segmentBuffersStore: null });
            }
          }, { emitCurrentValue: true, clearSignal: this._initCanceller.signal });
      })
      .catch((err) => {
        if (this._initCanceller.isUsed) {
          return;
        }
        this._onFatalError(err);
      });

    function sendNewPlaybackObservation() : void {
      assert(manifest !== null);
      const observation = playbackObserver.getReference().getValue();
      const speedVal = 1;
      let pendingPosition : number | undefined;
      if (!initialSeekPerformed.getValue()) {
        pendingPosition = initialTime;
      } else if (!manifest.isDynamic || manifest.isLastPeriodKnown) {
        // HACK: When the position is actually further than the maximum
        // position for a finished content, we actually want to be loading
        // the last segment before ending.
        // For now, this behavior is implicitely forced by making as if we
        // want to seek one second before the period's end (despite never
        // doing it).
        const lastPeriod = manifest.periods[manifest.periods.length - 1];
        if (lastPeriod !== undefined &&
            lastPeriod.end !== undefined &&
            observation.position > lastPeriod.end)
        {
          pendingPosition = lastPeriod.end - 1;
        }
      }

      sendMessage(worker,
                  { type: "observation",
                    value: { position: { last: observation.position,
                                         pending: pendingPosition },
                             duration: observation.duration,
                             paused: {
                               last: observation.paused,
                               pending: initialPlayPerformed.getValue()  ? undefined :
                                        !autoPlay === observation.paused ? undefined :
                                                                           !autoPlay,
                             },
                             speed: speedVal,
                             readyState: observation.readyState } });
    }
    sendMessage(worker,
                { type: "start",
                  value: { initialTime,
                           drmSystemId,
                           manualBitrateSwitchingMode,
                           enableFastSwitching,
                           audioTrackSwitchingMode,
                           onCodecSwitch } });
    this.trigger("manifestReady", manifest);
  }
}

/** Arguments to give to the `InitializeOnMediaSource` function. */
export interface IInitializeArguments {
  worker : Worker;
  /** Options concerning the ABR logic. */
  adaptiveOptions: IAdaptiveRepresentationSelectorArguments;
  /** `true` if we should play when loaded. */
  autoPlay : boolean;
  /** Options concerning the media buffers. */
  bufferOptions : {
    /** Buffer "goal" at which we stop downloading new segments. */
    wantedBufferAhead : IReadOnlySharedReference<number>;
    /** Buffer maximum size in kiloBytes at which we stop downloading */
    maxVideoBufferSize :  IReadOnlySharedReference<number>;
    /** Max buffer size after the current position, in seconds (we GC further up). */
    maxBufferAhead : IReadOnlySharedReference<number>;
    /** Max buffer size before the current position, in seconds (we GC further down). */
    maxBufferBehind : IReadOnlySharedReference<number>;
    /** Strategy when switching the current bitrate manually (smooth vs reload). */
    manualBitrateSwitchingMode : "seamless" | "direct";
    /**
     * Enable/Disable fastSwitching: allow to replace lower-quality segments by
     * higher-quality ones to have a faster transition.
     */
    enableFastSwitching : boolean;
    /** Strategy when switching of audio track. */
    audioTrackSwitchingMode : IAudioTrackSwitchingMode;
    /** Behavior when a new video and/or audio codec is encountered. */
    onCodecSwitch : "continue" | "reload";
  };
  /** Every encryption configuration set. */
  keySystems : IKeySystemOption[];
  /** `true` to play low-latency contents optimally. */
  lowLatencyMode : boolean;
  /** Settings linked to Manifest requests. */
  manifestRequestSettings : IManifestFetcherSettings;
  /** Configuration for the segment requesting logic. */
  segmentRequestOptions : {
    lowLatencyMode : boolean;
    /**
     * Amount of time after which a request should be aborted.
     * `undefined` indicates that a default value is wanted.
     * `-1` indicates no timeout.
     */
    requestTimeout : number | undefined;
    /** Maximum number of time a request on error will be retried. */
    maxRetryRegular : number | undefined;
    /** Maximum number of time a request be retried when the user is offline. */
    maxRetryOffline : number | undefined;
  };
  /** Emit the playback rate (speed) set by the user. */
  speed : IReadOnlySharedReference<number>;
  /** The configured starting position. */
  startAt? : IInitialTimeOptions | undefined;
  /** Configuration specific to the text track. */
  textTrackOptions : ITextTrackSegmentBufferOptions;
  /** URL of the Manifest. `undefined` if unknown or not pertinent. */
  url : string | undefined;
}

function bindNumberReferencesToWorker(
  worker : Worker,
  cancellationSignal : CancellationSignal,
  ...refs : Array<[
    IReadOnlySharedReference<number>,
    "wantedBufferAhead" |
    "maxVideoBufferSize" |
    "maxBufferBehind" |
    "maxBufferAhead" |
    "minAudioBitrate" |
    "maxAudioBitrate" |
    "minVideoBitrate" |
    "maxVideoBitrate" |
    "manualAudioBitrate" |
    "manualVideoBitrate" |
    "speed" |
    "limitVideoWidth" |
    "throttleVideo" |
    "throttleVideoBitrate"
  ]>
) : void {
  for (const ref of refs) {
    ref[0].onUpdate(newVal => {
      // NOTE: The TypeScript checks have already been made by this function's
      // overload, but the body here is not aware of that.
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      /* eslint-disable @typescript-eslint/no-explicit-any */
      /* eslint-disable @typescript-eslint/no-unsafe-call */
      /* eslint-disable @typescript-eslint/no-unsafe-member-access */
      sendMessage(worker, { type: "reference-update",
                            value: { name: ref[1] as any,
                                     newVal: newVal as any } });
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
      /* eslint-enable @typescript-eslint/no-explicit-any */
      /* eslint-enable @typescript-eslint/no-unsafe-call */
      /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    }, { clearSignal: cancellationSignal, emitCurrentValue: true });
  }
}

function formatError(sentError : ISentError) : IPlayerError {
  switch (sentError.type) {
    case "NETWORK_ERROR":
      return new NetworkError(sentError.code as INetworkErrorCode,
                              new RequestError("XXX TODO", 500, "TIMEOUT", undefined));
    case "MEDIA_ERROR":
      return new MediaError(sentError.code, "XXX TODO");
    case "ENCRYPTED_MEDIA_ERROR":
      return new EncryptedMediaError(sentError.code, "XXX TODO");
    case "OTHER_ERROR":
      return new OtherError(sentError.code, "XXX TODO");
  }
}

const enum MediaSourceInitializationStatus {
  Nothing,
  Ready,
  Attached,
}

interface IDrmInitializationStatus {
  isInitialized : boolean;
  drmSystemId : string | undefined;
}

