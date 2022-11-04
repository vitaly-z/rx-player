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
/**
 * This file allows to create `AdaptationStream`s.
 *
 * An `AdaptationStream` downloads and push segment for a single Adaptation
 * (e.g.  a single audio, video or text track).
 * It chooses which Representation to download mainly thanks to the
 * IRepresentationEstimator, and orchestrates a RepresentationStream,
 * which will download and push segments corresponding to a chosen
 * Representation.
 */
import { catchError, concat as observableConcat, defer as observableDefer, distinctUntilChanged, EMPTY, exhaustMap, filter, map, merge as observableMerge, mergeMap, Observable, of as observableOf, share, Subject, take, tap, } from "rxjs";
import config from "../../../config";
import { formatError } from "../../../errors";
import log from "../../../log";
import deferSubscriptions from "../../../utils/defer_subscriptions";
import { createSharedReference, } from "../../../utils/reference";
import TaskCanceller from "../../../utils/task_canceller";
import EVENTS from "../events_generators";
import reloadAfterSwitch from "../reload_after_switch";
import RepresentationStream from "../representation";
import createRepresentationEstimator from "./create_representation_estimator";
/**
 * Create new AdaptationStream Observable, which task will be to download the
 * media data for a given Adaptation (i.e. "track").
 *
 * It will rely on the IRepresentationEstimator to choose at any time the
 * best Representation for this Adaptation and then run the logic to download
 * and push the corresponding segments in the SegmentBuffer.
 *
 * After being subscribed to, it will start running and will emit various events
 * to report its current status.
 *
 * @param {Object} args
 * @returns {Observable}
 */
