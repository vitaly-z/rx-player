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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { combineLatest, concat as observableConcat, defer as observableDefer, distinctUntilChanged, EMPTY, exhaustMap, filter, ignoreElements, map, merge as observableMerge, mergeMap, Observable, of as observableOf, share, startWith, Subject, take, takeUntil, tap, } from "rxjs";
import config from "../../../config";
import { MediaError } from "../../../errors";
import log from "../../../log";
import deferSubscriptions from "../../../utils/defer_subscriptions";
import { fromEvent } from "../../../utils/event_emitter";
import filterMap from "../../../utils/filter_map";
import { createMappedReference, } from "../../../utils/reference";
import fromCancellablePromise from "../../../utils/rx-from_cancellable_promise";
import nextTickObs from "../../../utils/rx-next-tick";
import SortedList from "../../../utils/sorted_list";
import TaskCanceller from "../../../utils/task_canceller";
import WeakMapMemory from "../../../utils/weak_map_memory";
import { BufferGarbageCollector, } from "../../segment_buffers";
import EVENTS from "../events_generators";
import PeriodStream from "../period";
import ActivePeriodEmitter from "./active_period_emitter";
import areStreamsComplete from "./are_streams_complete";
import getTimeRangesForContent from "./get_time_ranges_for_content";
/**
 * Create and manage the various Stream Observables needed for the content to
 * play:
 *
 *   - Create or dispose SegmentBuffers depending on the chosen Adaptations.
 *
 *   - Push the right segments to those SegmentBuffers depending on the user's
 *     preferences, the current position, the bandwidth, the decryption
 *     conditions...
 *
 *   - Concatenate Streams for adaptation from separate Periods at the right
 *     time, to allow smooth transitions between periods.
 *
 *   - Emit various events to notify of its health and issues
 *
 * @param {Object} content
 * @param {Observable} playbackObserver - Emit position information
 * @param {Object} representationEstimator - Emit bitrate estimates and best
 * Representation to play.
 * @param {Object} segmentBuffersStore - Will be used to lazily create
 * SegmentBuffer instances associated with the current content.
 * @param {Object} segmentFetcherCreator - Allow to download segments.
 * @param {Object} options
 * @returns {Observable}
 */
