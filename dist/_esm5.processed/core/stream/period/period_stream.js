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
import { catchError, concat as observableConcat, defer as observableDefer, EMPTY, ignoreElements, map, merge as observableMerge, mergeMap, of as observableOf, ReplaySubject, startWith, switchMap, } from "rxjs";
import config from "../../../config";
import { formatError, MediaError, } from "../../../errors";
import log from "../../../log";
import objectAssign from "../../../utils/object_assign";
import { getLeftSizeOfRange } from "../../../utils/ranges";
import createSharedReference from "../../../utils/reference";
import fromCancellablePromise from "../../../utils/rx-from_cancellable_promise";
import TaskCanceller from "../../../utils/task_canceller";
import SegmentBuffersStore from "../../segment_buffers";
import AdaptationStream from "../adaptation";
import EVENTS from "../events_generators";
import reloadAfterSwitch from "../reload_after_switch";
import createEmptyStream from "./create_empty_adaptation_stream";
import getAdaptationSwitchStrategy from "./get_adaptation_switch_strategy";
/**
 * Create single PeriodStream Observable:
 *   - Lazily create (or reuse) a SegmentBuffer for the given type.
 *   - Create a Stream linked to an Adaptation each time it changes, to
 *     download and append the corresponding segments to the SegmentBuffer.
 *   - Announce when the Stream is full or is awaiting new Segments through
 *     events
 * @param {Object} args
 * @returns {Observable}
 */
export default function PeriodStream(_a) {
    var bufferType = _a.bufferType, content = _a.content, garbageCollectors = _a.garbageCollectors, playbackObserver = _a.playbackObserver, representationEstimator = _a.representationEstimator, segmentFetcherCreator = _a.segmentFetcherCreator, segmentBuffersStore = _a.segmentBuffersStore, options = _a.options, wantedBufferAhead = _a.wantedBufferAhead, maxVideoBufferSize = _a.maxVideoBufferSize;
    var period = content.period;
    // Emits the chosen Adaptation for the current type.
    // `null` when no Adaptation is chosen (e.g. no subtitles)
    var adaptation$ = new ReplaySubject(1);
    return adaptation$.pipe(switchMap(function (adaptation, switchNb) {
        /**
         * If this is not the first Adaptation choice, we might want to apply a
         * delta to the current position so we can re-play back some media in the
         * new Adaptation to give some context back.
         * This value contains this relative position, in seconds.
         * @see reloadAfterSwitch
         */
        var DELTA_POSITION_AFTER_RELOAD = config.getCurrent().DELTA_POSITION_AFTER_RELOAD;
        var relativePosAfterSwitch = switchNb === 0 ? 0 :
            bufferType === "audio" ? DELTA_POSITION_AFTER_RELOAD.trackSwitch.audio :
                bufferType === "video" ? DELTA_POSITION_AFTER_RELOAD.trackSwitch.video :
                    DELTA_POSITION_AFTER_RELOAD.trackSwitch.other;
        if (adaptation === null) { // Current type is disabled for that Period
            log.info("Stream: Set no ".concat(bufferType, " Adaptation. P:"), period.start);
            var segmentBufferStatus_1 = segmentBuffersStore.getStatus(bufferType);
            var cleanBuffer$ = void 0;
            if (segmentBufferStatus_1.type === "initialized") {
                log.info("Stream: Clearing previous ".concat(bufferType, " SegmentBuffer"));
                if (SegmentBuffersStore.isNative(bufferType)) {
                    return reloadAfterSwitch(period, bufferType, playbackObserver, 0);
                }
                var canceller_1 = new TaskCanceller();
                cleanBuffer$ = fromCancellablePromise(canceller_1, function () {
                    if (period.end === undefined) {
                        return segmentBufferStatus_1.value.removeBuffer(period.start, Infinity, canceller_1.signal);
                    }
                    else if (period.end <= period.start) {
                        return Promise.resolve();
                    }
                    else {
                        return segmentBufferStatus_1.value.removeBuffer(period.start, period.end, canceller_1.signal);
                    }
                });
            }
            else {
                if (segmentBufferStatus_1.type === "uninitialized") {
                    segmentBuffersStore.disableSegmentBuffer(bufferType);
                }
                cleanBuffer$ = observableOf(null);
            }
            return observableConcat(cleanBuffer$.pipe(map(function () { return EVENTS.adaptationChange(bufferType, null, period); })), createEmptyStream(playbackObserver, wantedBufferAhead, bufferType, { period: period }));
        }
        if (SegmentBuffersStore.isNative(bufferType) &&
            segmentBuffersStore.getStatus(bufferType).type === "disabled") {
            return reloadAfterSwitch(period, bufferType, playbackObserver, relativePosAfterSwitch);
        }
        log.info("Stream: Updating ".concat(bufferType, " adaptation"), "A: ".concat(adaptation.id), "P: ".concat(period.start));
        var newStream$ = observableDefer(function () {
            var readyState = playbackObserver.getReadyState();
            var segmentBuffer = createOrReuseSegmentBuffer(segmentBuffersStore, bufferType, adaptation, options);
            var playbackInfos = { currentTime: playbackObserver.getCurrentTime(), readyState: readyState };
            var strategy = getAdaptationSwitchStrategy(segmentBuffer, period, adaptation, playbackInfos, options);
            if (strategy.type === "needs-reload") {
                return reloadAfterSwitch(period, bufferType, playbackObserver, relativePosAfterSwitch);
            }
            var needsBufferFlush$ = strategy.type === "flush-buffer"
                ? observableOf(EVENTS.needsBufferFlush())
                : EMPTY;
            var cleanBuffer$ = strategy.type === "clean-buffer" || strategy.type === "flush-buffer" ?
                observableConcat.apply(void 0, strategy.value.map(function (_a) {
                    var start = _a.start, end = _a.end;
                    var canceller = new TaskCanceller();
                    return fromCancellablePromise(canceller, function () {
                        return segmentBuffer.removeBuffer(start, end, canceller.signal);
                    });
                })
                // NOTE As of now (RxJS 7.4.0), RxJS defines `ignoreElements` default
                // first type parameter as `any` instead of the perfectly fine `unknown`,
                // leading to linter issues, as it forbids the usage of `any`.
                // This is why we're disabling the eslint rule.
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-argument */
                ).pipe(ignoreElements()) : EMPTY;
            var bufferGarbageCollector$ = garbageCollectors.get(segmentBuffer);
            var adaptationStream$ = createAdaptationStream(adaptation, segmentBuffer);
            var cancelWait = new TaskCanceller();
            return fromCancellablePromise(cancelWait, function () {
                return segmentBuffersStore.waitForUsableBuffers(cancelWait.signal);
            }).pipe(mergeMap(function () {
                return observableConcat(cleanBuffer$, needsBufferFlush$, observableMerge(adaptationStream$, bufferGarbageCollector$));
            }));
        });
        return observableConcat(observableOf(EVENTS.adaptationChange(bufferType, adaptation, period)), newStream$);
    }), startWith(EVENTS.periodStreamReady(bufferType, period, adaptation$)));
    /**
     * @param {Object} adaptation
     * @param {Object} segmentBuffer
     * @returns {Observable}
     */
    function createAdaptationStream(adaptation, segmentBuffer) {
        var manifest = content.manifest;
        var adaptationPlaybackObserver = createAdaptationStreamPlaybackObserver(playbackObserver, segmentBuffer);
        return AdaptationStream({ content: { manifest: manifest, period: period, adaptation: adaptation }, options: options, playbackObserver: adaptationPlaybackObserver, representationEstimator: representationEstimator, segmentBuffer: segmentBuffer, segmentFetcherCreator: segmentFetcherCreator, wantedBufferAhead: wantedBufferAhead, maxVideoBufferSize: maxVideoBufferSize }).pipe(catchError(function (error) {
            // Stream linked to a non-native media buffer should not impact the
            // stability of the player. ie: if a text buffer sends an error, we want
            // to continue playing without any subtitles
            if (!SegmentBuffersStore.isNative(bufferType)) {
                log.error("Stream: ".concat(bufferType, " Stream crashed. Aborting it."), error instanceof Error ? error : "");
                segmentBuffersStore.disposeSegmentBuffer(bufferType);
                var formattedError = formatError(error, {
                    defaultCode: "NONE",
                    defaultReason: "Unknown `AdaptationStream` error",
                });
                return observableConcat(observableOf(EVENTS.warning(formattedError)), createEmptyStream(playbackObserver, wantedBufferAhead, bufferType, { period: period }));
            }
            log.error("Stream: ".concat(bufferType, " Stream crashed. Stopping playback."), error instanceof Error ? error : "");
            throw error;
        }));
    }
}
/**
 * @param {string} bufferType
 * @param {Object} adaptation
 * @returns {Object}
 */
