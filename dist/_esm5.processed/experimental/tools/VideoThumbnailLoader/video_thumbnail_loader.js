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
import createSegmentFetcher from "../../../core/fetchers/segment/segment_fetcher";
import log from "../../../log";
import arrayFind from "../../../utils/array_find";
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
import objectAssign from "../../../utils/object_assign";
import TaskCanceller, { CancellationError, } from "../../../utils/task_canceller";
import loadAndPushSegment from "./load_and_push_segment";
import prepareSourceBuffer from "./prepare_source_buffer";
import removeBufferAroundTime from "./remove_buffer_around_time";
import VideoThumbnailLoaderError from "./video_thumbnail_loader_error";
var MIN_NEEDED_DATA_AFTER_TIME = 2;
var loaders = {};
/**
 * This tool, as a supplement to the RxPlayer, intent to help creating thumbnails
 * from a video source.
 *
 * The tools will extract a "thumbnail track" either from a video track (whose light
 * chunks are adapted from such use case) or direclty from the media content.
 */
var VideoThumbnailLoader = /** @class */ (function () {
    function VideoThumbnailLoader(videoElement, player) {
        this._videoElement = videoElement;
        this._player = player;
        this._lastRepresentationInfo = null;
    }
    /**
     * Add imported loader to thumbnail loader loader object.
     * It allows to use it when setting time.
     * @param {function} loaderFunc
     */
    VideoThumbnailLoader.addLoader = function (loaderFunc) {
        loaderFunc(loaders);
    };
    /**
     * Set time of thumbnail video media element :
     * - Remove buffer when too much buffered data
     * - Search for thumbnail track element to display
     * - Load data
     * - Append data
     * Resolves when time is set.
     * @param {number} time
     * @returns {Promise}
     */
    VideoThumbnailLoader.prototype.setTime = function (time) {
        var _this = this;
        var manifest = this._player.getManifest();
        if (manifest === null) {
            if (this._lastRepresentationInfo !== null) {
                this._lastRepresentationInfo.cleaner.cancel();
                this._lastRepresentationInfo = null;
            }
            return Promise.reject(new VideoThumbnailLoaderError("NO_MANIFEST", "No manifest available."));
        }
        var content = getTrickModeInfo(time, manifest);
        if (content === null) {
            if (this._lastRepresentationInfo !== null) {
                this._lastRepresentationInfo.cleaner.cancel();
                this._lastRepresentationInfo = null;
            }
            return Promise.reject(new VideoThumbnailLoaderError("NO_TRACK", "Couldn't find a trickmode track for this time."));
        }
        if (this._lastRepresentationInfo !== null &&
            !areSameRepresentation(this._lastRepresentationInfo.content, content)) {
            this._lastRepresentationInfo.cleaner.cancel();
            this._lastRepresentationInfo = null;
        }
        var neededSegments = content.representation.index
            .getSegments(time, MIN_NEEDED_DATA_AFTER_TIME);
        if (neededSegments.length === 0) {
            if (this._lastRepresentationInfo !== null) {
                this._lastRepresentationInfo.cleaner.cancel();
                this._lastRepresentationInfo = null;
            }
            return Promise.reject(new VideoThumbnailLoaderError("NO_THUMBNAIL", "Couldn't find any thumbnail for the given time."));
        }
        // Check which of `neededSegments` are already buffered
        for (var j = 0; j < neededSegments.length; j++) {
            var _a = neededSegments[j], stime = _a.time, duration = _a.duration, timescale = _a.timescale;
            var start = stime / timescale;
            var end = start + (duration / timescale);
            for (var i = 0; i < this._videoElement.buffered.length; i++) {
                if (this._videoElement.buffered.start(i) - 0.001 <= start &&
                    this._videoElement.buffered.end(i) + 0.001 >= end) {
                    neededSegments.splice(j, 1);
                    j--;
                    break;
                }
            }
        }
        if (neededSegments.length === 0) {
            this._videoElement.currentTime = time;
            log.debug("VTL: Thumbnails already loaded.", time);
            return Promise.resolve(time);
        }
        if (log.hasLevel("DEBUG")) {
            log.debug("VTL: Found thumbnail for time", time, neededSegments.map(function (s) {
                return "start: ".concat(s.time, " - end: ").concat(s.end);
            }).join(", "));
        }
        var loader = loaders[content.manifest.transport];
        if (loader === undefined) {
            if (this._lastRepresentationInfo !== null) {
                this._lastRepresentationInfo.cleaner.cancel();
                this._lastRepresentationInfo = null;
            }
            return Promise.reject(new VideoThumbnailLoaderError("NO_LOADER", "VideoThumbnailLoaderError: No imported loader for this transport type: " +
                content.manifest.transport));
        }
        var lastRepInfo;
        if (this._lastRepresentationInfo === null) {
            var cleaner_1 = new TaskCanceller();
            var segmentFetcher = createSegmentFetcher("video", loader.video, null, 
            // We don't care about the SegmentFetcher's lifecycle events
            {}, { baseDelay: 0,
                maxDelay: 0,
                maxRetryOffline: 0,
                maxRetryRegular: 0,
                requestTimeout: config.getCurrent().DEFAULT_REQUEST_TIMEOUT });
            var segmentBufferProm = prepareSourceBuffer(this._videoElement, content.representation.getMimeTypeString(), cleaner_1.signal).then(function (segmentBuffer) { return __awaiter(_this, void 0, void 0, function () {
                var initSegment, segmentInfo;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            initSegment = content.representation.index.getInitSegment();
                            if (initSegment === null) {
                                return [2 /*return*/, segmentBuffer];
                            }
                            segmentInfo = objectAssign({ segment: initSegment }, content);
                            return [4 /*yield*/, loadAndPushSegment(segmentInfo, segmentBuffer, lastRepInfo.segmentFetcher, cleaner_1.signal)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, segmentBuffer];
                    }
                });
            }); });
            lastRepInfo = {
                cleaner: cleaner_1,
                segmentBuffer: segmentBufferProm,
                content: content,
                segmentFetcher: segmentFetcher,
                pendingRequests: [],
            };
            this._lastRepresentationInfo = lastRepInfo;
        }
        else {
            lastRepInfo = this._lastRepresentationInfo;
        }
        abortUnlistedSegmentRequests(lastRepInfo.pendingRequests, neededSegments);
        var currentTaskCanceller = new TaskCanceller();
        return lastRepInfo.segmentBuffer
            .catch(function (err) {
            if (_this._lastRepresentationInfo !== null) {
                _this._lastRepresentationInfo.cleaner.cancel();
                _this._lastRepresentationInfo = null;
            }
            throw new VideoThumbnailLoaderError("LOADING_ERROR", "VideoThumbnailLoaderError: Error when initializing buffers: " +
                String(err));
        })
            .then(function (segmentBuffer) { return __awaiter(_this, void 0, void 0, function () {
            var promises, _loop_1, _i, neededSegments_1, segment;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        abortUnlistedSegmentRequests(lastRepInfo.pendingRequests, neededSegments);
                        log.debug("VTL: Removing buffer around time.", time);
                        return [4 /*yield*/, removeBufferAroundTime(this._videoElement, segmentBuffer, time, undefined, currentTaskCanceller.signal)];
                    case 1:
                        _a.sent();
                        abortUnlistedSegmentRequests(lastRepInfo.pendingRequests, neededSegments);
                        promises = [];
                        _loop_1 = function (segment) {
                            var pending_1 = arrayFind(lastRepInfo.pendingRequests, function (_a) {
                                var segmentId = _a.segmentId;
                                return segmentId === segment.id;
                            });
                            if (pending_1 !== undefined) {
                                promises.push(pending_1.promise);
                            }
                            else {
                                var requestCanceller = new TaskCanceller({
                                    cancelOn: lastRepInfo.cleaner.signal,
                                });
                                var segmentInfo = objectAssign({ segment: segment }, content);
                                var prom = loadAndPushSegment(segmentInfo, segmentBuffer, lastRepInfo.segmentFetcher, requestCanceller.signal);
                                var newReq_1 = {
                                    segmentId: segment.id,
                                    canceller: requestCanceller,
                                    promise: prom,
                                };
                                lastRepInfo.pendingRequests.push(newReq_1);
                                var removePendingRequest = function () {
                                    var indexOf = lastRepInfo.pendingRequests.indexOf(newReq_1);
                                    if (indexOf >= 0) {
                                        lastRepInfo.pendingRequests.splice(indexOf, 1);
                                    }
                                };
                                prom.then(removePendingRequest, removePendingRequest);
                                promises.push(prom);
                            }
                        };
                        for (_i = 0, neededSegments_1 = neededSegments; _i < neededSegments_1.length; _i++) {
                            segment = neededSegments_1[_i];
                            _loop_1(segment);
                        }
                        return [4 /*yield*/, Promise.all(promises)];
                    case 2:
                        _a.sent();
                        this._videoElement.currentTime = time;
                        return [2 /*return*/, time];
                }
            });
        }); })
            .catch(function (err) {
            if (err instanceof CancellationError) {
                throw new VideoThumbnailLoaderError("ABORTED", "VideoThumbnailLoaderError: Aborted job.");
            }
            throw err;
        });
    };
    /**
     * Dispose thumbnail loader.
     * @returns {void}
     */
    VideoThumbnailLoader.prototype.dispose = function () {
        if (this._lastRepresentationInfo !== null) {
            this._lastRepresentationInfo.cleaner.cancel();
            this._lastRepresentationInfo = null;
        }
    };
    return VideoThumbnailLoader;
}());
export default VideoThumbnailLoader;
/**
 * @param {Object} contentInfo1
 * @param {Object} contentInfo2
 * @returns {Boolean}
 */
