/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable-next-line max-len */
import ContentTimeBoundariesObserver from "../core/init/utils/content_time_boundaries_observer";
/* eslint-disable-next-line max-len */
import createStreamPlaybackObserver from "../core/init/utils/create_stream_playback_observer";
import { maintainEndOfStream } from "../core/init/utils/end_of_stream";
import MediaDurationUpdater from "../core/init/utils/media_duration_updater";
import StreamOrchestrator, {
  IStreamOrchestratorCallbacks,
} from "../core/stream";
import {
  formatError,
  MediaError,
  OtherError,
} from "../errors";
import {
  IEncryptedMediaErrorCode,
  IMediaErrorCode,
  INetworkErrorCode,
  IOtherErrorCode,
} from "../errors/error_codes";
import log from "../log";
import {
  IContentInitializationData,
  IMainThreadMessage,
  IReferenceUpdateMessage,
  IStartContentMessageValue,
  IWorkerPlaybackObservation,
} from "../main";
import Manifest, {
  Adaptation,
  Period,
  Representation,
} from "../manifest";
import DashWasmParser from "../parsers/manifest/dash/wasm-parser";
import createSharedReference from "../utils/reference";
import TaskCanceller, {
  CancellationSignal,
} from "../utils/task_canceller";
/* eslint-disable-next-line max-len */
import {
  limitVideoWidth,
  manualAudioBitrate,
  manualVideoBitrate,
  maxAudioBitrate,
  maxBufferAhead,
  maxBufferBehind,
  maxVideoBitrate,
  maxVideoBufferSize,
  minAudioBitrate,
  minVideoBitrate,
  speed,
  throttleVideo,
  throttleVideoBitrate,
  wantedBufferAhead,
} from "./globals";
import sendMessage from "./send_message";
import WorkerContentStore from "./worker_content_store";
import WorkerPlaybackObserver from "./worker_playback_observer";
import {
  INITIAL_OBSERVATION,
  WASM_URL,
} from "./worker_utils";

// Some code might be relying on `window` still for now, just define `window` as
// the Worker's global scope
(globalThis as any).window = globalThis;

const currentContentStore = new WorkerContentStore();

const parser = new DashWasmParser();
// XXX TODO proper way to expose WASM Parser
// Trough features object?
(globalThis as any).parser = parser;
parser.initialize({ wasmUrl: WASM_URL }).catch((err) => {
  console.error(err);
});

// XXX TODO proper way of creating PlaybackObserver
let playbackObservationRef = createSharedReference<IWorkerPlaybackObservation>(
  INITIAL_OBSERVATION
);

onmessage = function (e: MessageEvent<IMainThreadMessage>) {
  log.debug("Worker: received message", e.type);

  const msg = e.data;
  switch (msg.type) {
    case "prepare":
      prepareNewContent(msg.value);
      break;

    case "start":
      startCurrentContent(msg.value);
      break;

    case "observation":
      playbackObservationRef.setValue(msg.value);
      break;

    case "reference-update":
      updateGlobalReference(msg);
      break;

    case "decipherabilityStatusChange":
      const currentContent = currentContentStore.getCurrentContent();
      if (currentContent === null || currentContent.manifest === null) {
        return;
      }
      const updates = msg.value;
      currentContent.manifest.updateRepresentationsDeciperability((content) => {
        for (const update of updates) {
          if (
            content.manifest.id === update.manifestId &&
            content.period.id === update.periodId &&
            content.adaptation.id === update.adaptationId &&
            content.representation.id === update.representationId
          ) {
            return update.decipherable;
          }
        }
      });
      break;

    default:
      console.warn("Unrecognized Event Message : ", e);
  }
};

function prepareNewContent(
  contentInitData : IContentInitializationData
) : void {
  currentContentStore.initializeNewContent(contentInitData).then(
    (manifest) => {
      sendMessage({ type: "ready-to-start",
                    contentId: contentInitData.contentId,
                    value: { manifest } });
    },
    (err : unknown) => {
      sendMessage({ type: "error",
                    contentId: contentInitData.contentId,
                    value: formatErrorForSender(err) });
    }
  );
}

