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
import { defer as observableDefer, EMPTY, filter, finalize, merge as observableMerge, Observable, of as observableOf, share, switchMap, } from "rxjs";
import log from "../../../log";
import assert from "../../../utils/assert";
import objectAssign from "../../../utils/object_assign";
import createSharedReference from "../../../utils/reference";
import TaskCanceller from "../../../utils/task_canceller";
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
        this._initSegmentInfoRef = createSharedReference(undefined);
        this._mediaSegmentsAwaitingInitMetadata = new Set();
        if (!hasInitSegment) {
            this._initSegmentInfoRef.setValue(null);
        }
    }
    /**
     * Returns the initialization segment currently being requested.
     * Returns `null` if no initialization segment request is pending.
     * @returns {Object | null}
     */
    DownloadingQueue.prototype.getRequestedInitSegment = function () {
        return this._initSegmentRequest === null ? null :
            this._initSegmentRequest.segment;
    };
    /**
     * Returns the media segment currently being requested.
     * Returns `null` if no media segment request is pending.
     * @returns {Object | null}
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
                    _this._segmentFetcher.updatePriority(currentSegmentRequest.request, nextItem.priority);
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
                        _this._segmentFetcher.updatePriority(initSegmentRequest.request, next.initSegment.priority);
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
        /* eslint-disable-next-line @typescript-eslint/no-this-alias */
        var self = this;
        return observableDefer(function () {
            return recursivelyRequestSegments(currentNeededSegment);
        }).pipe(finalize(function () { _this._mediaSegmentRequest = null; }));
        function recursivelyRequestSegments(startingSegment) {
            if (startingSegment === undefined) {
                return observableOf({ type: "end-of-queue",
                    value: null });
            }
            var segment = startingSegment.segment, priority = startingSegment.priority;
            var context = objectAssign({ segment: segment }, self._content);
            return new Observable(function (obs) {
                /** TaskCanceller linked to this Observable's lifecycle. */
                var canceller = new TaskCanceller();
                /**
                 * If `true` , the Observable has either errored, completed, or was
                 * unsubscribed from.
                 * This only conserves the Observable for the current segment's request,
                 * not the other recursively-created future ones.
                 */
                var isComplete = false;
                /**
                 * Subscription to request the following segment (as this function is
                 * recursive).
                 * `undefined` if no following segment has been requested.
                 */
                var nextSegmentSubscription;
                /**
                 * If true, we're currently waiting for the initialization segment to be
                 * parsed before parsing a received chunk.
                 *
                 * In that case, the `DownloadingQueue` has to remain careful to only
                 * send further events and complete the Observable only once the
                 * initialization segment has been parsed AND the chunk parsing has been
                 * done (this can be done very simply by listening to the same
                 * `ISharedReference`, as its callbacks are called in the same order
                 * than the one in which they are added.
                 */
                var isWaitingOnInitSegment = false;
                /** Scheduled actual segment request. */
                var request = self._segmentFetcher.createRequest(context, priority, {
                    /**
                     * Callback called when the request has to be retried.
                     * @param {Error} error
                     */
                    onRetry: function (error) {
                        obs.next({ type: "retry", value: { segment: segment, error: error } });
                    },
                    /**
                     * Callback called when the request has to be interrupted and
                     * restarted later.
                     */
                    beforeInterrupted: function () {
                        log.info("Stream: segment request interrupted temporarly.", segment.id, segment.time);
                    },
                    /**
                     * Callback called when a decodable chunk of the segment is available.
                     * @param {Function} parse - Function allowing to parse the segment.
                     */
                    onChunk: function (parse) {
                        var initTimescale = self._initSegmentInfoRef.getValue();
                        if (initTimescale !== undefined) {
                            emitChunk(parse(initTimescale !== null && initTimescale !== void 0 ? initTimescale : undefined));
                        }
                        else {
                            isWaitingOnInitSegment = true;
                            // We could also technically call `waitUntilDefined` in both cases,
                            // but I found it globally clearer to segregate the two cases,
                            // especially to always have a meaningful `isWaitingOnInitSegment`
                            // boolean which is a very important variable.
                            self._initSegmentInfoRef.waitUntilDefined(function (actualTimescale) {
                                emitChunk(parse(actualTimescale !== null && actualTimescale !== void 0 ? actualTimescale : undefined));
                            }, { clearSignal: canceller.signal });
                        }
                    },
                    /** Callback called after all chunks have been sent. */
                    onAllChunksReceived: function () {
                        if (!isWaitingOnInitSegment) {
                            obs.next({ type: "end-of-segment",
                                value: { segment: segment } });
                        }
                        else {
                            self._mediaSegmentsAwaitingInitMetadata.add(segment.id);
                            self._initSegmentInfoRef.waitUntilDefined(function () {
                                obs.next({ type: "end-of-segment",
                                    value: { segment: segment } });
                                self._mediaSegmentsAwaitingInitMetadata.delete(segment.id);
                                isWaitingOnInitSegment = false;
                            }, { clearSignal: canceller.signal });
                        }
                    },
                    /**
                     * Callback called right after the request ended but before the next
                     * requests are scheduled. It is used to schedule the next segment.
                     */
                    beforeEnded: function () {
                        self._mediaSegmentRequest = null;
                        if (isWaitingOnInitSegment) {
                            self._initSegmentInfoRef.waitUntilDefined(continueToNextSegment, { clearSignal: canceller.signal });
                        }
                        else {
                            continueToNextSegment();
                        }
                    },
                }, canceller.signal);
                request.catch(function (error) {
                    if (!isComplete) {
                        isComplete = true;
                        obs.error(error);
                    }
                });
                self._mediaSegmentRequest = { segment: segment, priority: priority, request: request };
                return function () {
                    self._mediaSegmentsAwaitingInitMetadata.delete(segment.id);
                    if (nextSegmentSubscription !== undefined) {
                        nextSegmentSubscription.unsubscribe();
                    }
                    if (isComplete) {
                        return;
                    }
                    isComplete = true;
                    isWaitingOnInitSegment = false;
                    canceller.cancel();
                };
                function emitChunk(parsed) {
                    assert(parsed.segmentType === "media", "Should have loaded a media segment.");
                    obs.next(objectAssign({}, parsed, { type: "parsed-media", segment: segment }));
                }
                function continueToNextSegment() {
                    var lastQueue = self._downloadQueue.getValue().segmentQueue;
                    if (lastQueue.length === 0) {
                        obs.next({ type: "end-of-queue",
                            value: null });
                        isComplete = true;
                        obs.complete();
                        return;
                    }
                    else if (lastQueue[0].segment.id === segment.id) {
                        lastQueue.shift();
                    }
                    isComplete = true;
                    nextSegmentSubscription = recursivelyRequestSegments(lastQueue[0])
                        .subscribe(obs);
                }
            });
        }
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
        /* eslint-disable-next-line @typescript-eslint/no-this-alias */
        var self = this;
        return new Observable(function (obs) {
            /** TaskCanceller linked to this Observable's lifecycle. */
            var canceller = new TaskCanceller();
            var segment = queuedInitSegment.segment, priority = queuedInitSegment.priority;
            var context = objectAssign({ segment: segment }, _this._content);
            /**
             * If `true` , the Observable has either errored, completed, or was
             * unsubscribed from.
             */
            var isComplete = false;
            var request = _this._segmentFetcher.createRequest(context, priority, {
                onRetry: function (err) {
                    obs.next({ type: "retry",
                        value: { segment: segment, error: err } });
                },
                beforeInterrupted: function () {
                    log.info("Stream: init segment request interrupted temporarly.", segment.id);
                },
                beforeEnded: function () {
                    self._initSegmentRequest = null;
                    isComplete = true;
                    obs.complete();
                },
                onChunk: function (parse) {
                    var _a;
                    var parsed = parse(undefined);
                    assert(parsed.segmentType === "init", "Should have loaded an init segment.");
                    obs.next(objectAssign({}, parsed, { type: "parsed-init", segment: segment }));
                    if (parsed.segmentType === "init") {
                        self._initSegmentInfoRef.setValue((_a = parsed.initTimescale) !== null && _a !== void 0 ? _a : null);
                    }
                },
                onAllChunksReceived: function () {
                    obs.next({ type: "end-of-segment",
                        value: { segment: segment } });
                },
            }, canceller.signal);
            request.catch(function (error) {
                if (!isComplete) {
                    isComplete = true;
                    obs.error(error);
                }
            });
            _this._initSegmentRequest = { segment: segment, priority: priority, request: request };
            return function () {
                _this._initSegmentRequest = null;
                if (isComplete) {
                    return;
                }
                isComplete = true;
                canceller.cancel();
            };
        });
    };
    return DownloadingQueue;
}());
export default DownloadingQueue;
