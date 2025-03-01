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

import nextTick from "next-tick";
import config from "../../../config";
import {
  formatError,
  MediaError,
} from "../../../errors";
import log from "../../../log";
import {
  Adaptation,
  Period,
} from "../../../manifest";
import objectAssign from "../../../utils/object_assign";
import { getLeftSizeOfRange } from "../../../utils/ranges";
import SharedReference, {
  IReadOnlySharedReference,
} from "../../../utils/reference";
import TaskCanceller, {
  CancellationError,
  CancellationSignal,
} from "../../../utils/task_canceller";
import { IReadOnlyPlaybackObserver } from "../../api";
import SegmentBuffersStore, {
  IBufferType,
  ITextTrackSegmentBufferOptions,
  SegmentBuffer,
} from "../../segment_buffers";
import AdaptationStream, {
  IAdaptationStreamCallbacks,
  IAdaptationStreamPlaybackObservation,
} from "../adaptation";
import {
  IPeriodStreamArguments,
  IPeriodStreamCallbacks,
  IPeriodStreamPlaybackObservation,
} from "./types";
import getAdaptationSwitchStrategy from "./utils/get_adaptation_switch_strategy";

/**
 * Create a single PeriodStream:
 *   - Lazily create (or reuse) a SegmentBuffer for the given type.
 *   - Create a Stream linked to an Adaptation each time it changes, to
 *     download and append the corresponding segments to the SegmentBuffer.
 *   - Announce when the Stream is full or is awaiting new Segments through
 *     events
 *
 * @param {Object} args - Various arguments allowing the `PeriodStream` to
 * determine which Adaptation and which Representation to choose, as well as
 * which segments to load from it.
 * You can check the corresponding type for more information.
 * @param {Object} callbacks - The `PeriodStream` relies on a system of
 * callbacks that it will call on various events.
 *
 * Depending on the event, the caller may be supposed to perform actions to
 * react upon some of them.
 *
 * This approach is taken instead of a more classical EventEmitter pattern to:
 *   - Allow callbacks to be called synchronously after the
 *     `AdaptationStream` is called.
 *   - Simplify bubbling events up, by just passing through callbacks
 *   - Force the caller to explicitely handle or not the different events.
 *
 * Callbacks may start being called immediately after the `AdaptationStream`
 * call and may be called until either the `parentCancelSignal` argument is
 * triggered, or until the `error` callback is called, whichever comes first.
 * @param {Object} parentCancelSignal - `CancellationSignal` allowing, when
 * triggered, to immediately stop all operations the `PeriodStream` is
 * doing.
 */