export default function StreamOrchestrator(content, playbackObserver, representationEstimator, segmentBuffersStore, segmentFetcherCreator, options) {
    var manifest = content.manifest, initialPeriod = content.initialPeriod;
    var maxBufferAhead = options.maxBufferAhead, maxBufferBehind = options.maxBufferBehind, wantedBufferAhead = options.wantedBufferAhead, maxVideoBufferSize = options.maxVideoBufferSize;
    var _a = config.getCurrent(), MAXIMUM_MAX_BUFFER_AHEAD = _a.MAXIMUM_MAX_BUFFER_AHEAD, MAXIMUM_MAX_BUFFER_BEHIND = _a.MAXIMUM_MAX_BUFFER_BEHIND;
    // Keep track of a unique BufferGarbageCollector created per
    // SegmentBuffer.
    var garbageCollectors = new WeakMapMemory(function (segmentBuffer) {
        var bufferType = segmentBuffer.bufferType;
        var defaultMaxBehind = MAXIMUM_MAX_BUFFER_BEHIND[bufferType] != null ?
            MAXIMUM_MAX_BUFFER_BEHIND[bufferType] :
            Infinity;
        var defaultMaxAhead = MAXIMUM_MAX_BUFFER_AHEAD[bufferType] != null ?
            MAXIMUM_MAX_BUFFER_AHEAD[bufferType] :
            Infinity;
        return new Observable(function () {
            var canceller = new TaskCanceller();
            BufferGarbageCollector({ segmentBuffer: segmentBuffer, playbackObserver: playbackObserver, maxBufferBehind: createMappedReference(maxBufferBehind, function (val) {
                    return Math.min(val, defaultMaxBehind);
                }, canceller.signal),
                maxBufferAhead: createMappedReference(maxBufferAhead, function (val) {
                    return Math.min(val, defaultMaxAhead);
                }, canceller.signal) }, canceller.signal);
            return function () { canceller.cancel(); };
        });
    });
    // Every PeriodStreams for every possible types
    var streamsArray = segmentBuffersStore.getBufferTypes().map(function (bufferType) {
        return manageEveryStreams(bufferType, initialPeriod)
            .pipe(deferSubscriptions(), share());
    });
    // Emits the activePeriodChanged events every time the active Period changes.
    var activePeriodChanged$ = ActivePeriodEmitter(streamsArray).pipe(filter(function (period) { return period !== null; }), map(function (period) {
        log.info("Stream: New active period", period.start);
        return EVENTS.activePeriodChanged(period);
    }));
    var isLastPeriodKnown$ = fromEvent(manifest, "manifestUpdate").pipe(map(function () { return manifest.isLastPeriodKnown; }), startWith(manifest.isLastPeriodKnown), distinctUntilChanged());
    // Emits an "end-of-stream" event once every PeriodStream are complete.
    // Emits a 'resume-stream" when it's not
    var endOfStream$ = combineLatest([areStreamsComplete.apply(void 0, streamsArray), isLastPeriodKnown$])
        .pipe(map(function (_a) {
        var areComplete = _a[0], isLastPeriodKnown = _a[1];
        return areComplete && isLastPeriodKnown;
    }), distinctUntilChanged(), map(function (emitEndOfStream) {
        return emitEndOfStream ? EVENTS.endOfStream() : EVENTS.resumeStream();
    }));
    return observableMerge.apply(void 0, __spreadArray(__spreadArray([], streamsArray, false), [activePeriodChanged$, endOfStream$], false));
    /**
     * Manage creation and removal of Streams for every Periods for a given type.
     *
     * Works by creating consecutive Streams through the
     * `manageConsecutivePeriodStreams` function, and restarting it when the
     * current position goes out of the bounds of these Streams.
     * @param {string} bufferType - e.g. "audio" or "video"
     * @param {Period} basePeriod - Initial Period downloaded.
     * @returns {Observable}
     */
    function manageEveryStreams(bufferType, basePeriod) {
        // Each Period for which there is currently a Stream, chronologically
        var periodList = new SortedList(function (a, b) { return a.start - b.start; });
        var destroyStreams$ = new Subject();
        // When set to `true`, all the currently active PeriodStream will be destroyed
        // and re-created from the new current position if we detect it to be out of
        // their bounds.
        // This is set to false when we're in the process of creating the first
        // PeriodStream, to avoid interferences while no PeriodStream is available.
        var enableOutOfBoundsCheck = false;
        /**
         * @param {Object} period
         * @returns {Observable}
         */
        function launchConsecutiveStreamsForPeriod(period) {
            return manageConsecutivePeriodStreams(bufferType, period, destroyStreams$).pipe(map(function (message) {
                switch (message.type) {
                    case "waiting-media-source-reload":
                        // Only reload the MediaSource when the more immediately required
                        // Period is the one asking for it
                        var firstPeriod = periodList.head();
                        if (firstPeriod === undefined ||
                            firstPeriod.id !== message.value.period.id) {
                            return EVENTS.lockedStream(message.value.bufferType, message.value.period);
                        }
                        else {
                            var _a = message.value, position = _a.position, autoPlay = _a.autoPlay;
                            return EVENTS.needsMediaSourceReload(position, autoPlay);
                        }
                    case "periodStreamReady":
                        enableOutOfBoundsCheck = true;
                        periodList.add(message.value.period);
                        break;
                    case "periodStreamCleared":
                        periodList.removeElement(message.value.period);
                        break;
                }
                return message;
            }), share());
        }
        /**
         * Returns true if the given time is either:
         *   - less than the start of the chronologically first Period
         *   - more than the end of the chronologically last Period
         * @param {number} time
         * @returns {boolean}
         */
        function isOutOfPeriodList(time) {
            var head = periodList.head();
            var last = periodList.last();
            if (head == null || last == null) { // if no period
                return true;
            }
            return head.start > time ||
                (last.end == null ? Infinity :
                    last.end) < time;
        }
        // Restart the current Stream when the wanted time is in another period
        // than the ones already considered
        var observation$ = playbackObserver.getReference().asObservable();
        var restartStreamsWhenOutOfBounds$ = observation$.pipe(filterMap(function (_a) {
            var _b, _c;
            var position = _a.position;
            var time = (_b = position.pending) !== null && _b !== void 0 ? _b : position.last;
            if (!enableOutOfBoundsCheck || !isOutOfPeriodList(time)) {
                return null;
            }
            var nextPeriod = (_c = manifest.getPeriodForTime(time)) !== null && _c !== void 0 ? _c : manifest.getNextPeriod(time);
            if (nextPeriod === undefined) {
                return null;
            }
            log.info("SO: Current position out of the bounds of the active periods," +
                "re-creating Streams.", bufferType, time);
            enableOutOfBoundsCheck = false;
            destroyStreams$.next();
            return nextPeriod;
        }, null), mergeMap(function (newInitialPeriod) {
            if (newInitialPeriod == null) {
                throw new MediaError("MEDIA_TIME_NOT_FOUND", "The wanted position is not found in the Manifest.");
            }
            return launchConsecutiveStreamsForPeriod(newInitialPeriod);
        }));
        var handleDecipherabilityUpdate$ = fromEvent(manifest, "decipherabilityUpdate")
            .pipe(mergeMap(onDecipherabilityUpdates));
        return observableMerge(restartStreamsWhenOutOfBounds$, handleDecipherabilityUpdate$, launchConsecutiveStreamsForPeriod(basePeriod));
        function onDecipherabilityUpdates(updates) {
            var segmentBufferStatus = segmentBuffersStore.getStatus(bufferType);
            var ofCurrentType = updates
                .filter(function (update) { return update.adaptation.type === bufferType; });
            if (ofCurrentType.length === 0 || segmentBufferStatus.type !== "initialized") {
                return EMPTY; // no need to stop the current Streams.
            }
            var segmentBuffer = segmentBufferStatus.value;
            var resettedContent = ofCurrentType.filter(function (update) {
                return update.representation.decipherable === undefined;
            });
            var undecipherableContent = ofCurrentType.filter(function (update) {
                return update.representation.decipherable === false;
            });
            /**
             * Time ranges now containing undecipherable content.
             * Those should first be removed and, depending on the platform, may
             * need Supplementary actions as playback issues may remain even after
             * removal.
             */
            var undecipherableRanges = getTimeRangesForContent(segmentBuffer, undecipherableContent);
            /**
             * Time ranges now containing content whose decipherability status came
             * back to being unknown.
             * To simplify its handling, those are just removed from the buffer.
             * Less considerations have to be taken than for the `undecipherableRanges`.
             */
            var rangesToRemove = getTimeRangesForContent(segmentBuffer, resettedContent);
            // First close all Stream currently active so they don't continue to
            // load and push segments.
            enableOutOfBoundsCheck = false;
            destroyStreams$.next();
            /** Remove from the `SegmentBuffer` all the concerned time ranges. */
            var cleanOperations = __spreadArray(__spreadArray([], undecipherableRanges, true), rangesToRemove, true).map(function (_a) {
                var start = _a.start, end = _a.end;
                if (start >= end) {
                    return EMPTY;
                }
                var canceller = new TaskCanceller();
                return fromCancellablePromise(canceller, function () {
                    return segmentBuffer.removeBuffer(start, end, canceller.signal);
                }).pipe(ignoreElements());
            });
            return observableConcat.apply(void 0, __spreadArray(__spreadArray([], cleanOperations, false), [
                // Schedule micro task before checking the last playback observation
                // to reduce the risk of race conditions where the next observation
                // was going to be emitted synchronously.
                nextTickObs().pipe(ignoreElements()),
                playbackObserver.getReference().asObservable().pipe(take(1), mergeMap(function (observation) {
                    var _a;
                    var restartStream$ = observableDefer(function () {
                        var _a;
                        var lastPosition = (_a = observation.position.pending) !== null && _a !== void 0 ? _a : observation.position.last;
                        var newInitialPeriod = manifest.getPeriodForTime(lastPosition);
                        if (newInitialPeriod == null) {
                            throw new MediaError("MEDIA_TIME_NOT_FOUND", "The wanted position is not found in the Manifest.");
                        }
                        return launchConsecutiveStreamsForPeriod(newInitialPeriod);
                    });
                    if (needsFlushingAfterClean(observation, undecipherableRanges)) {
                        var shouldAutoPlay = !((_a = observation.paused.pending) !== null && _a !== void 0 ? _a : playbackObserver.getIsPaused());
                        return observableConcat(observableOf(EVENTS.needsDecipherabilityFlush(observation.position.last, shouldAutoPlay, observation.duration)), restartStream$);
                    }
                    else if (needsFlushingAfterClean(observation, rangesToRemove)) {
                        return observableConcat(observableOf(EVENTS.needsBufferFlush()), restartStream$);
                    }
                    return restartStream$;
                }))], false));
        }
    }
    /**
     * Create lazily consecutive PeriodStreams:
     *
     * It first creates the PeriodStream for `basePeriod` and - once it becomes
     * full - automatically creates the next chronological one.
     * This process repeats until the PeriodStream linked to the last Period is
     * full.
     *
     * If an "old" PeriodStream becomes active again, it destroys all PeriodStream
     * coming after it (from the last chronological one to the first).
     *
     * To clean-up PeriodStreams, each one of them are also automatically
     * destroyed once the current position is superior or equal to the end of
     * the concerned Period.
     *
     * A "periodStreamReady" event is sent each times a new PeriodStream is
     * created. The first one (for `basePeriod`) should be sent synchronously on
     * subscription.
     *
     * A "periodStreamCleared" event is sent each times a PeriodStream is
     * destroyed.
     * @param {string} bufferType - e.g. "audio" or "video"
     * @param {Period} basePeriod - Initial Period downloaded.
     * @param {Observable} destroy$ - Emit when/if all created Streams from this
     * point should be destroyed.
     * @returns {Observable}
     */
    function manageConsecutivePeriodStreams(bufferType, basePeriod, destroy$) {
        log.info("SO: Creating new Stream for", bufferType, basePeriod.start);
        // Emits the Period of the next Period Stream when it can be created.
        var createNextPeriodStream$ = new Subject();
        // Emits when the Streams for the next Periods should be destroyed, if
        // created.
        var destroyNextStreams$ = new Subject();
        // Emits when the current position goes over the end of the current Stream.
        var endOfCurrentStream$ = playbackObserver.getReference().asObservable()
            .pipe(filter(function (_a) {
            var _b;
            var position = _a.position;
            return basePeriod.end != null &&
                ((_b = position.pending) !== null && _b !== void 0 ? _b : position.last) >= basePeriod.end;
        }));
        // Create Period Stream for the next Period.
        var nextPeriodStream$ = createNextPeriodStream$
            .pipe(exhaustMap(function (nextPeriod) {
            return manageConsecutivePeriodStreams(bufferType, nextPeriod, destroyNextStreams$);
        }));
        // Allows to destroy each created Stream, from the newest to the oldest,
        // once destroy$ emits.
        var destroyAll$ = destroy$.pipe(take(1), tap(function () {
            // first complete createNextStream$ to allow completion of the
            // nextPeriodStream$ observable once every further Streams have been
            // cleared.
            createNextPeriodStream$.complete();
            // emit destruction signal to the next Stream first
            destroyNextStreams$.next();
            destroyNextStreams$.complete(); // we do not need it anymore
        }), share() // share side-effects
        );
        // Will emit when the current Stream should be destroyed.
        var killCurrentStream$ = observableMerge(endOfCurrentStream$, destroyAll$);
        var periodStream$ = PeriodStream({ bufferType: bufferType, content: { manifest: manifest, period: basePeriod }, garbageCollectors: garbageCollectors, maxVideoBufferSize: maxVideoBufferSize, segmentFetcherCreator: segmentFetcherCreator, segmentBuffersStore: segmentBuffersStore, options: options, playbackObserver: playbackObserver, representationEstimator: representationEstimator, wantedBufferAhead: wantedBufferAhead }).pipe(mergeMap(function (evt) {
            if (evt.type === "stream-status") {
                if (evt.value.hasFinishedLoading) {
                    var nextPeriod = manifest.getPeriodAfter(basePeriod);
                    if (nextPeriod === null) {
                        return observableConcat(observableOf(evt), observableOf(EVENTS.streamComplete(bufferType)));
                    }
                    // current Stream is full, create the next one if not
                    createNextPeriodStream$.next(nextPeriod);
                }
                else {
                    // current Stream is active, destroy next Stream if created
                    destroyNextStreams$.next();
                }
            }
            return observableOf(evt);
        }), share());
        // Stream for the current Period.
        var currentStream$ = observableConcat(periodStream$.pipe(takeUntil(killCurrentStream$)), observableOf(EVENTS.periodStreamCleared(bufferType, basePeriod))
            .pipe(tap(function () {
            log.info("SO: Destroying Stream for", bufferType, basePeriod.start);
        })));
        return observableMerge(currentStream$, nextPeriodStream$, destroyAll$.pipe(ignoreElements()));
    }
}
/**
 * Returns `true` if low-level buffers have to be "flushed" after the given
 * `cleanedRanges` time ranges have been removed from an audio or video
 * SourceBuffer, to prevent playback issues.
 * @param {Object} observation
 * @param {Array.<Object>} cleanedRanges
 * @returns {boolean}
 */
function needsFlushingAfterClean(observation, cleanedRanges) {
    if (cleanedRanges.length === 0) {
        return false;
    }
    var curPos = observation.position.last;
    // Based on the playback direction, we just check whether we may encounter
    // the corresponding ranges, without seeking or re-switching playback
    // direction which is expected to lead to a low-level flush anyway.
    // There's a 5 seconds security, just to be sure.
    return observation.speed >= 0 ?
        cleanedRanges[cleanedRanges.length - 1].end >= curPos - 5 :
        cleanedRanges[0].start <= curPos + 5;
}