function startCurrentContent(val : IStartContentMessageValue) {
  const preparedContent = currentContentStore.getCurrentContent();
  if (preparedContent === null || preparedContent.manifest === null) {
    const error = new OtherError("NONE",
                                 "Starting content when none is prepared");
    sendMessage({ type: "error",
                  contentId: undefined,
                  value: formatErrorForSender(error) });
    return;
  }
  const { contentId,
          manifest,
          mediaSource,
          representationEstimator,
          segmentBuffersStore,
          canceller,
          segmentFetcherCreator } = preparedContent;
  const { audioTrackSwitchingMode,
          drmSystemId,
          enableFastSwitching,
          initialTime,
          manualBitrateSwitchingMode,
          onCodecSwitch } = val;

  playbackObservationRef = createSharedReference<IWorkerPlaybackObservation>(
    INITIAL_OBSERVATION
  );
  canceller.signal.register(() => {
    playbackObservationRef.finish();
  });
  const playbackObserver = new WorkerPlaybackObserver(playbackObservationRef,
                                                      canceller.signal);
  const streamPlaybackObserver =
    createStreamPlaybackObserver(manifest, playbackObserver, { speed });

  const initialPeriod = manifest.getPeriodForTime(initialTime) ??
                        manifest.getNextPeriod(initialTime);
  if (initialPeriod === undefined) {
    const error = new MediaError("MEDIA_STARTING_TIME_NOT_FOUND",
                                 "Wanted starting time not found in the Manifest.");
    sendMessage({ type: "error",
                  contentId,
                  value: formatErrorForSender(error) });
    return;
  }

  const contentTimeBoundariesObserver =
    _createContentTimeBoundariesObserver(canceller.signal);

  StreamOrchestrator({ initialPeriod: manifest.periods[0],
                       manifest },
                     streamPlaybackObserver,
                     representationEstimator,
                     segmentBuffersStore,
                     segmentFetcherCreator,
                     {  wantedBufferAhead,
                        maxVideoBufferSize,
                        maxBufferAhead,
                        maxBufferBehind,
                        audioTrackSwitchingMode,
                        drmSystemId,
                        enableFastSwitching,
                        manualBitrateSwitchingMode,
                        onCodecSwitch },
                     handleStreamOrchestratorCallbacks(),
                     canceller.signal);


  /**
   * Returns Object handling the callbacks from a `StreamOrchestrator`, which
   * are basically how it communicates about events.
   * @returns {Object}
   */
  function handleStreamOrchestratorCallbacks() : IStreamOrchestratorCallbacks {
    return {
      needsBufferFlush() {
        // XXX TODO
        // playbackObserver.setCurrentTime(mediaElement.currentTime + 0.001),
      },

      streamStatusUpdate(value) {
        // XXX TODO Announce discontinuities if found

        // If the status for the last Period indicates that segments are all loaded
        // or on the contrary that the loading resumed, announce it to the
        // ContentTimeBoundariesObserver.
        if (manifest.isLastPeriodKnown &&
            value.period.id === manifest.periods[manifest.periods.length - 1].id)
        {
          const hasFinishedLoadingLastPeriod = value.hasFinishedLoading ||
                                               value.isEmptyStream;
          if (hasFinishedLoadingLastPeriod) {
            contentTimeBoundariesObserver
              .onLastSegmentFinishedLoading(value.bufferType);
          } else {
            contentTimeBoundariesObserver
              .onLastSegmentLoadingResume(value.bufferType);
          }
        }
      },

      needsManifestRefresh() {
        // XXX TODO schedule Manifest refresh
      },

      manifestMightBeOufOfSync() {
        // XXX TODO schedule Manifest refresh
      },

      lockedStream() {
        // XXX TODO handle locked streams
      },

      adaptationChange() {
        // XXX TODO
      },

      representationChange() {
        // XXX TODO
      },

      inbandEvent() {
        // XXX TODO
      },

      warning(value) {
        sendMessage({ type: "warning",
                      contentId,
                      value: formatErrorForSender(value) });
      },

      periodStreamReady(value) {
        // XXX TODO Real track choice
        let adaptation;
        if (value.type === "audio") {
          const allSupportedAdaptations =
            (value.period.adaptations[value.type] ?? [])
              .filter(a => a.isSupported);
          if (allSupportedAdaptations.length === 0) {
            adaptation = null;
          } else {
            adaptation = allSupportedAdaptations[0];
          }
        } else {
          adaptation = value.period.adaptations[value.type]?.[0] ?? null;
        }
        value.adaptationRef.setValue(adaptation);
      },

      periodStreamCleared() {
        // XXX TODO
      },

      bitrateEstimationChange() {
        // XXX TODO
      },

      addedSegment() {
        // XXX TODO
      },

      needsMediaSourceReload() {
        // XXX TODO
      },

      needsDecipherabilityFlush() {
        // XXX TODO
      },

      encryptionDataEncountered(values) {
        for (const value of values) {
          const originalContent = value.content;
          const content = { ...originalContent };
          if (content.manifest instanceof Manifest) {
            content.manifest = content.manifest.getShareableManifest();
          }
          if (content.period instanceof Period) {
            content.period = content.period.getShareablePeriod();
          }
          if (content.adaptation instanceof Adaptation) {
            content.adaptation = content.adaptation.getShareableAdaptation();
          }
          if (content.representation instanceof Representation) {
            content.representation = content.representation.getShareableRepresentation();
          }
          sendMessage({ type: "encryption-data-encountered",
                        contentId,
                        value: { keyIds: value.keyIds,
                                 values: value.values,
                                 content,
                                 type: value.type } });
        }
      },

      error(error : unknown) {
        sendMessage({ type: "error",
                      contentId,
                      value: formatErrorForSender(error) });
      },
    };
  }

  /**
   * Creates a `ContentTimeBoundariesObserver`, a class indicating various
   * events related to media time (such as duration updates, period changes,
   * warnings about being out of the Manifest time boundaries or "endOfStream"
   * management), handle those events and returns the class.
   *
   * Various methods from that class need then to be called at various events
   * (see `ContentTimeBoundariesObserver`).
   * @param {Object} cancelSignal
   * @returns {Object}
   */
  function _createContentTimeBoundariesObserver(
    cancelSignal : CancellationSignal
  ) : ContentTimeBoundariesObserver {
    /** Maintains the MediaSource's duration up-to-date with the Manifest */
    const mediaDurationUpdater = new MediaDurationUpdater(manifest, mediaSource);
    cancelSignal.register(() => {
      mediaDurationUpdater.stop();
    });
    /** Allows to cancel a pending `end-of-stream` operation. */
    let endOfStreamCanceller : TaskCanceller | null = null;
    const _ctntTimeBoundariesObserver = new ContentTimeBoundariesObserver(
      manifest,
      streamPlaybackObserver,
      segmentBuffersStore.getBufferTypes()
    );
    cancelSignal.register(() => {
      _ctntTimeBoundariesObserver.dispose();
    });
    _ctntTimeBoundariesObserver.addEventListener("warning", (err) => {
      sendMessage({ type: "warning",
                    contentId,
                    value: formatErrorForSender(err) });
    });
    _ctntTimeBoundariesObserver.addEventListener("periodChange", () => {
      // XXX TODO
    });
    _ctntTimeBoundariesObserver.addEventListener("durationUpdate", (newDuration) => {
      log.debug("Init: Duration has to be updated.", newDuration);
      mediaDurationUpdater.updateKnownDuration(newDuration);
    });
    _ctntTimeBoundariesObserver.addEventListener("endOfStream", () => {
      if (endOfStreamCanceller === null) {
        endOfStreamCanceller = new TaskCanceller();
        endOfStreamCanceller.linkToSignal(cancelSignal);
        log.debug("Init: end-of-stream order received.");
        maintainEndOfStream(mediaSource, endOfStreamCanceller.signal);
      }
    });
    _ctntTimeBoundariesObserver.addEventListener("resumeStream", () => {
      if (endOfStreamCanceller !== null) {
        log.debug("Init: resume-stream order received.");
        endOfStreamCanceller.cancel();
        endOfStreamCanceller = null;
      }
    });
    return _ctntTimeBoundariesObserver;
  }
}