export default function PeriodStream(
  { bufferType,
    content,
    garbageCollectors,
    playbackObserver,
    representationEstimator,
    segmentFetcherCreator,
    segmentBuffersStore,
    options,
    wantedBufferAhead,
    maxVideoBufferSize } : IPeriodStreamArguments,
  callbacks : IPeriodStreamCallbacks,
  parentCancelSignal : CancellationSignal
) : void {
  const { period } = content;

  /**
   * Emits the chosen Adaptation for the current type.
   * `null` when no Adaptation is chosen (e.g. no subtitles)
   * `undefined` at the beginning (it can be ignored.).
   */
  const adaptationRef = new SharedReference<Adaptation|null|undefined>(
    undefined,
    parentCancelSignal
  );

  callbacks.periodStreamReady({ type: bufferType, period, adaptationRef });
  if (parentCancelSignal.isCancelled()) {
    return;
  }

  let currentStreamCanceller : TaskCanceller | undefined;
  let isFirstAdaptationSwitch = true;

  adaptationRef.onUpdate((adaptation : Adaptation | null | undefined) => {
    // As an IIFE to profit from async/await while respecting onUpdate's signature
    (async () : Promise<void> => {
      if (adaptation === undefined) {
        return;
      }
      const streamCanceller = new TaskCanceller();
      streamCanceller.linkToSignal(parentCancelSignal);
      currentStreamCanceller?.cancel(); // Cancel oreviously created stream if one
      currentStreamCanceller = streamCanceller;

      if (adaptation === null) { // Current type is disabled for that Period
        log.info(`Stream: Set no ${bufferType} Adaptation. P:`, period.start);
        const segmentBufferStatus = segmentBuffersStore.getStatus(bufferType);

        if (segmentBufferStatus.type === "initialized") {
          log.info(`Stream: Clearing previous ${bufferType} SegmentBuffer`);
          if (SegmentBuffersStore.isNative(bufferType)) {
            return askForMediaSourceReload(0, true, streamCanceller.signal);
          } else {
            const periodEnd = period.end ?? Infinity;
            if (period.start > periodEnd) {
              log.warn("Stream: Can't free buffer: period's start is after its end");
            } else {
              await segmentBufferStatus.value.removeBuffer(period.start,
                                                           periodEnd,
                                                           streamCanceller.signal);
              if (streamCanceller.isUsed()) {
                return; // The stream has been cancelled
              }
            }
          }
        } else if (segmentBufferStatus.type === "uninitialized") {
          segmentBuffersStore.disableSegmentBuffer(bufferType);
          if (streamCanceller.isUsed()) {
            return; // The stream has been cancelled
          }
        }

        callbacks.adaptationChange({ type: bufferType, adaptation: null, period });
        if (streamCanceller.isUsed()) {
          return; // Previous call has provoken Stream cancellation by side-effect
        }

        return createEmptyAdaptationStream(playbackObserver,
                                           wantedBufferAhead,
                                           bufferType,
                                           { period },
                                           callbacks,
                                           streamCanceller.signal);
      }

      /**
       * If this is not the first Adaptation choice, we might want to apply a
       * delta to the current position so we can re-play back some media in the
       * new Adaptation to give some context back.
       * This value contains this relative position, in seconds.
       * @see askForMediaSourceReload
       */
      const { DELTA_POSITION_AFTER_RELOAD } = config.getCurrent();
      const relativePosAfterSwitch =
        isFirstAdaptationSwitch ? 0 :
        bufferType === "audio"  ? DELTA_POSITION_AFTER_RELOAD.trackSwitch.audio :
        bufferType === "video"  ? DELTA_POSITION_AFTER_RELOAD.trackSwitch.video :
                                  DELTA_POSITION_AFTER_RELOAD.trackSwitch.other;
      isFirstAdaptationSwitch = false;

      if (SegmentBuffersStore.isNative(bufferType) &&
          segmentBuffersStore.getStatus(bufferType).type === "disabled")
      {
        return askForMediaSourceReload(relativePosAfterSwitch,
                                       true,
                                       streamCanceller.signal);
      }

      log.info(`Stream: Updating ${bufferType} adaptation`,
               `A: ${adaptation.id}`,
               `P: ${period.start}`);

      callbacks.adaptationChange({ type: bufferType, adaptation, period });
      if (streamCanceller.isUsed()) {
        return; // Previous call has provoken cancellation by side-effect
      }

      const readyState = playbackObserver.getReadyState();
      const segmentBuffer = createOrReuseSegmentBuffer(segmentBuffersStore,
                                                       bufferType,
                                                       adaptation,
                                                       options);
      const playbackInfos = { currentTime: playbackObserver.getCurrentTime(),
                              readyState };
      const strategy = getAdaptationSwitchStrategy(segmentBuffer,
                                                   period,
                                                   adaptation,
                                                   playbackInfos,
                                                   options);
      if (strategy.type === "needs-reload") {
        return askForMediaSourceReload(relativePosAfterSwitch,
                                       true,
                                       streamCanceller.signal);
      }

      await segmentBuffersStore.waitForUsableBuffers(streamCanceller.signal);
      if (streamCanceller.isUsed()) {
        return; // The Stream has since been cancelled
      }
      if (strategy.type === "flush-buffer" || strategy.type === "clean-buffer") {
        for (const { start, end } of strategy.value) {
          await segmentBuffer.removeBuffer(start, end, streamCanceller.signal);
          if (streamCanceller.isUsed()) {
            return; // The Stream has since been cancelled
          }
        }
        if (strategy.type === "flush-buffer") {
          callbacks.needsBufferFlush();
          if (streamCanceller.isUsed()) {
            return ; // Previous callback cancelled the Stream by side-effect
          }
        }
      }

      garbageCollectors.get(segmentBuffer)(streamCanceller.signal);
      createAdaptationStream(adaptation, segmentBuffer, streamCanceller.signal);
    })().catch((err) => {
      if (err instanceof CancellationError) {
        return;
      }
      currentStreamCanceller?.cancel();
      callbacks.error(err);
    });
  }, { clearSignal: parentCancelSignal, emitCurrentValue: true });

  /**
   * @param {Object} adaptation
   * @param {Object} segmentBuffer
   * @param {Object} cancelSignal
   */
  function createAdaptationStream(
    adaptation : Adaptation,
    segmentBuffer : SegmentBuffer,
    cancelSignal : CancellationSignal
  ) : void {
    const { manifest } = content;
    const adaptationPlaybackObserver =
      createAdaptationStreamPlaybackObserver(playbackObserver, segmentBuffer);

    AdaptationStream({ content: { manifest, period, adaptation },
                       options,
                       playbackObserver: adaptationPlaybackObserver,
                       representationEstimator,
                       segmentBuffer,
                       segmentFetcherCreator,
                       wantedBufferAhead,
                       maxVideoBufferSize },
                     { ...callbacks, error: onAdaptationStreamError },
                     cancelSignal);

    function onAdaptationStreamError(error : unknown) : void {
      // Stream linked to a non-native media buffer should not impact the
      // stability of the player. ie: if a text buffer sends an error, we want
      // to continue playing without any subtitles
      if (!SegmentBuffersStore.isNative(bufferType)) {
        log.error(`Stream: ${bufferType} Stream crashed. Aborting it.`,
                  error instanceof Error ? error : "");
        segmentBuffersStore.disposeSegmentBuffer(bufferType);

        const formattedError = formatError(error, {
          defaultCode: "NONE",
          defaultReason: "Unknown `AdaptationStream` error",
        });
        callbacks.warning(formattedError);
        if (cancelSignal.isCancelled()) {
          return ; // Previous callback cancelled the Stream by side-effect
        }

        return createEmptyAdaptationStream(playbackObserver,
                                           wantedBufferAhead,
                                           bufferType,
                                           { period },
                                           callbacks,
                                           cancelSignal);
      }
      log.error(`Stream: ${bufferType} Stream crashed. Stopping playback.`,
                error instanceof Error ? error : "");
      callbacks.error(error);
    }
  }

  /**
   * Regularly ask to reload the MediaSource on each playback observation
   * performed by the playback observer.
   *
   * @param {number} timeOffset - Relative position, compared to the current
   * playhead, at which we should restart playback after reloading.
   * For example `-2` will reload 2 seconds before the current position.
   * @param {boolean} stayInPeriod - If `true`, we will control that the position
   * we reload at, after applying `timeOffset`, is still part of the Period
   * `period`.
   *
   * If it isn't we will re-calculate that reloaded position to be:
   *   - either the Period's start if the calculated position is before the
   *     Period's start.
   *   - either the Period'end start if the calculated position is after the
   *     Period's end.
   * @param {Object} cancelSignal
   */
  function askForMediaSourceReload(
    timeOffset : number,
    stayInPeriod: boolean,
    cancelSignal : CancellationSignal
  ) : void {
    // We begin by scheduling a micro-task to reduce the possibility of race
    // conditions where `askForMediaSourceReload` would be called synchronously before
    // the next observation (which may reflect very different playback conditions)
    // is actually received.
    // It can happen when `askForMediaSourceReload` is called as a side-effect of
    // the same event that triggers the playback observation to be emitted.
    nextTick(() => {
      playbackObserver.listen(() => {
        callbacks.waitingMediaSourceReload({ bufferType,
                                             period,
                                             timeOffset,
                                             stayInPeriod });
      }, { includeLastObservation: true, clearSignal: cancelSignal });
    });
  }
}