function createOrReuseSegmentBuffer(segmentBuffersStore, bufferType, adaptation, options) {
    var segmentBufferStatus = segmentBuffersStore.getStatus(bufferType);
    if (segmentBufferStatus.type === "initialized") {
        log.info("Stream: Reusing a previous SegmentBuffer for the type", bufferType);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return segmentBufferStatus.value;
    }
    var codec = getFirstDeclaredMimeType(adaptation);
    var sbOptions = bufferType === "text" ? options.textTrackOptions : undefined;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return segmentBuffersStore.createSegmentBuffer(bufferType, codec, sbOptions);
}
/**
 * Get mime-type string of the first representation declared in the given
 * adaptation.
 * @param {Adaptation} adaptation
 * @returns {string}
 */
function getFirstDeclaredMimeType(adaptation) {
    var representations = adaptation.getPlayableRepresentations();
    if (representations.length === 0) {
        var noRepErr = new MediaError("NO_PLAYABLE_REPRESENTATION", "No Representation in the chosen " +
            adaptation.type + " Adaptation can be played");
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
function createAdaptationStreamPlaybackObserver(initialPlaybackObserver, segmentBuffer) {
    return initialPlaybackObserver.deriveReadOnlyObserver(function transform(observationRef, cancellationSignal) {
        var newRef = createSharedReference(constructAdaptationStreamPlaybackObservation());
        observationRef.onUpdate(emitAdaptationStreamPlaybackObservation, {
            clearSignal: cancellationSignal,
            emitCurrentValue: false,
        });
        cancellationSignal.register(function () {
            newRef.finish();
        });
        return newRef;
        function constructAdaptationStreamPlaybackObservation() {
            var baseObservation = observationRef.getValue();
            var buffered = segmentBuffer.getBufferedRanges();
            var bufferGap = getLeftSizeOfRange(buffered, baseObservation.position.last);
            return objectAssign({}, baseObservation, { bufferGap: bufferGap });
        }
        function emitAdaptationStreamPlaybackObservation() {
            newRef.setValue(constructAdaptationStreamPlaybackObservation());
        }
    });
}
