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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { events, onHeightWidthChange, } from "../../../../../compat";
import config from "../../../../../config";
import log from "../../../../../log";
import TaskCanceller from "../../../../../utils/task_canceller";
import { SegmentBuffer, } from "../../types";
import ManualTimeRanges from "../../utils/manual_time_ranges";
import parseTextTrackToElements from "./parsers";
import TextTrackCuesStore from "./text_track_cues_store";
import updateProportionalElements from "./update_proportional_elements";
var onEnded = events.onEnded, onSeeked = events.onSeeked, onSeeking = events.onSeeking;
/**
 * @param {Element} element
 * @param {Element} child
 */
function safelyRemoveChild(element, child) {
    try {
        element.removeChild(child);
    }
    catch (_error) {
        log.warn("HTSB: Can't remove text track: not in the element.");
    }
}
/**
 * @param {HTMLElement} element
 * @returns {Object|null}
 */
function getElementResolution(element) {
    var strRows = element.getAttribute("data-resolution-rows");
    var strColumns = element.getAttribute("data-resolution-columns");
    if (strRows === null || strColumns === null) {
        return null;
    }
    var rows = parseInt(strRows, 10);
    var columns = parseInt(strColumns, 10);
    if (rows === null || columns === null) {
        return null;
    }
    return { rows: rows, columns: columns };
}
/**
 * SegmentBuffer implementation which display buffered TextTracks in the given
 * HTML element.
 * @class HTMLTextSegmentBuffer
 */