/**
 * @param {string} bufferType
 * @param {Object} adaptation
 * @returns {Object}
 */
function createOrReuseSegmentBuffer(
  segmentBuffersStore : SegmentBuffersStore,
  bufferType : IBufferType,
  adaptation : Adaptation,
  options: { textTrackOptions? : ITextTrackSegmentBufferOptions }
) : SegmentBuffer {
  const segmentBufferStatus = segmentBuffersStore.getStatus(bufferType);
  if (segmentBufferStatus.type === "initialized") {
    log.info("Stream: Reusing a previous SegmentBuffer for the type", bufferType);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return segmentBufferStatus.value;
  }
  const codec = getFirstDeclaredMimeType(adaptation);
  const sbOptions = bufferType === "text" ?  options.textTrackOptions : undefined;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return segmentBuffersStore.createSegmentBuffer(bufferType, codec, sbOptions);
}

/**
 * Get mime-type string of the first representation declared in the given
 * adaptation.
 * @param {Adaptation} adaptation
 * @returns {string}
 */
function getFirstDeclaredMimeType(adaptation : Adaptation) : string {
  const representations = adaptation.getPlayableRepresentations();
  if (representations.length === 0) {
    const noRepErr = new MediaError("NO_PLAYABLE_REPRESENTATION",
                                    "No Representation in the chosen " +
                                    adaptation.type + " Adaptation can be played",
                                    { adaptation });
    throw noRepErr;
  }
  return representations[0].getMimeTypeString();
}

