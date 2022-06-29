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
import { Observable } from "rxjs";
import config from "../../../config";
import { formatError } from "../../../errors";
import log from "../../../log";
import { getLoggableSegmentId, } from "../../../manifest";
import arrayIncludes from "../../../utils/array_includes";
import idGenerator from "../../../utils/id_generator";
import InitializationSegmentCache from "../../../utils/initialization_segment_cache";
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
import objectAssign from "../../../utils/object_assign";
import TaskCanceller from "../../../utils/task_canceller";
import errorSelector from "../utils/error_selector";
import { tryURLsWithBackoff } from "../utils/try_urls_with_backoff";
var generateRequestID = idGenerator();
/**
 * Create an `ISegmentFetcher` object which will allow to easily fetch and parse
 * segments.
 * An `ISegmentFetcher` also implements a retry mechanism, based on the given
 * `options` argument, which may retry a segment request when it fails.
 *
 * @param {string} bufferType
 * @param {Object} transport
 * @param {Object} callbacks
 * @param {Object} options
 * @returns {Function}
 */
export default function createSegmentFetcher(bufferType, pipeline, callbacks, options) {
    /**
     * Cache audio and video initialization segments.
     * This allows to avoid doing too many requests for what are usually very
     * small files.
     */
    var cache = arrayIncludes(["audio", "video"], bufferType) ?
        new InitializationSegmentCache() :
        undefined;
    var loadSegment = pipeline.loadSegment, parseSegment = pipeline.parseSegment;
    /**
     * Fetch a specific segment.
     *
     * This function returns an Observable which will fetch segments on
     * subscription.
     * If the corresponding request fails, it may retry it based on the given
     * options.
     *
     * This Observable will emit various events during that request lifecycle and
     * throw if the segment request(s) (including potential retries) fail.
     * The Observable will automatically complete once no events are left to be
     * sent.
     * @param {Object} content
     * @returns {Observable}
     */
    return function fetchSegment(content) {
        var segment = content.segment;
        // used by logs
        var segmentIdString = getLoggableSegmentId(content);
        return new Observable(function (obs) {
            var _a, _b;
            var requestId = generateRequestID();
            var canceller = new TaskCanceller();
            /**
             * If the request succeeded, set to the corresponding
             * `IChunkCompleteInformation` object.
             * For any other completion cases: if the request either failed, was
             * cancelled or just if no request was needed, set to `null`.
             *
             * Stays to `undefined` when the request is still pending.
             */
            var requestInfo;
            /**
             * Array containing one entry per loaded chunk, in chronological order.
             * The boolean indicates if the chunk has been parsed at least once.
             *
             * This is used to know when all loaded chunks have been parsed, which
             * can be useful to e.g. construct metrics about the loaded segment.
             */
            var parsedChunks = [];
            /**
             * Addition of the duration of each encountered and parsed chunks.
             * Allows to have an idea of the real duration of the full segment once
             * all chunks have been parsed.
             *
             * `undefined` if at least one of the parsed chunks has unknown duration.
             */
            var segmentDurationAcc = 0;
            /** Set to `true` once network metrics have been sent. */
            var metricsSent = false;
            var loaderCallbacks = {
                /**
                 * Callback called when the segment loader has progress information on
                 * the request.
                 * @param {Object} info
                 */
                onProgress: function (info) {
                    var _a;
                    if (requestInfo !== undefined) {
                        return; // Request already terminated
                    }
                    if (info.totalSize !== undefined && info.size < info.totalSize) {
                        (_a = callbacks.onProgress) === null || _a === void 0 ? void 0 : _a.call(callbacks, { duration: info.duration,
                            size: info.size,
                            totalSize: info.totalSize,
                            timestamp: performance.now(),
                            id: requestId });
                    }
                },
                /**
                 * Callback called when the segment is communicated by the loader
                 * through decodable sub-segment(s) called chunk(s), with a chunk in
                 * argument.
                 * @param {*} chunkData
                 */
                onNewChunk: function (chunkData) {
                    obs.next({ type: "chunk",
                        parse: generateParserFunction(chunkData, true) });
                },
            };
            // Retrieve from cache if it exists
            var cached = cache !== undefined ? cache.get(content) :
                null;
            if (cached !== null) {
                log.debug("SF: Found wanted segment in cache", segmentIdString);
                obs.next({ type: "chunk",
                    parse: generateParserFunction(cached, false) });
                obs.next({ type: "chunk-complete" });
                obs.complete();
                return undefined;
            }
            log.debug("SF: Beginning request", segmentIdString);
            (_a = callbacks.onRequestBegin) === null || _a === void 0 ? void 0 : _a.call(callbacks, { requestTimestamp: performance.now(),
                id: requestId, content: content });
            tryURLsWithBackoff((_b = segment.mediaURLs) !== null && _b !== void 0 ? _b : [null], callLoaderWithUrl, objectAssign({ onRetry: onRetry }, options), canceller.signal)
                .then(function (res) {
                var _a;
                log.debug("SF: Segment request ended with success", segmentIdString);
                if (res.resultType === "segment-loaded") {
                    var loadedData = res.resultData.responseData;
                    if (cache !== undefined) {
                        cache.add(content, res.resultData.responseData);
                    }
                    obs.next({ type: "chunk",
                        parse: generateParserFunction(loadedData, false) });
                }
                else if (res.resultType === "segment-created") {
                    obs.next({ type: "chunk",
                        parse: generateParserFunction(res.resultData, false) });
                }
                log.debug("SF: Segment request ended with success", segmentIdString);
                obs.next({ type: "chunk-complete" });
                if (res.resultType !== "segment-created") {
                    requestInfo = res.resultData;
                    sendNetworkMetricsIfAvailable();
                }
                else {
                    requestInfo = null;
                }
                if (!canceller.isUsed) {
                    // The current Observable could have been canceled as a result of one
                    // of the previous `next` calls. In that case, we don't want to send
                    // a "requestEnd" again as it has already been sent on cancellation.
                    //
                    // Note that we only perform this check for `onRequestEnd` on
                    // purpose. Observable's events should have been ignored by RxJS if
                    // the Observable has already been canceled and we don't care if
                    // `"metrics"` is sent there.
                    (_a = callbacks.onRequestEnd) === null || _a === void 0 ? void 0 : _a.call(callbacks, { id: requestId });
                }
                obs.complete();
            })
                .catch(function (err) {
                log.debug("SF: Segment request failed", segmentIdString);
                requestInfo = null;
                obs.error(errorSelector(err));
            });
            return function () {
                var _a;
                if (requestInfo !== undefined) {
                    return; // Request already terminated
                }
                log.debug("SF: Segment request cancelled", segmentIdString);
                requestInfo = null;
                canceller.cancel();
                (_a = callbacks.onRequestEnd) === null || _a === void 0 ? void 0 : _a.call(callbacks, { id: requestId });
            };
            /**
             * Call a segment loader for the given URL with the right arguments.
             * @param {string|null} url
             * @param {Object} cancellationSignal
             * @returns {Promise}
             */
            function callLoaderWithUrl(url, cancellationSignal) {
                return loadSegment(url, content, cancellationSignal, loaderCallbacks);
            }
            /**
             * Generate function allowing to parse a loaded segment.
             * @param {*} data
             * @param {Boolean} isChunked
             * @returns {Function}
             */
            function generateParserFunction(data, isChunked) {
                parsedChunks.push(false);
                var parsedChunkId = parsedChunks.length - 1;
                return function parse(initTimescale) {
                    var loaded = { data: data, isChunked: isChunked };
                    try {
                        var parsed = parseSegment(loaded, content, initTimescale);
                        if (!parsedChunks[parsedChunkId]) {
                            segmentDurationAcc = segmentDurationAcc !== undefined &&
                                parsed.segmentType === "media" &&
                                parsed.chunkInfos !== null &&
                                parsed.chunkInfos.duration !== undefined ?
                                segmentDurationAcc + parsed.chunkInfos.duration :
                                undefined;
                            parsedChunks[parsedChunkId] = true;
                            sendNetworkMetricsIfAvailable();
                        }
                        return parsed;
                    }
                    catch (error) {
                        throw formatError(error, { defaultCode: "PIPELINE_PARSE_ERROR",
                            defaultReason: "Unknown parsing error" });
                    }
                };
            }
            /**
             * Function called when the function request is retried.
             * @param {*} err
             */
            function onRetry(err) {
                obs.next({ type: "retry",
                    value: errorSelector(err) });
            }
            /**
             * Send netork metrics if they haven't yet been sent and if all data to
             * define them is available.
             */
            function sendNetworkMetricsIfAvailable() {
                var _a;
                if (metricsSent) {
                    return;
                }
                if (!isNullOrUndefined(requestInfo) &&
                    requestInfo.size !== undefined &&
                    requestInfo.requestDuration !== undefined &&
                    parsedChunks.length > 0 &&
                    parsedChunks.every(function (isParsed) { return isParsed; })) {
                    metricsSent = true;
                    (_a = callbacks.onMetrics) === null || _a === void 0 ? void 0 : _a.call(callbacks, { size: requestInfo.size,
                        requestDuration: requestInfo.requestDuration, content: content, segmentDuration: segmentDurationAcc });
                }
            }
        });
    };
}
/**
 * @param {string} bufferType
 * @param {Object}
 * @returns {Object}
 */