var HTMLTextSegmentBuffer = /** @class */ (function (_super) {
    __extends(HTMLTextSegmentBuffer, _super);
    /**
     * @param {HTMLMediaElement} videoElement
     * @param {HTMLElement} textTrackElement
     */
    function HTMLTextSegmentBuffer(videoElement, textTrackElement) {
        var _this = this;
        log.debug("HTSB: Creating HTMLTextSegmentBuffer");
        _this = _super.call(this) || this;
        _this.bufferType = "text";
        _this._buffered = new ManualTimeRanges();
        _this._videoElement = videoElement;
        _this._textTrackElement = textTrackElement;
        _this._sizeUpdateCanceller = new TaskCanceller();
        _this._canceller = new TaskCanceller();
        _this._buffer = new TextTrackCuesStore();
        _this._currentCues = [];
        _this.autoRefreshSubtitles(_this._canceller.signal);
        return _this;
    }
    /**
     * Push segment on Subscription.
     * @param {Object} infos
     * @returns {Promise}
     */
    HTMLTextSegmentBuffer.prototype.pushChunk = function (infos) {
        try {
            this.pushChunkSync(infos);
        }
        catch (err) {
            return Promise.reject(err);
        }
        return Promise.resolve();
    };
    /**
     * Remove buffered data.
     * @param {number} start - start position, in seconds
     * @param {number} end - end position, in seconds
     * @returns {Promise}
     */
    HTMLTextSegmentBuffer.prototype.removeBuffer = function (start, end) {
        this.removeBufferSync(start, end);
        return Promise.resolve();
    };
    /**
     * @param {Object} infos
     * @returns {Promise}
     */
    HTMLTextSegmentBuffer.prototype.endOfSegment = function (infos) {
        this._segmentInventory.completeSegment(infos, this._buffered);
        return Promise.resolve();
    };
    /**
     * Returns the currently buffered data, in a TimeRanges object.
     * @returns {TimeRanges}
     */
    HTMLTextSegmentBuffer.prototype.getBufferedRanges = function () {
        return this._buffered;
    };
    HTMLTextSegmentBuffer.prototype.dispose = function () {
        log.debug("HTSB: Disposing HTMLTextSegmentBuffer");
        this._disableCurrentCues();
        this._buffer.remove(0, Infinity);
        this._buffered.remove(0, Infinity);
        this._canceller.cancel();
    };
    /**
     * Push the text track contained in `data` to the HTMLTextSegmentBuffer
     * synchronously.
     * Returns a boolean:
     *   - `true` if text tracks have been added the the HTMLTextSegmentBuffer's
     *     buffer after that segment has been added.
     *   - `false` if no text tracks have been added the the
     *     HTMLTextSegmentBuffer's buffer (e.g. empty text-track, incoherent times
     *     etc.)
     *
     * /!\ This method won't add any data to the linked inventory.
     * Please use the `pushChunk` method for most use-cases.
     * @param {Object} infos
     * @returns {boolean}
     */
    HTMLTextSegmentBuffer.prototype.pushChunkSync = function (infos) {
        var _a, _b;
        log.debug("HTSB: Appending new html text tracks");
        var _c = infos.data, timestampOffset = _c.timestampOffset, appendWindow = _c.appendWindow, chunk = _c.chunk;
        if (chunk === null) {
            return;
        }
        assertChunkIsTextTrackSegmentData(chunk);
        var startTime = chunk.start, endTime = chunk.end, dataString = chunk.data, type = chunk.type, language = chunk.language;
        var appendWindowStart = (_a = appendWindow[0]) !== null && _a !== void 0 ? _a : 0;
        var appendWindowEnd = (_b = appendWindow[1]) !== null && _b !== void 0 ? _b : Infinity;
        var cues = parseTextTrackToElements(type, dataString, timestampOffset, language);
        if (appendWindowStart !== 0 && appendWindowEnd !== Infinity) {
            // Removing before window start
            var i = 0;
            while (i < cues.length && cues[i].end <= appendWindowStart) {
                i++;
            }
            cues.splice(0, i);
            i = 0;
            while (i < cues.length && cues[i].start < appendWindowStart) {
                cues[i].start = appendWindowStart;
                i++;
            }
            // Removing after window end
            i = cues.length - 1;
            while (i >= 0 && cues[i].start >= appendWindowEnd) {
                i--;
            }
            cues.splice(i, cues.length);
            i = cues.length - 1;
            while (i >= 0 && cues[i].end > appendWindowEnd) {
                cues[i].end = appendWindowEnd;
                i--;
            }
        }
        var start;
        if (startTime !== undefined) {
            start = Math.max(appendWindowStart, startTime);
        }
        else {
            if (cues.length <= 0) {
                log.warn("HTSB: Current text tracks have no cues nor start time. Aborting");
                return;
            }
            log.warn("HTSB: No start time given. Guessing from cues.");
            start = cues[0].start;
        }
        var end;
        if (endTime !== undefined) {
            end = Math.min(appendWindowEnd, endTime);
        }
        else {
            if (cues.length <= 0) {
                log.warn("HTSB: Current text tracks have no cues nor end time. Aborting");
                return;
            }
            log.warn("HTSB: No end time given. Guessing from cues.");
            end = cues[cues.length - 1].end;
        }
        if (end <= start) {
            log.warn("HTSB: Invalid text track appended: ", "the start time is inferior or equal to the end time.");
            return;
        }
        if (infos.inventoryInfos !== null) {
            this._segmentInventory.insertChunk(infos.inventoryInfos);
        }
        this._buffer.insert(cues, start, end);
        this._buffered.insert(start, end);
    };
    /**
     * Remove buffer data between the given start and end, synchronously.
     * @param {number} start
     * @param {number} end
     */
    HTMLTextSegmentBuffer.prototype.removeBufferSync = function (start, end) {
        log.debug("HTSB: Removing html text track data", start, end);
        this._buffer.remove(start, end);
        this._buffered.remove(start, end);
    };
    /**
     * Remove the current cue from being displayed.
     */
    HTMLTextSegmentBuffer.prototype._disableCurrentCues = function () {
        this._sizeUpdateCanceller.cancel();
        if (this._currentCues.length > 0) {
            for (var i = 0; i < this._currentCues.length; i++) {
                safelyRemoveChild(this._textTrackElement, this._currentCues[i].element);
            }
            this._currentCues = [];
        }
    };
    /**
     * Display a new Cue. If one was already present, it will be replaced.
     * @param {HTMLElement} elements
     */
    HTMLTextSegmentBuffer.prototype._displayCues = function (elements) {
        var nothingChanged = this._currentCues.length === elements.length &&
            this._currentCues.every(function (current, index) { return current.element === elements[index]; });
        if (nothingChanged) {
            return;
        }
        // Remove and re-display everything
        // TODO More intelligent handling
        this._sizeUpdateCanceller.cancel();
        for (var i = 0; i < this._currentCues.length; i++) {
            safelyRemoveChild(this._textTrackElement, this._currentCues[i].element);
        }
        this._currentCues = [];
        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            var resolution = getElementResolution(element);
            this._currentCues.push({ element: element, resolution: resolution });
            this._textTrackElement.appendChild(element);
        }
        var proportionalCues = this._currentCues
            .filter(function (cue) { return cue.resolution !== null; });
        if (proportionalCues.length > 0) {
            this._sizeUpdateCanceller = new TaskCanceller({ cancelOn: this._canceller.signal });
            var TEXT_TRACK_SIZE_CHECKS_INTERVAL = config.getCurrent().TEXT_TRACK_SIZE_CHECKS_INTERVAL;
            // update propertionally-sized elements periodically
            var heightWidthRef = onHeightWidthChange(this._textTrackElement, TEXT_TRACK_SIZE_CHECKS_INTERVAL, this._sizeUpdateCanceller.signal);
            heightWidthRef.onUpdate(function (_a) {
                var height = _a.height, width = _a.width;
                for (var i = 0; i < proportionalCues.length; i++) {
                    var _b = proportionalCues[i], resolution = _b.resolution, element = _b.element;
                    updateProportionalElements(height, width, resolution, element);
                }
            }, { clearSignal: this._sizeUpdateCanceller.signal,
                emitCurrentValue: true });
        }
    };
    /**
     * Auto-refresh the display of subtitles according to the media element's
     * position and events.
     * @param {Object} cancellationSignal
     */
    HTMLTextSegmentBuffer.prototype.autoRefreshSubtitles = function (cancellationSignal) {
        var _this = this;
        var autoRefreshCanceller = null;
        var MAXIMUM_HTML_TEXT_TRACK_UPDATE_INTERVAL = config.getCurrent().MAXIMUM_HTML_TEXT_TRACK_UPDATE_INTERVAL;
        var startAutoRefresh = function () {
            stopAutoRefresh();
            autoRefreshCanceller = new TaskCanceller({ cancelOn: cancellationSignal });
            var intervalId = setInterval(function () { return _this.refreshSubtitles(); }, MAXIMUM_HTML_TEXT_TRACK_UPDATE_INTERVAL);
            autoRefreshCanceller.signal.register(function () {
                clearInterval(intervalId);
            });
            _this.refreshSubtitles();
        };
        onSeeking(this._videoElement, function () {
            stopAutoRefresh();
            _this._disableCurrentCues();
        }, cancellationSignal);
        onSeeked(this._videoElement, startAutoRefresh, cancellationSignal);
        onEnded(this._videoElement, startAutoRefresh, cancellationSignal);
        startAutoRefresh();
        function stopAutoRefresh() {
            if (autoRefreshCanceller !== null) {
                autoRefreshCanceller.cancel();
                autoRefreshCanceller = null;
            }
        }
    };
    /**
     * Refresh current subtitles according to the current media element's
     * position.
     */
    HTMLTextSegmentBuffer.prototype.refreshSubtitles = function () {
        var MAXIMUM_HTML_TEXT_TRACK_UPDATE_INTERVAL = config.getCurrent().MAXIMUM_HTML_TEXT_TRACK_UPDATE_INTERVAL;
        var time;
        if (this._videoElement.paused || this._videoElement.playbackRate <= 0) {
            time = this._videoElement.currentTime;
        }
        else {
            // to spread the time error, we divide the regular chosen interval.
            time = Math.max(this._videoElement.currentTime +
                (MAXIMUM_HTML_TEXT_TRACK_UPDATE_INTERVAL / 1000) / 2, 0);
        }
        var cues = this._buffer.get(time);
        if (cues.length === 0) {
            this._disableCurrentCues();
        }
        else {
            this._displayCues(cues);
        }
    };
    return HTMLTextSegmentBuffer;
}(SegmentBuffer));
export default HTMLTextSegmentBuffer;
/**
 * Throw if the given input is not in the expected format.
 * Allows to enforce runtime type-checking as compile-time type-checking here is
 * difficult to enforce.
 * @param {Object} chunk
 */