/**
 * Create AdaptationStream's version of a playback observer.
 * @param {Object} initialPlaybackObserver
 * @param {Object} segmentBuffer
 * @returns {Object}
 */
function createAdaptationStreamPlaybackObserver(
  initialPlaybackObserver : IReadOnlyPlaybackObserver<IPeriodStreamPlaybackObservation>,
  segmentBuffer : SegmentBuffer
) : IReadOnlyPlaybackObserver<IAdaptationStreamPlaybackObservation> {
  return initialPlaybackObserver.deriveReadOnlyObserver(function transform(
    observationRef : IReadOnlySharedReference<IPeriodStreamPlaybackObservation>,
    cancellationSignal : CancellationSignal
  ) : IReadOnlySharedReference<IAdaptationStreamPlaybackObservation> {
    const newRef = new SharedReference(constructAdaptationStreamPlaybackObservation(),
                                       cancellationSignal);

    observationRef.onUpdate(emitAdaptationStreamPlaybackObservation, {
      clearSignal: cancellationSignal,
      emitCurrentValue: false,
    });
    return newRef;

    function constructAdaptationStreamPlaybackObservation(
    ) : IAdaptationStreamPlaybackObservation {
      const baseObservation = observationRef.getValue();
      const buffered = segmentBuffer.getBufferedRanges();
      const bufferGap = getLeftSizeOfRange(buffered, baseObservation.position.last);
      return objectAssign({}, baseObservation, { bufferGap });
    }

    function emitAdaptationStreamPlaybackObservation() {
      newRef.setValue(constructAdaptationStreamPlaybackObservation());
    }
  });

}

/**
 * Create empty AdaptationStream, linked to a Period.
 * This AdaptationStream will never download any segment and just emit a "full"
 * event when reaching the end.
 * @param {Object} playbackObserver
 * @param {Object} wantedBufferAhead
 * @param {string} bufferType
 * @param {Object} content
 * @param {Object} callbacks
 * @param {Object} cancelSignal
 */
function createEmptyAdaptationStream(
  playbackObserver : IReadOnlyPlaybackObserver<IPeriodStreamPlaybackObservation>,
  wantedBufferAhead : IReadOnlySharedReference<number>,
  bufferType : IBufferType,
  content : { period : Period },
  callbacks : Pick<IAdaptationStreamCallbacks<unknown>, "streamStatusUpdate">,
  cancelSignal : CancellationSignal
) : void {
  const { period } = content;
  let hasFinishedLoading = false;
  wantedBufferAhead.onUpdate(sendStatus,
                             { emitCurrentValue: false, clearSignal: cancelSignal });
  playbackObserver.listen(sendStatus,
                          { includeLastObservation: false, clearSignal: cancelSignal });
  sendStatus();

  function sendStatus() : void {
    const observation = playbackObserver.getReference().getValue();
    const wba = wantedBufferAhead.getValue();
    const position = observation.position.last;
    if (period.end !== undefined && position + wba >= period.end) {
      log.debug("Stream: full \"empty\" AdaptationStream", bufferType);
      hasFinishedLoading = true;
    }
    callbacks.streamStatusUpdate({ period,
                                   bufferType,
                                   position,
                                   imminentDiscontinuity: null,
                                   isEmptyStream: true,
                                   hasFinishedLoading,
                                   neededSegments: [] });
  }
}
