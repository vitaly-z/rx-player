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
 * This file allows to create RepresentationStreams.
 *
 * A RepresentationStream downloads and push segment for a single
 * Representation (e.g. a single video stream of a given quality).
 * It chooses which segments should be downloaded according to the current
 * position and what is currently buffered.
 */
import nextTick from "next-tick";
import { combineLatest as observableCombineLatest, concat as observableConcat, defer as observableDefer, EMPTY, ignoreElements, merge as observableMerge, mergeMap, of as observableOf, share, startWith, Subject, take, takeWhile, withLatestFrom, } from "rxjs";
import log from "../../../log";
import assertUnreachable from "../../../utils/assert_unreachable";
import objectAssign from "../../../utils/object_assign";
import { createSharedReference } from "../../../utils/reference";
import EVENTS from "../events_generators";
import DownloadingQueue from "./downloading_queue";
import getBufferStatus from "./get_buffer_status";
import getSegmentPriority from "./get_segment_priority";
import pushInitSegment from "./push_init_segment";
import pushMediaSegment from "./push_media_segment";
/**
 * Build up buffer for a single Representation.
 *
 * Download and push segments linked to the given Representation according
 * to what is already in the SegmentBuffer and where the playback currently is.
 *
 * Multiple RepresentationStream observables can run on the same SegmentBuffer.
 * This allows for example smooth transitions between multiple periods.
 *
 * @param {Object} args
 * @returns {Observable}
 */