function assertChunkIsTextTrackSegmentData(chunk) {
    if (0 /* __ENVIRONMENT__.CURRENT_ENV */ === 0 /* __ENVIRONMENT__.PRODUCTION */) {
        return;
    }
    if (typeof chunk !== "object" ||
        chunk === null ||
        typeof chunk.data !== "string" ||
        typeof chunk.type !== "string" ||
        (chunk.language !== undefined &&
            typeof chunk.language !== "string") ||
        (chunk.start !== undefined &&
            typeof chunk.start !== "number") ||
        (chunk.end !== undefined &&
            typeof chunk.end !== "number")) {
        throw new Error("Invalid format given to a NativeTextSegmentBuffer");
    }
}
/*
 * The following ugly code is here to provide a compile-time check that an
 * `INativeTextTracksBufferSegmentData` (type of data pushed to a
 * `NativeTextSegmentBuffer`) can be derived from a `ITextTrackSegmentData`
 * (text track data parsed from a segment).
 *
 * It doesn't correspond at all to real code that will be called. This is just
 * a hack to tell TypeScript to perform that check.
 */
if (0 /* __ENVIRONMENT__.CURRENT_ENV */ === 1 /* __ENVIRONMENT__.DEV */) {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    function _checkType(input) {
        function checkEqual(_arg) {
            /* nothing */
        }
        checkEqual(input);
    }
    /* eslint-enable @typescript-eslint/no-unused-vars */
    /* eslint-enable @typescript-eslint/ban-ts-comment */
}
