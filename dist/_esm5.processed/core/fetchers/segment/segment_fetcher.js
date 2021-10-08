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
import { Observable, } from "rxjs";
import config from "../../../config";
import { formatError } from "../../../errors";
import arrayIncludes from "../../../utils/array_includes";
import idGenerator from "../../../utils/id_generator";
import InitializationSegmentCache from "../../../utils/initialization_segment_cache";
import objectAssign from "../../../utils/object_assign";
import TaskCanceller from "../../../utils/task_canceller";
import errorSelector from "../utils/error_selector";
import { tryURLsWithBackoff } from "../utils/try_urls_with_backoff";
var DEFAULT_MAX_REQUESTS_RETRY_ON_ERROR = config.DEFAULT_MAX_REQUESTS_RETRY_ON_ERROR, DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE = config.DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE, INITIAL_BACKOFF_DELAY_BASE = config.INITIAL_BACKOFF_DELAY_BASE, MAX_BACKOFF_DELAY_BASE = config.MAX_BACKOFF_DELAY_BASE;
var generateRequestID = idGenerator();
/**
 * Create a function which will fetch and parse segments.
 * @param {string} bufferType
 * @param {Object} transport
 * @param {Subject} requests$
 * @param {Object} options
 * @returns {Function}
 */
export default function createSegmentFetcher(bufferType, pipeline, requests$, options) {
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
     * This function returns an Observable which will fetch the segment on
     * subscription.
     * This Observable will emit various events during that request lifecycle and
     * throw if the segment request(s) (including potential retries) fail.
     *
     * The Observable will automatically complete once no events are left to be
     * sent.
     * @param {Object} content
     * @returns {Observable}
     */
    return function fetchSegment(content) {
        var segment = content.segment;
        return new Observable(function (obs) {
            var _a;
            // Retrieve from cache if it exists
            var cached = cache !== undefined ? cache.get(content) :
                null;
            if (cached !== null) {
                obs.next({ type: "chunk",
                    parse: generateParserFunction(cached, false) });
                obs.next({ type: "chunk-complete" });
                obs.complete();
                return undefined;
            }
            var id = generateRequestID();
            requests$.next({ type: "requestBegin",
                value: { duration: segment.duration,
                    time: segment.time,
                    requestTimestamp: performance.now(), id: id } });
            var canceller = new TaskCanceller();
            var hasRequestEnded = false;
            var loaderCallbacks = {
                /**
                 * Callback called when the segment loader has progress information on
                 * the request.
                 * @param {Object} info
                 */
                onProgress: function (info) {
                    if (info.totalSize !== undefined && info.size < info.totalSize) {
                        requests$.next({ type: "progress",
                            value: { duration: info.duration,
                                size: info.size,
                                totalSize: info.totalSize,
                                timestamp: performance.now(), id: id } });
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
            tryURLsWithBackoff((_a = segment.mediaURLs) !== null && _a !== void 0 ? _a : [null], callLoaderWithUrl, objectAssign({ onRetry: onRetry }, options), canceller.signal)
                .then(function (res) {
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
                hasRequestEnded = true;
                obs.next({ type: "chunk-complete" });
                if ((res.resultType === "segment-loaded" ||
                    res.resultType === "chunk-complete") &&
                    res.resultData.size !== undefined &&
                    res.resultData.duration !== undefined) {
                    requests$.next({ type: "metrics",
                        value: { size: res.resultData.size,
                            duration: res.resultData.duration, content: content } });
                }
                if (!canceller.isUsed) {
                    // The current Observable could have been canceled as a result of one
                    // of the previous `next` calls. In that case, we don't want to send
                    // a "requestEnd" again as it has already been sent on cancellation.
                    //
                    // Note that we only perform this check for `"requestEnd"` on
                    // purpose. Observable's events should have been ignored by RxJS if
                    // the Observable has already been canceled and we don't care if
                    // `"metrics"` is sent there.
                    requests$.next({ type: "requestEnd", value: { id: id } });
                }
                obs.complete();
            })
                .catch(function (err) {
                hasRequestEnded = true;
                obs.error(errorSelector(err));
            });
            return function () {
                if (!hasRequestEnded) {
                    canceller.cancel();
                    requests$.next({ type: "requestEnd", value: { id: id } });
                }
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
                return function parse(initTimescale) {
                    var loaded = { data: data, isChunked: isChunked };
                    try {
                        return parseSegment(loaded, content, initTimescale);
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
                obs.next({ type: "warning",
                    value: errorSelector(err) });
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
    return { maxRetryRegular: bufferType === "image" ? 0 :
            maxRetryRegular !== null && maxRetryRegular !== void 0 ? maxRetryRegular : DEFAULT_MAX_REQUESTS_RETRY_ON_ERROR,
        maxRetryOffline: maxRetryOffline !== null && maxRetryOffline !== void 0 ? maxRetryOffline : DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE,
        baseDelay: lowLatencyMode ? INITIAL_BACKOFF_DELAY_BASE.LOW_LATENCY :
            INITIAL_BACKOFF_DELAY_BASE.REGULAR,
        maxDelay: lowLatencyMode ? MAX_BACKOFF_DELAY_BASE.LOW_LATENCY :
            MAX_BACKOFF_DELAY_BASE.REGULAR };
}