export default function RepresentationStream(_a) {
    var content = _a.content, options = _a.options, playbackObserver = _a.playbackObserver, segmentBuffer = _a.segmentBuffer, segmentFetcher = _a.segmentFetcher, terminate$ = _a.terminate$;
    var period = content.period, adaptation = content.adaptation, representation = content.representation;
    var bufferGoal$ = options.bufferGoal$, drmSystemId = options.drmSystemId, fastSwitchThreshold$ = options.fastSwitchThreshold$;
    var bufferType = adaptation.type;
    /** Saved initialization segment state for this representation. */
    var initSegmentState = {
        segment: representation.index.getInitSegment(),
        segmentData: null,
        isLoaded: false,
    };
    /** Allows to manually re-check which segments are needed. */
    var reCheckNeededSegments$ = new Subject();
    /** Emit the last scheduled downloading queue for segments. */
    var lastSegmentQueue = createSharedReference({
        initSegment: null,
        segmentQueue: [],
    });
    var hasInitSegment = initSegmentState.segment !== null;
    /** Will load every segments in `lastSegmentQueue` */
    var downloadingQueue = new DownloadingQueue(content, lastSegmentQueue, segmentFetcher, hasInitSegment);
    if (!hasInitSegment) {
        initSegmentState.segmentData = null;
        initSegmentState.isLoaded = true;
    }
    /**
     * `true` if the event notifying about encryption data has already been
     * constructed.
     * Allows to avoid sending multiple times protection events.
     */
    var hasSentEncryptionData = false;
    var encryptionEvent$ = EMPTY;
    if (drmSystemId !== undefined) {
        var encryptionData = representation.getEncryptionData(drmSystemId);
        if (encryptionData.length > 0) {
            encryptionEvent$ = observableOf.apply(void 0, encryptionData.map(function (d) {
                return EVENTS.encryptionDataEncountered(d);
            }));
            hasSentEncryptionData = true;
        }
    }
    /** Observable loading and pushing segments scheduled through `lastSegmentQueue`. */
    var queue$ = downloadingQueue.start()
        .pipe(mergeMap(onQueueEvent));
    /** Observable emitting the stream "status" and filling `lastSegmentQueue`. */
    var status$ = observableCombineLatest([
        playbackObserver.observe(true),
        bufferGoal$,
        terminate$.pipe(take(1), startWith(null)),
        reCheckNeededSegments$.pipe(startWith(undefined)),
    ]).pipe(withLatestFrom(fastSwitchThreshold$), mergeMap(function (_a) {
        var _b = _a[0], observation = _b[0], bufferGoal = _b[1], terminate = _b[2], fastSwitchThreshold = _a[1];
        var wantedStartPosition = observation.position + observation.wantedTimeOffset;
        var status = getBufferStatus(content, wantedStartPosition, playbackObserver, fastSwitchThreshold, bufferGoal, segmentBuffer);
        var neededSegments = status.neededSegments;
        var neededInitSegment = null;
        // Add initialization segment if required
        if (!representation.index.isInitialized()) {
            if (initSegmentState.segment === null) {
                log.warn("Stream: Uninitialized index without an initialization segment");
            }
            else if (initSegmentState.isLoaded) {
                log.warn("Stream: Uninitialized index with an already loaded " +
                    "initialization segment");
            }
            else {
                var wantedStart = observation.position + observation.wantedTimeOffset;
                neededInitSegment = { segment: initSegmentState.segment,
                    priority: getSegmentPriority(period.start, wantedStart) };
            }
        }
        else if (neededSegments.length > 0 &&
            !initSegmentState.isLoaded &&
            initSegmentState.segment !== null) {
            var initSegmentPriority = neededSegments[0].priority;
            neededInitSegment = { segment: initSegmentState.segment,
                priority: initSegmentPriority };
        }
        if (terminate === null) {
            lastSegmentQueue.setValue({ initSegment: neededInitSegment,
                segmentQueue: neededSegments });
        }
        else if (terminate.urgent) {
            log.debug("Stream: Urgent switch, terminate now.", bufferType);
            lastSegmentQueue.setValue({ initSegment: null, segmentQueue: [] });
            lastSegmentQueue.finish();
            return observableOf(EVENTS.streamTerminating());
        }
        else {
            // Non-urgent termination wanted:
            // End the download of the current media segment if pending and
            // terminate once either that request is finished or another segment
            // is wanted instead, whichever comes first.
            var mostNeededSegment = neededSegments[0];
            var initSegmentRequest = downloadingQueue.getRequestedInitSegment();
            var currentSegmentRequest = downloadingQueue.getRequestedMediaSegment();
            var nextQueue = currentSegmentRequest === null ||
                mostNeededSegment === undefined ||
                currentSegmentRequest.id !== mostNeededSegment.segment.id ?
                [] :
                [mostNeededSegment];
            var nextInit = initSegmentRequest === null ? null :
                neededInitSegment;
            lastSegmentQueue.setValue({ initSegment: nextInit,
                segmentQueue: nextQueue });
            if (nextQueue.length === 0 && nextInit === null) {
                log.debug("Stream: No request left, terminate", bufferType);
                lastSegmentQueue.finish();
                return observableOf(EVENTS.streamTerminating());
            }
        }
        var bufferStatusEvt = observableOf({ type: "stream-status",
            value: { period: period, position: observation.position, bufferType: bufferType, imminentDiscontinuity: status.imminentDiscontinuity,
                hasFinishedLoading: status.hasFinishedLoading,
                neededSegments: status.neededSegments } });
        return status.shouldRefreshManifest ?
            observableConcat(observableOf(EVENTS.needsManifestRefresh()), bufferStatusEvt) :
            bufferStatusEvt;
    }), takeWhile(function (e) { return e.type !== "stream-terminating"; }, true));
    return observableMerge(status$, queue$, encryptionEvent$).pipe(share());
    /**
     * React to event from the `DownloadingQueue`.
     * @param {Object} evt
     * @returns {Observable}
     */
    function onQueueEvent(evt) {
        switch (evt.type) {
            case "retry":
                return observableConcat(observableOf({ type: "warning", value: evt.value.error }), observableDefer(function () {
                    var retriedSegment = evt.value.segment;
                    var index = representation.index;
                    if (index.isSegmentStillAvailable(retriedSegment) === false) {
                        reCheckNeededSegments$.next();
                    }
                    else if (index.canBeOutOfSyncError(evt.value.error, retriedSegment)) {
                        return observableOf(EVENTS.manifestMightBeOufOfSync());
                    }
                    return EMPTY; // else, ignore.
                }));
            case "parsed-init":
            case "parsed-media":
                return onParsedChunk(evt);
            case "end-of-segment": {
                var segment = evt.value.segment;
                return segmentBuffer.endOfSegment(objectAssign({ segment: segment }, content))
                    .pipe(ignoreElements());
            }
            case "end-of-queue":
                reCheckNeededSegments$.next();
                return EMPTY;
            default:
                assertUnreachable(evt);
        }
    }
    /**
     * Process a chunk that has just been parsed by pushing it to the
     * SegmentBuffer and emitting the right events.
     * @param {Object} evt
     * @returns {Observable}
     */
    function onParsedChunk(evt) {
        if (evt.segmentType === "init") {
            nextTick(function () {
                reCheckNeededSegments$.next();
            });
            initSegmentState.segmentData = evt.initializationData;
            initSegmentState.isLoaded = true;
            // Now that the initialization segment has been parsed - which may have
            // included encryption information - take care of the encryption event
            // if not already done.
            var allEncryptionData = representation.getAllEncryptionData();
            var initEncEvt$ = !hasSentEncryptionData &&
                allEncryptionData.length > 0 ? observableOf.apply(void 0, allEncryptionData.map(function (p) {
                return EVENTS.encryptionDataEncountered(p);
            })) :
                EMPTY;
            var pushEvent$ = pushInitSegment({ playbackObserver: playbackObserver, content: content, segment: evt.segment,
                segmentData: evt.initializationData, segmentBuffer: segmentBuffer });
            return observableMerge(initEncEvt$, pushEvent$);
        }
        else {
            var inbandEvents = evt.inbandEvents, needsManifestRefresh = evt.needsManifestRefresh, protectionDataUpdate = evt.protectionDataUpdate;
            // TODO better handle use cases like key rotation by not always grouping
            // every protection data together? To check.
            var segmentEncryptionEvent$ = protectionDataUpdate &&
                !hasSentEncryptionData ? observableOf.apply(void 0, representation.getAllEncryptionData().map(function (p) {
                return EVENTS.encryptionDataEncountered(p);
            })) :
                EMPTY;
            var manifestRefresh$ = needsManifestRefresh === true ?
                observableOf(EVENTS.needsManifestRefresh()) :
                EMPTY;
            var inbandEvents$ = inbandEvents !== undefined &&
                inbandEvents.length > 0 ?
                observableOf({ type: "inband-events",
                    value: inbandEvents }) :
                EMPTY;
            var initSegmentData = initSegmentState.segmentData;
            var pushMediaSegment$ = pushMediaSegment({ playbackObserver: playbackObserver, content: content, initSegmentData: initSegmentData, parsedSegment: evt,
                segment: evt.segment, segmentBuffer: segmentBuffer });
            return observableConcat(segmentEncryptionEvent$, manifestRefresh$, inbandEvents$, pushMediaSegment$);
        }
    }
}
