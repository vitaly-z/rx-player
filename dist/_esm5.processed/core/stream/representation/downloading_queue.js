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
import { concat as observableConcat, defer as observableDefer, of as observableOf, merge as observableMerge, EMPTY, ReplaySubject, } from "rxjs";
import { filter, finalize, map, mergeMap, share, switchMap, take, } from "rxjs/operators";
import log from "../../../log";
import assert from "../../../utils/assert";
import assertUnreachable from "../../../utils/assert_unreachable";
import objectAssign from "../../../utils/object_assign";
/**
 * Class scheduling segment downloads for a single Representation.
 * @class DownloadingQueue
 */
var DownloadingQueue = /** @class */ (function () {
    /**
     * Create a new `DownloadingQueue`.
     *
     * @param {Object} content - The context of the Representation you want to
     * load segments for.
     * @param {Object} downloadQueue - Queue of segments you want to load.
     * @param {Object} segmentFetcher - Interface to facilitate the download of
     * segments.
     * @param {boolean} hasInitSegment - Declare that an initialization segment
     * will need to be downloaded.
     *
     * A `DownloadingQueue` ALWAYS wait for the initialization segment to be
     * loaded and parsed before parsing a media segment.
     *
     * In cases where no initialization segment exist, this would lead to the
     * `DownloadingQueue` waiting indefinitely for it.
     *
     * By setting that value to `false`, you anounce to the `DownloadingQueue`
     * that it should not wait for an initialization segment before parsing a
     * media segment.
     */
    function DownloadingQueue(content, downloadQueue, segmentFetcher, hasInitSegment) {
        this._content = content;
        this._currentObs$ = null;
        this._downloadQueue = downloadQueue;
        this._initSegmentRequest = null;
        this._mediaSegmentRequest = null;
        this._segmentFetcher = segmentFetcher;
        this._initSegmentMetadata$ = new ReplaySubject(1);
        this._mediaSegmentsAwaitingInitMetadata = new Set();
        if (!hasInitSegment) {
            this._initSegmentMetadata$.next(undefined);
        }
    }
    /**
     * Returns the initialization segment currently being requested.
     * Returns `null` if no initialization segment request is pending.
     * @returns {Object}
     */
    DownloadingQueue.prototype.getRequestedInitSegment = function () {
        return this._initSegmentRequest === null ? null :
            this._initSegmentRequest.segment;
    };
    /**
     * Returns the media segment currently being requested.
     * Returns `null` if no media segment request is pending.
     * @returns {Object}
     */
    DownloadingQueue.prototype.getRequestedMediaSegment = function () {
        return this._mediaSegmentRequest === null ? null :
            this._mediaSegmentRequest.segment;
    };
    /**
     * Start the current downloading queue, emitting events as it loads and parses
     * initialization and media segments.
     *
     * If it was already started, returns the same - shared - Observable.
     * @returns {Observable}
     */
    DownloadingQueue.prototype.start = function () {
        var _this = this;
        if (this._currentObs$ !== null) {
            return this._currentObs$;
        }
        var obs = observableDefer(function () {
            var mediaQueue$ = _this._downloadQueue.asObservable().pipe(filter(function (_a) {
                var segmentQueue = _a.segmentQueue;
                // First, the first elements of the segmentQueue might be already
                // loaded but awaiting the initialization segment to be parsed.
                // Filter those out.
                var nextSegmentToLoadIdx = 0;
                for (; nextSegmentToLoadIdx < segmentQueue.length; nextSegmentToLoadIdx++) {
                    var nextSegment = segmentQueue[nextSegmentToLoadIdx].segment;
                    if (!_this._mediaSegmentsAwaitingInitMetadata.has(nextSegment.id)) {
                        break;
                    }
                }
                var currentSegmentRequest = _this._mediaSegmentRequest;
                if (nextSegmentToLoadIdx >= segmentQueue.length) {
                    return currentSegmentRequest !== null;
                }
                else if (currentSegmentRequest === null) {
                    return true;
                }
                var nextItem = segmentQueue[nextSegmentToLoadIdx];
                if (currentSegmentRequest.segment.id !== nextItem.segment.id) {
                    return true;
                }
                if (currentSegmentRequest.priority !== nextItem.priority) {
                    _this._segmentFetcher.updatePriority(currentSegmentRequest.request$, nextItem.priority);
                }
                return false;
            }), switchMap(function (_a) {
                var segmentQueue = _a.segmentQueue;
                return segmentQueue.length > 0 ? _this._requestMediaSegments() :
                    EMPTY;
            }));
            var initSegmentPush$ = _this._downloadQueue.asObservable().pipe(filter(function (next) {
                var initSegmentRequest = _this._initSegmentRequest;
                if (next.initSegment !== null && initSegmentRequest !== null) {
                    if (next.initSegment.priority !== initSegmentRequest.priority) {
                        _this._segmentFetcher.updatePriority(initSegmentRequest.request$, next.initSegment.priority);
                    }
                    return false;
                }
                else {
                    return next.initSegment === null || initSegmentRequest === null;
                }
            }), switchMap(function (nextQueue) {
                if (nextQueue.initSegment === null) {
                    return EMPTY;
                }
                return _this._requestInitSegment(nextQueue.initSegment);
            }));
            return observableMerge(initSegmentPush$, mediaQueue$);
        }).pipe(share());
        this._currentObs$ = obs;
        return obs;
    };
    /**
     * Internal logic performing media segment requests.
     * @returns {Observable}
     */
    DownloadingQueue.prototype._requestMediaSegments = function () {
        var _this = this;
        var segmentQueue = this._downloadQueue.getValue().segmentQueue;
        var currentNeededSegment = segmentQueue[0];
        var recursivelyRequestSegments = function (startingSegment) {
            if (startingSegment === undefined) {
                return observableOf({ type: "end-of-queue",
                    value: null });
            }
            var segment = startingSegment.segment, priority = startingSegment.priority;
            var context = objectAssign({ segment: segment }, _this._content);
            var request$ = _this._segmentFetcher.createRequest(context, priority);
            _this._mediaSegmentRequest = { segment: segment, priority: priority, request$: request$ };
            return request$
                .pipe(mergeMap(function (evt) {
                switch (evt.type) {
                    case "warning":
                        return observableOf({ type: "retry",
                            value: { segment: segment, error: evt.value } });
                    case "interrupted":
                        log.info("Stream: segment request interrupted temporarly.", segment);
                        return EMPTY;
                    case "ended":
                        _this._mediaSegmentRequest = null;
                        var lastQueue = _this._downloadQueue.getValue().segmentQueue;
                        if (lastQueue.length === 0) {
                            return observableOf({ type: "end-of-queue",
                                value: null });
                        }
                        else if (lastQueue[0].segment.id === segment.id) {
                            lastQueue.shift();
                        }
                        return recursivelyRequestSegments(lastQueue[0]);
                    case "chunk":
                    case "chunk-complete":
                        _this._mediaSegmentsAwaitingInitMetadata.add(segment.id);
                        return _this._initSegmentMetadata$.pipe(take(1), map(function (initTimescale) {
                            if (evt.type === "chunk-complete") {
                                return { type: "end-of-segment",
                                    value: { segment: segment } };
                            }
                            var parsed = evt.parse(initTimescale);
                            assert(parsed.segmentType === "media", "Should have loaded a media segment.");
                            return objectAssign({}, parsed, { type: "parsed-media", segment: segment });
                        }), finalize(function () {
                            _this._mediaSegmentsAwaitingInitMetadata.delete(segment.id);
                        }));
                    default:
                        assertUnreachable(evt);
                }
            }));
        };
        return observableDefer(function () {
            return recursivelyRequestSegments(currentNeededSegment);
        }).pipe(finalize(function () { _this._mediaSegmentRequest = null; }));
    };
    /**
     * Internal logic performing initialization segment requests.
     * @param {Object} queuedInitSegment
     * @returns {Observable}
     */
    DownloadingQueue.prototype._requestInitSegment = function (queuedInitSegment) {
        var _this = this;
        if (queuedInitSegment === null) {
            this._initSegmentRequest = null;
            return EMPTY;
        }
        var segment = queuedInitSegment.segment, priority = queuedInitSegment.priority;
        var context = objectAssign({ segment: segment }, this._content);
        var request$ = this._segmentFetcher.createRequest(context, priority);
        this._initSegmentRequest = { segment: segment, priority: priority, request$: request$ };
        return request$
            .pipe(mergeMap(function (evt) {
            switch (evt.type) {
                case "warning":
                    return observableOf({ type: "retry",
                        value: { segment: segment, error: evt.value } });
                case "interrupted":
                    log.info("Stream: init segment request interrupted temporarly.", segment);
                    return EMPTY;
                case "chunk":
                    var parsed_1 = evt.parse(undefined);
                    assert(parsed_1.segmentType === "init", "Should have loaded an init segment.");
                    return observableConcat(observableOf(objectAssign({}, parsed_1, { type: "parsed-init", segment: segment })), 
                    // We want to emit parsing information strictly AFTER the
                    // initialization segment is emitted. Hence why we perform this
                    // side-effect a posteriori in a concat operator
                    observableDefer(function () {
                        if (parsed_1.segmentType === "init") {
                            _this._initSegmentMetadata$.next(parsed_1.initTimescale);
                        }
                        return EMPTY;
                    }));
                case "chunk-complete":
                    return observableOf({ type: "end-of-segment",
                        value: { segment: segment } });
                case "ended":
                    return EMPTY; // Do nothing, just here to check every case
                default:
                    assertUnreachable(evt);
            }
        })).pipe(finalize(function () { _this._initSegmentRequest = null; }));
    };
    return DownloadingQueue;
}());
export default DownloadingQueue;
