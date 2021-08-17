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
import pinkie from "pinkie";
import { combineLatest, lastValueFrom, merge as observableMerge, race as observableRace, Subject, } from "rxjs";
import { catchError, finalize, ignoreElements, map, mergeMap, take, tap, } from "rxjs/operators";
import createSegmentFetcher from "../../../core/fetchers/segment/segment_fetcher";
import log from "../../../log";
import objectAssign from "../../../utils/object_assign";
import { freeRequest } from "./create_request";
import getCompleteSegmentId from "./get_complete_segment_id";
import getContentInfos from "./get_content_infos";
import { disposeMediaSource, getInitializedSourceBuffer$, } from "./get_initialized_source_buffer";
import loadSegments from "./load_segments";
import pushData from "./push_data";
import removeBufferAroundTime$ from "./remove_buffer_around_time";
import VideoThumbnailLoaderError from "./video_thumbnail_loader_error";
var PPromise = typeof Promise === "function" ? Promise :
    pinkie;
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
        if (this._currentTask !== undefined) {
            if (time === this._currentTask.time) {
                // The current task is already handling the loading for the wanted time
                // (same thumbnail).
                return this._currentTask.promise;
            }
        }
        var manifest = this._player.getManifest();
        if (manifest === null) {
            return PPromise.reject(new VideoThumbnailLoaderError("NO_MANIFEST", "No manifest available."));
        }
        var contentInfos = getContentInfos(time, manifest);
        if (contentInfos === null) {
            return PPromise.reject(new VideoThumbnailLoaderError("NO_TRACK", "Couldn't find track for this time."));
        }
        var segments = contentInfos
            .representation.index.getSegments(time, MIN_NEEDED_DATA_AFTER_TIME);
        if (segments.length === 0) {
            return PPromise.reject(new VideoThumbnailLoaderError("NO_THUMBNAIL", "Couldn't find thumbnail for the given time."));
        }
        for (var j = 0; j < segments.length; j++) {
            var _a = segments[j], stime = _a.time, duration = _a.duration, timescale = _a.timescale;
            var start = stime / timescale;
            var end = start + (duration / timescale);
            for (var i = 0; i < this._videoElement.buffered.length; i++) {
                if (this._videoElement.buffered.start(i) - +0.001 <= start &&
                    this._videoElement.buffered.end(i) + 0.001 >= end) {
                    segments.splice(j, 1);
                    j--;
                    break;
                }
            }
        }
        if (segments.length === 0) {
            this._videoElement.currentTime = time;
            log.debug("VTL: Thumbnails already loaded.", time);
            return PPromise.resolve(time);
        }
        log.debug("VTL: Found thumbnail for time", time, segments);
        if (this._currentTask !== undefined) {
            this._nextTaskSegmentsCompleteIds =
                segments.map(function (segment) { return getCompleteSegmentId(contentInfos, segment); });
            this._currentTask.stop();
        }
        return this._startTimeSettingTask(contentInfos, segments, time);
    };
    /**
     * Dispose thumbnail loader.
     * @returns {void}
     */
    VideoThumbnailLoader.prototype.dispose = function () {
        if (this._currentTask !== undefined) {
            this._currentTask.stop();
        }
        disposeMediaSource();
    };
    /**
     * - Remove buffer when too much buffered data
     * - Load data
     * - Append data
     * - Set time on video element
     * @param {Object} contentInfos
     * @param {Object} contentInfos
     * @param {Object} contentInfos
     * @returns {Promise}
     */
    VideoThumbnailLoader.prototype._startTimeSettingTask = function (contentInfos, segments, time) {
        var _this = this;
        var loader = loaders[contentInfos.manifest.transport];
        if (loader === undefined) {
            var error = new VideoThumbnailLoaderError("NO_LOADER", "VideoThumbnailLoaderError: No " +
                "imported loader for this transport type: " +
                contentInfos.manifest.transport);
            return PPromise.reject(error);
        }
        var killTask$ = new Subject();
        var abortError$ = killTask$.pipe(map(function () {
            throw new VideoThumbnailLoaderError("ABORTED", "VideoThumbnailLoaderError: Aborted job.");
        }));
        var segmentFetcher = createSegmentFetcher("video", loader.video, new Subject(), { baseDelay: 0,
            maxDelay: 0,
            maxRetryOffline: 0,
            maxRetryRegular: 0 });
        var taskPromise = lastValueFrom(observableRace(abortError$, getInitializedSourceBuffer$(contentInfos, this._videoElement, segmentFetcher).pipe(mergeMap(function (videoSourceBuffer) {
            var bufferCleaning$ = removeBufferAroundTime$(_this._videoElement, videoSourceBuffer, time);
            log.debug("VTL: Removing buffer around time.", time);
            var segmentsLoading$ = loadSegments(segments, segmentFetcher, contentInfos);
            return observableMerge(bufferCleaning$.pipe(ignoreElements()), segmentsLoading$).pipe(mergeMap(function (arr) {
                return combineLatest(arr.map(function (_a) {
                    var segment = _a.segment, data = _a.data;
                    if (data.segmentType === "init") {
                        throw new Error("Unexpected initialization segment parsed.");
                    }
                    var start = segment.time / segment.timescale;
                    var end = start + (segment.duration / segment.timescale);
                    var inventoryInfos = objectAssign({ segment: segment,
                        start: start,
                        end: end }, contentInfos);
                    return pushData(inventoryInfos, data, videoSourceBuffer)
                        .pipe(tap(function () {
                        freeRequest(getCompleteSegmentId(inventoryInfos, segment));
                        log.debug("VTL: Appended segment.", data);
                    }));
                }));
            }), map(function () {
                _this._videoElement.currentTime = time;
                return time;
            }));
        }), catchError(function (err) {
            var _a;
            var message = "Unknown error.";
            if (err.message !== undefined ||
                /* eslint-disable @typescript-eslint/no-unsafe-assignment */
                /* eslint-disable @typescript-eslint/no-unsafe-member-access */
                /* eslint-disable @typescript-eslint/no-unsafe-call */
                typeof err.toString === "function") {
                message = (_a = err.message) !== null && _a !== void 0 ? _a : err.toString();
                /* eslint-enable @typescript-eslint/no-unsafe-assignment */
                /* eslint-enable @typescript-eslint/no-unsafe-member-access */
                /* eslint-enable @typescript-eslint/no-unsafe-call */
            }
            throw new VideoThumbnailLoaderError("LOADING_ERROR", message);
        }))).pipe(take(1), finalize(function () {
            segments.forEach(function (segment) {
                var completeSegmentId = getCompleteSegmentId(contentInfos, segment);
                if (_this._nextTaskSegmentsCompleteIds === undefined ||
                    !_this._nextTaskSegmentsCompleteIds.some(function (id) { return completeSegmentId === id; })) {
                    freeRequest(completeSegmentId);
                }
            });
            _this._nextTaskSegmentsCompleteIds = undefined;
            _this._currentTask = undefined;
            killTask$.complete();
        })));
        this._currentTask = { contentInfos: contentInfos,
            time: time,
            stop: function () { return killTask$.next(); },
            promise: taskPromise };
        return taskPromise;
    };
    return VideoThumbnailLoader;
}());
export default VideoThumbnailLoader;
export { default as DASH_LOADER } from "./features/dash";
export { default as MPL_LOADER } from "./features/metaplaylist";