function updateGlobalReference(msg: IReferenceUpdateMessage) : void {
  switch (msg.value.name) {
    case "wantedBufferAhead":
      wantedBufferAhead.setValueIfChanged(msg.value.newVal);
      break;
    case "maxBufferBehind":
      maxBufferBehind.setValueIfChanged(msg.value.newVal);
      break;
    case "maxBufferAhead":
      maxBufferBehind.setValueIfChanged(msg.value.newVal);
      break;
    case "minAudioBitrate":
      minAudioBitrate.setValueIfChanged(msg.value.newVal);
      break;
    case "maxAudioBitrate":
      maxAudioBitrate.setValueIfChanged(msg.value.newVal);
      break;
    case "minVideoBitrate":
      minVideoBitrate.setValueIfChanged(msg.value.newVal);
      break;
    case "maxVideoBitrate":
      maxVideoBitrate.setValueIfChanged(msg.value.newVal);
      break;
    case "manualAudioBitrate":
      manualAudioBitrate.setValueIfChanged(msg.value.newVal);
      break;
    case "manualVideoBitrate":
      manualVideoBitrate.setValueIfChanged(msg.value.newVal);
      break;
    case "speed":
      speed.setValueIfChanged(msg.value.newVal);
      break;
    case "limitVideoWidth":
      limitVideoWidth.setValueIfChanged(msg.value.newVal);
      break;
    case "throttleVideo":
      throttleVideo.setValueIfChanged(msg.value.newVal);
      break;
    case "throttleVideoBitrate":
      throttleVideoBitrate.setValueIfChanged(msg.value.newVal);
      break;
  }
}

export interface ISentNetworkError {
  type : "NETWORK_ERROR";
  code : INetworkErrorCode;
}

export interface ISentMediaError {
  type : "MEDIA_ERROR";
  code : IMediaErrorCode;
}

export interface ISentEncryptedMediaError {
  type : "ENCRYPTED_MEDIA_ERROR";
  code : IEncryptedMediaErrorCode;
}

export interface ISentOtherError {
  type : "OTHER_ERROR";
  code : IOtherErrorCode;
}

export type ISentError = ISentNetworkError |
                         ISentMediaError |
                         ISentEncryptedMediaError |
                         ISentOtherError;

function formatErrorForSender(
  error : unknown
) : ISentError {
  const formattedError = formatError(error, {
    defaultCode: "NONE",
    defaultReason: "An unknown error stopped content playback.",
  });
  /* eslint-disable-next-line  @typescript-eslint/no-unsafe-return */
  return { type: formattedError.type, code: formattedError.code } as any;
}

export {
  ISentManifest,
  ISentPeriod,
  ISentAdaptation,
  ISentRepresentation,
  IWorkerMessage,
} from "./send_message";

export {
  IABRThrottlers,
} from "../core/adaptive";
export {
  IBufferType,
} from "../core/segment_buffers";
export { IAdaptationType } from "../manifest";
