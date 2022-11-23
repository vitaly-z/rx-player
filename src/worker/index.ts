/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ManifestFetcher } from "../core/fetchers";
/* eslint-disable-next-line max-len */
import ContentTimeBoundariesObserver from "../core/init/utils/content_time_boundaries_observer";
/* eslint-disable-next-line max-len */
import createStreamPlaybackObserver from "../core/init/utils/create_stream_playback_observer";
import { maintainEndOfStream } from "../core/init/utils/end_of_stream";
import StreamOrchestrator, {
  IAdaptationChangeEvent,
  IStreamOrchestratorEvent,
} from "../core/stream";
import {
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
import { IPlayerError } from "../public_types";
import createDashPipeline from "../transports/dash";
import createSharedReference from "../utils/reference";
import TaskCanceller from "../utils/task_canceller";
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

(globalThis as any).window = globalThis;

const currentContentStore = new WorkerContentStore();

const parser = new DashWasmParser();
// XXX TODO proper way to expose WASM Parser
(globalThis as any).parser = parser;
parser.initialize({ wasmUrl: WASM_URL }).catch((err) => {
  console.error(err);
});

// XXX TODO proper way of creating PlaybackObserver
const playbackObservationRef = createSharedReference<IWorkerPlaybackObservation>(
  INITIAL_OBSERVATION
);

const canceller = new TaskCanceller();
const playbackObserver = new WorkerPlaybackObserver(playbackObservationRef,
                                                    canceller.signal);

let currentContentCanceller = new TaskCanceller();

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
      if (currentContent === null) {
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
  context : IContentInitializationData
) {
  currentContentCanceller.cancel();
  currentContentCanceller = new TaskCanceller();
  const { contentId,
          url,
          lowLatencyMode } = context;
  let manifest : Manifest | null = null;
  let hasMediaSourceOpen : boolean = false;

  const mediaSource = new MediaSource();
  const handle = (mediaSource as any).handle;
  sendMessage({ type: "media-source", contentId, value: handle }, [handle]);
  mediaSource.addEventListener("sourceopen", function () {
    hasMediaSourceOpen = true;
    checkIfReadyAndValidate();
  });

  const dashPipeline = createDashPipeline({ lowLatencyMode });
  const manifestFetcher = new ManifestFetcher(
    url === undefined ? undefined : [url],
    dashPipeline,
    context.manifestRetryOptions);

  currentContentCanceller.signal.register(() => {
    manifestFetcher.dispose();
  });
  manifestFetcher.addEventListener("warning", (err : IPlayerError) => {
    sendMessage({ type: "warning",
                  contentId,
                  value: formatErrorForSender(err) });
  });
  manifestFetcher.addEventListener("manifestReady", (man : Manifest) => {
    manifest = man;
    checkIfReadyAndValidate();
  });
  manifestFetcher.start();

  function checkIfReadyAndValidate() {
    if (manifest === null || !hasMediaSourceOpen) {
      return;
    }

    const sentManifest = manifest.getShareableManifest();
    sendMessage({ type: "ready-to-start",
                  contentId,
                  value: { manifest: sentManifest } });
    currentContentStore.setNewContent(context, dashPipeline, manifest, mediaSource);
  }
}

function startCurrentContent(val : IStartContentMessageValue) {
  const preparedContent = currentContentStore.getCurrentContent();
  if (preparedContent === null) {
    const error = new OtherError("NONE",
                                 "Starting content when none is prepared");
    sendMessage({ type: "error",
                  contentId: undefined,
                  value: formatErrorForSender(error) });
    return;
  }
  const { contentId,
          manifest,
          mediaDurationUpdater,
          mediaSource,
          representationEstimator,
          segmentBuffersStore,
          segmentFetcherCreator } = preparedContent;
  const { audioTrackSwitchingMode,
          drmSystemId,
          enableFastSwitching,
          initialTime,
          manualBitrateSwitchingMode,
          onCodecSwitch } = val;

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

  const stream = StreamOrchestrator({ initialPeriod: manifest.periods[0],
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
                                       onCodecSwitch });


  /** Emit each time a new Adaptation is considered by the `StreamOrchestrator`. */
  const lastAdaptationChange = createSharedReference<
    IAdaptationChangeEvent | null
  >(null);
  const durationRef = ContentTimeBoundariesObserver(
    manifest,
    lastAdaptationChange,
    streamPlaybackObserver,
    (err : IPlayerError) => {
      sendMessage({ type: "warning",
                    contentId,
                    value: formatErrorForSender(err) });
    },
    currentContentCanceller.signal
  );
  durationRef.onUpdate((newDuration) => {
    log.debug("Init: Duration has to be updated.", newDuration);
    mediaDurationUpdater.updateKnownDuration(newDuration);
  }, { emitCurrentValue: true, clearSignal: currentContentCanceller.signal });

  let endOfStreamCanceller : TaskCanceller | null = null;
  stream.subscribe((event : IStreamOrchestratorEvent) => {
    switch (event.type) {
      case "periodStreamReady":
        // XXX TODO Real track choice
        let adaptation;
        if (event.value.type === "audio") {
          const allSupportedAdaptations =
            (event.value.period.adaptations[event.value.type] ?? [])
              .filter(a => a.isSupported);
          if (allSupportedAdaptations.length === 0) {
            adaptation = null;
          } else {
            adaptation = allSupportedAdaptations[0];
          }
        } else {
          adaptation = event.value.period.adaptations[event.value.type]?.[0] ?? null;
        }
        event.value.adaptation$.next(adaptation);
        break;
      case "periodStreamCleared":
        // XXX TODO
        break;
      case "end-of-stream":
        if (endOfStreamCanceller === null) {
          endOfStreamCanceller = new TaskCanceller({
            cancelOn: currentContentCanceller.signal,
          });
          log.debug("Init: end-of-stream order received.");
          maintainEndOfStream(mediaSource, endOfStreamCanceller.signal);
        }
        break;
      case "resume-stream":
        if (endOfStreamCanceller !== null) {
          log.debug("Init: resume-stream order received.");
          endOfStreamCanceller.cancel();
        }
        break;
      case "encryption-data-encountered":
        const originalContent = event.value.content;
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

        sendMessage({ type: event.type,
                      value: { keyIds: event.value.keyIds,
                               values: event.value.values,
                               content,
                               type: event.value.type } });
        break;
      case "activePeriodChanged":
        const sentPeriod = event.value.period.getShareablePeriod();
        sendMessage({ type: "activePeriodChanged",
                      value: { period: sentPeriod } });
        break;
      case "adaptationChange":
        // XXX TODO
        break;
      case "representationChange":
        // XXX TODO
        break;
      case "complete-stream":
        // XXX TODO
        break;
      case "bitrateEstimationChange":
        // XXX TODO
        break;
      case "needs-media-source-reload":
        // XXX TODO
        break;
      case "needs-buffer-flush":
        // XXX TODO
        break;
      case "needs-decipherability-flush":
        // XXX TODO
        break;
      case "added-segment":
        // XXX TODO
        break;
      case "manifest-might-be-out-of-sync":
        // XXX TODO
        break;
      case "inband-events":
        // XXX TODO
        break;
      case "warning":
        sendMessage({ type: "warning",
                      contentId,
                      value: formatErrorForSender(event.value) });
        // XXX TODO
        break;
      case "needs-manifest-refresh":
        // XXX TODO
        break;
      case "stream-status":
        // XXX TODO send discontinuity
        // const { period, bufferType, imminentDiscontinuity, position } = evt.value;
        // discontinuityUpdate$.next({ period,
        //                             bufferType,
        //                             discontinuity: imminentDiscontinuity,
        //                             position });
        break;
      case "locked-stream":
        // XXX TODO send locked-stream event
        // Isn't it risky here? Find solution
        break;
      default:
        // XXX TODO Actually send other events
        break;
    }
  });
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
  error : IPlayerError
) : ISentError {
  /* eslint-disable-next-line  @typescript-eslint/no-unsafe-return */
  return { type: error.type, code: error.code } as any;
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