export default function AdaptationStream(_a) {
    var playbackObserver = _a.playbackObserver, content = _a.content, options = _a.options, representationEstimator = _a.representationEstimator, segmentBuffer = _a.segmentBuffer, segmentFetcherCreator = _a.segmentFetcherCreator, wantedBufferAhead = _a.wantedBufferAhead, maxVideoBufferSize = _a.maxVideoBufferSize;
    var directManualBitrateSwitching = options.manualBitrateSwitchingMode === "direct";
    var manifest = content.manifest, period = content.period, adaptation = content.adaptation;
    /**
     * The buffer goal ratio base itself on the value given by `wantedBufferAhead`
     * to determine a more dynamic buffer goal for a given Representation.
     *
     * It can help in cases such as : the current browser has issues with
     * buffering and tells us that we should try to bufferize less data :
     * https://developers.google.com/web/updates/2017/10/quotaexceedederror
     */
    var bufferGoalRatioMap = {};
    var currentRepresentation = createSharedReference(null);
    /** Errors when the adaptive logic fails with an error. */
    var abrErrorSubject = new Subject();
    var adaptiveCanceller = new TaskCanceller();
    var _b = createRepresentationEstimator(content, representationEstimator, currentRepresentation, playbackObserver, function (err) { abrErrorSubject.error(err); }, adaptiveCanceller.signal), estimateRef = _b.estimateRef, abrCallbacks = _b.abrCallbacks;
    /** Allows the `RepresentationStream` to easily fetch media segments. */
    var segmentFetcher = segmentFetcherCreator
        .createSegmentFetcher(adaptation.type, 
    /* eslint-disable @typescript-eslint/unbound-method */
    { onRequestBegin: abrCallbacks.requestBegin,
        onRequestEnd: abrCallbacks.requestEnd,
        onProgress: abrCallbacks.requestProgress,
        onMetrics: abrCallbacks.metrics });
    /* eslint-enable @typescript-eslint/unbound-method */
    /**
     * Stores the last estimate emitted through the `abrEstimate$` Observable,
     * starting with `null`.
     * This allows to easily rely on that value in inner Observables which might also
     * need the last already-considered value.
     */
    var lastEstimate = createSharedReference(null);
    /** Emits abr estimates on Subscription. */
    var abrEstimate$ = estimateRef.asObservable().pipe(tap(function (estimate) { lastEstimate.setValue(estimate); }), deferSubscriptions(), share());
    /** Emit at each bitrate estimate done by the IRepresentationEstimator. */
    var bitrateEstimate$ = abrEstimate$.pipe(filter(function (_a) {
        var bitrate = _a.bitrate;
        return bitrate != null;
    }), distinctUntilChanged(function (old, current) { return old.bitrate === current.bitrate; }), map(function (_a) {
        var bitrate = _a.bitrate;
        log.debug("Stream: new ".concat(adaptation.type, " bitrate estimate"), bitrate);
        return EVENTS.bitrateEstimationChange(adaptation.type, bitrate);
    }));
    /** Recursively create `RepresentationStream`s according to the last estimate. */
    var representationStreams$ = abrEstimate$
        .pipe(exhaustMap(function (estimate, i) {
        return recursivelyCreateRepresentationStreams(estimate, i === 0);
    }));
    return observableMerge(abrErrorSubject, representationStreams$, bitrateEstimate$, 
    // Cancel adaptive logic on unsubscription
    new Observable(function () { return function () { return adaptiveCanceller.cancel(); }; }));
    /**
     * Create `RepresentationStream`s starting with the Representation indicated in
     * `fromEstimate` argument.
     * Each time a new estimate is made, this function will create a new
     * `RepresentationStream` corresponding to that new estimate.
     * @param {Object} fromEstimate - The first estimate we should start with
     * @param {boolean} isFirstEstimate - Whether this is the first time we're
     * creating a RepresentationStream in the corresponding `AdaptationStream`.
     * This is important because manual quality switches might need a full reload
     * of the MediaSource _except_ if we are talking about the first quality chosen.
     * @returns {Observable}
     */
    function recursivelyCreateRepresentationStreams(fromEstimate, isFirstEstimate) {
        var representation = fromEstimate.representation;
        // A manual bitrate switch might need an immediate feedback.
        // To do that properly, we need to reload the MediaSource
        if (directManualBitrateSwitching &&
            fromEstimate.manual &&
            !isFirstEstimate) {
            var DELTA_POSITION_AFTER_RELOAD = config.getCurrent().DELTA_POSITION_AFTER_RELOAD;
            return reloadAfterSwitch(period, adaptation.type, playbackObserver, DELTA_POSITION_AFTER_RELOAD.bitrateSwitch);
        }
        /**
         * Emit when the current RepresentationStream should be terminated to make
         * place for a new one (e.g. when switching quality).
         */
        var terminateCurrentStream$ = lastEstimate.asObservable().pipe(filter(function (newEstimate) { return newEstimate === null ||
            newEstimate.representation.id !== representation.id ||
            (newEstimate.manual && !fromEstimate.manual); }), take(1), map(function (newEstimate) {
            if (newEstimate === null) {
                log.info("Stream: urgent Representation termination", adaptation.type);
                return ({ urgent: true });
            }
            if (newEstimate.urgent) {
                log.info("Stream: urgent Representation switch", adaptation.type);
                return ({ urgent: true });
            }
            else {
                log.info("Stream: slow Representation switch", adaptation.type);
                return ({ urgent: false });
            }
        }));
        /**
         * "Fast-switching" is a behavior allowing to replace low-quality segments
         * (i.e. with a low bitrate) with higher-quality segments (higher bitrate) in
         * the buffer.
         * This threshold defines a bitrate from which "fast-switching" is disabled.
         * For example with a fastSwitchThreshold set to `100`, segments with a
         * bitrate of `90` can be replaced. But segments with a bitrate of `100`
         * onward won't be replaced by higher quality segments.
         * Set to `undefined` to indicate that there's no threshold (anything can be
         * replaced by higher-quality segments).
         */
        var fastSwitchThreshold$ = !options.enableFastSwitching ?
            observableOf(0) : // Do not fast-switch anything
            lastEstimate.asObservable().pipe(map(function (estimate) { return estimate === null ? undefined :
                estimate.knownStableBitrate; }), distinctUntilChanged());
        var representationChange$ = observableOf(EVENTS.representationChange(adaptation.type, period, representation));
        return observableConcat(representationChange$, createRepresentationStream(representation, terminateCurrentStream$, fastSwitchThreshold$)).pipe(tap(function (evt) {
            if (evt.type === "added-segment") {
                abrCallbacks.addedSegment(evt.value);
            }
            if (evt.type === "representationChange") {
                currentRepresentation.setValue(evt.value.representation);
            }
        }), mergeMap(function (evt) {
            if (evt.type === "stream-terminating") {
                var estimate = lastEstimate.getValue();
                if (estimate === null) {
                    return EMPTY;
                }
                return recursivelyCreateRepresentationStreams(estimate, false);
            }
            return observableOf(evt);
        }));
    }
    /**
     * Create and returns a new RepresentationStream Observable, linked to the
     * given Representation.
     * @param {Representation} representation
     * @returns {Observable}
     */
    function createRepresentationStream(representation, terminateCurrentStream$, fastSwitchThreshold$) {
        return observableDefer(function () {
            var oldBufferGoalRatio = bufferGoalRatioMap[representation.id];
            var bufferGoalRatio = oldBufferGoalRatio != null ? oldBufferGoalRatio :
                1;
            bufferGoalRatioMap[representation.id] = bufferGoalRatio;
            var bufferGoal$ = wantedBufferAhead.asObservable().pipe(map(function (wba) { return wba * bufferGoalRatio; }));
            // eslint-disable-next-line max-len
            var maxBufferSize$ = adaptation.type === "video" ? maxVideoBufferSize.asObservable() :
                observableOf(Infinity);
            log.info("Stream: changing representation", adaptation.type, representation.id, representation.bitrate);
            return RepresentationStream({ playbackObserver: playbackObserver, content: { representation: representation, adaptation: adaptation, period: period, manifest: manifest }, segmentBuffer: segmentBuffer, segmentFetcher: segmentFetcher, terminate$: terminateCurrentStream$,
                options: { bufferGoal$: bufferGoal$, maxBufferSize$: maxBufferSize$, drmSystemId: options.drmSystemId, fastSwitchThreshold$: fastSwitchThreshold$ } })
                .pipe(catchError(function (err) {
                var formattedError = formatError(err, {
                    defaultCode: "NONE",
                    defaultReason: "Unknown `RepresentationStream` error",
                });
                if (formattedError.code === "BUFFER_FULL_ERROR") {
                    var wba = wantedBufferAhead.getValue();
                    var lastBufferGoalRatio = bufferGoalRatio;
                    if (lastBufferGoalRatio <= 0.25 || wba * lastBufferGoalRatio <= 2) {
                        throw formattedError;
                    }
                    bufferGoalRatioMap[representation.id] = lastBufferGoalRatio - 0.25;
                    return createRepresentationStream(representation, terminateCurrentStream$, fastSwitchThreshold$);
                }
                throw formattedError;
            }));
        });
    }
}