function areSameRepresentation(contentInfo1, contentInfo2) {
    return (contentInfo1.representation.id === contentInfo2.representation.id &&
        contentInfo1.adaptation.id === contentInfo2.adaptation.id &&
        contentInfo1.period.id === contentInfo2.period.id &&
        contentInfo1.manifest.id === contentInfo2.manifest.id);
}
/**
 * From a given time, find the trickmode representation and return
 * the content information.
 * @param {number} time
 * @param {Object} manifest
 * @returns {Object|null}
 */
function getTrickModeInfo(time, manifest) {
    var _a, _b;
    var period = manifest.getPeriodForTime(time);
    if (period === undefined ||
        period.adaptations.video === undefined ||
        period.adaptations.video.length === 0) {
        return null;
    }
    for (var _i = 0, _c = period.adaptations.video; _i < _c.length; _i++) {
        var videoAdaptation = _c[_i];
        var representation = (_b = (_a = videoAdaptation.trickModeTracks) === null || _a === void 0 ? void 0 : _a[0].representations) === null || _b === void 0 ? void 0 : _b[0];
        if (!isNullOrUndefined(representation)) {
            return { manifest: manifest, period: period, adaptation: videoAdaptation, representation: representation };
        }
    }
    return null;
}
function abortUnlistedSegmentRequests(pendingRequests, neededSegments) {
    pendingRequests
        .filter(function (req) { return !neededSegments.some(function (_a) {
        var id = _a.id;
        return id === req.segmentId;
    }); })
        .forEach(function (req) {
        req.canceller.cancel();
    });
}
export { default as DASH_LOADER } from "./features/dash";
export { default as MPL_LOADER } from "./features/metaplaylist";