export function getSegmentFetcherOptions(bufferType, _a) {
    var maxRetryRegular = _a.maxRetryRegular, maxRetryOffline = _a.maxRetryOffline, lowLatencyMode = _a.lowLatencyMode;
    var _b = config.getCurrent(), DEFAULT_MAX_REQUESTS_RETRY_ON_ERROR = _b.DEFAULT_MAX_REQUESTS_RETRY_ON_ERROR, DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE = _b.DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE, INITIAL_BACKOFF_DELAY_BASE = _b.INITIAL_BACKOFF_DELAY_BASE, MAX_BACKOFF_DELAY_BASE = _b.MAX_BACKOFF_DELAY_BASE;
    return { maxRetryRegular: bufferType === "image" ? 0 :
            maxRetryRegular !== null && maxRetryRegular !== void 0 ? maxRetryRegular : DEFAULT_MAX_REQUESTS_RETRY_ON_ERROR,
        maxRetryOffline: maxRetryOffline !== null && maxRetryOffline !== void 0 ? maxRetryOffline : DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE,
        baseDelay: lowLatencyMode ? INITIAL_BACKOFF_DELAY_BASE.LOW_LATENCY :
            INITIAL_BACKOFF_DELAY_BASE.REGULAR,
        maxDelay: lowLatencyMode ? MAX_BACKOFF_DELAY_BASE.LOW_LATENCY :
            MAX_BACKOFF_DELAY_BASE.REGULAR };
}
