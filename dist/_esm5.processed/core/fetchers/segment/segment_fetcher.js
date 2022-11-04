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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import config from "../../../config";
import { formatError } from "../../../errors";
import log from "../../../log";
import { getLoggableSegmentId, } from "../../../manifest";
import arrayIncludes from "../../../utils/array_includes";
import idGenerator from "../../../utils/id_generator";
import InitializationSegmentCache from "../../../utils/initialization_segment_cache";
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
import objectAssign from "../../../utils/object_assign";
import { CancellationError, } from "../../../utils/task_canceller";
import errorSelector from "../utils/error_selector";
import { scheduleRequestWithCdns } from "../utils/schedule_request";
/** Allows to generate a unique identifies for each request. */
var generateRequestID = idGenerator();
/**
 * Create an `ISegmentFetcher` object which will allow to easily fetch and parse
 * segments.
 * An `ISegmentFetcher` also implements a retry mechanism, based on the given
 * `options` argument, which may retry a segment request when it fails.
 *
 * @param {string} bufferType
 * @param {Object} pipeline
 * @param {Object} lifecycleCallbacks
 * @param {Object} options
 * @returns {Function}
 */
export default function createSegmentFetcher(bufferType, pipeline, cdnPrioritizer, lifecycleCallbacks, options) {
    var requestOptions = {
        timeout: options.requestTimeout < 0 ? undefined :
            options.requestTimeout,
    };
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
     * @param {Object} content
     * @param {Object} fetcherCallbacks
     * @param {Object} cancellationSignal
     * @returns {Promise}
     */
    return function fetchSegment(content, fetcherCallbacks, cancellationSignal) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            /**
             * Call a segment loader for the given URL with the right arguments.
             * @param {Object|null} cdnMetadata
             * @returns {Promise}
             */
            function callLoaderWithUrl(cdnMetadata) {
                return loadSegment(cdnMetadata, content, requestOptions, cancellationSignal, loaderCallbacks);
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
                fetcherCallbacks.onRetry(errorSelector(err));
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
                    (_a = lifecycleCallbacks.onMetrics) === null || _a === void 0 ? void 0 : _a.call(lifecycleCallbacks, {
                        size: requestInfo.size,
                        requestDuration: requestInfo.requestDuration,
                        content: content,
                        segmentDuration: segmentDurationAcc,
                    });
                }
            }
            var segmentIdString, requestId, requestInfo, parsedChunks, segmentDurationAcc, metricsSent, loaderCallbacks, cached, res, loadedData, err_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        segmentIdString = getLoggableSegmentId(content);
                        requestId = generateRequestID();
                        parsedChunks = [];
                        segmentDurationAcc = 0;
                        metricsSent = false;
                        loaderCallbacks = {
                            /**
                             * Callback called when the segment loader has progress information on
                             * the request.
                             * @param {Object} info
                             */
                            onProgress: function (info) {
                                var _a;
                                if (requestInfo !== undefined) {
                                    return; // request already termminated
                                }
                                if (info.totalSize !== undefined && info.size < info.totalSize) {
                                    (_a = lifecycleCallbacks.onProgress) === null || _a === void 0 ? void 0 : _a.call(lifecycleCallbacks, { duration: info.duration,
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
                                fetcherCallbacks.onChunk(generateParserFunction(chunkData, true));
                            },
                        };
                        cached = cache !== undefined ? cache.get(content) :
                            null;
                        if (cached !== null) {
                            log.debug("SF: Found wanted segment in cache", segmentIdString);
                            fetcherCallbacks.onChunk(generateParserFunction(cached, false));
                            return [2 /*return*/, Promise.resolve()];
                        }
                        log.debug("SF: Beginning request", segmentIdString);
                        (_a = lifecycleCallbacks.onRequestBegin) === null || _a === void 0 ? void 0 : _a.call(lifecycleCallbacks, { requestTimestamp: performance.now(),
                            id: requestId, content: content });
                        cancellationSignal.register(function () {
                            var _a;
                            if (requestInfo !== undefined) {
                                return; // Request already terminated
                            }
                            log.debug("SF: Segment request cancelled", segmentIdString);
                            requestInfo = null;
                            (_a = lifecycleCallbacks.onRequestEnd) === null || _a === void 0 ? void 0 : _a.call(lifecycleCallbacks, { id: requestId });
                        });
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, scheduleRequestWithCdns(content.representation.cdnMetadata, cdnPrioritizer, callLoaderWithUrl, objectAssign({ onRetry: onRetry }, options), cancellationSignal)];
                    case 2:
                        res = _c.sent();
                        if (res.resultType === "segment-loaded") {
                            loadedData = res.resultData.responseData;
                            if (cache !== undefined) {
                                cache.add(content, res.resultData.responseData);
                            }
                            fetcherCallbacks.onChunk(generateParserFunction(loadedData, false));
                        }
                        else if (res.resultType === "segment-created") {
                            fetcherCallbacks.onChunk(generateParserFunction(res.resultData, false));
                        }
                        log.debug("SF: Segment request ended with success", segmentIdString);
                        fetcherCallbacks.onAllChunksReceived();
                        if (res.resultType !== "segment-created") {
                            requestInfo = res.resultData;
                            sendNetworkMetricsIfAvailable();
                        }
                        else {
                            requestInfo = null;
                        }
                        if (!cancellationSignal.isCancelled) {
                            // The current task could have been canceled as a result of one
                            // of the previous callbacks call. In that case, we don't want to send
                            // a "requestEnd" again as it has already been sent on cancellation.
                            (_b = lifecycleCallbacks.onRequestEnd) === null || _b === void 0 ? void 0 : _b.call(lifecycleCallbacks, { id: requestId });
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _c.sent();
                        requestInfo = null;
                        if (err_1 instanceof CancellationError) {
                            log.debug("SF: Segment request aborted", segmentIdString);
                            throw err_1;
                        }
                        log.debug("SF: Segment request failed", segmentIdString);
                        throw errorSelector(err_1);
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
}
/**
 * @param {string} bufferType
 * @param {Object}
 * @returns {Object}
 */
export function getSegmentFetcherOptions(bufferType, _a) {
    var maxRetryRegular = _a.maxRetryRegular, maxRetryOffline = _a.maxRetryOffline, lowLatencyMode = _a.lowLatencyMode, requestTimeout = _a.requestTimeout;
    var _b = config.getCurrent(), DEFAULT_MAX_REQUESTS_RETRY_ON_ERROR = _b.DEFAULT_MAX_REQUESTS_RETRY_ON_ERROR, DEFAULT_REQUEST_TIMEOUT = _b.DEFAULT_REQUEST_TIMEOUT, DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE = _b.DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE, INITIAL_BACKOFF_DELAY_BASE = _b.INITIAL_BACKOFF_DELAY_BASE, MAX_BACKOFF_DELAY_BASE = _b.MAX_BACKOFF_DELAY_BASE;
    return { maxRetryRegular: bufferType === "image" ? 0 :
            maxRetryRegular !== null && maxRetryRegular !== void 0 ? maxRetryRegular : DEFAULT_MAX_REQUESTS_RETRY_ON_ERROR,
        maxRetryOffline: maxRetryOffline !== null && maxRetryOffline !== void 0 ? maxRetryOffline : DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE,
        baseDelay: lowLatencyMode ? INITIAL_BACKOFF_DELAY_BASE.LOW_LATENCY :
            INITIAL_BACKOFF_DELAY_BASE.REGULAR,
        maxDelay: lowLatencyMode ? MAX_BACKOFF_DELAY_BASE.LOW_LATENCY :
            MAX_BACKOFF_DELAY_BASE.REGULAR,
        requestTimeout: isNullOrUndefined(requestTimeout) ? DEFAULT_REQUEST_TIMEOUT :
            requestTimeout };
}
