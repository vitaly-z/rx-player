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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { defer as observableDefer, fromEvent as observableFromEvent, interval as observableInterval, map, merge as observableMerge, share, shareReplay, skip, startWith, } from "rxjs";
import config from "../../config";
import log from "../../log";
import objectAssign from "../../utils/object_assign";
import { getRange } from "../../utils/ranges";
var SAMPLING_INTERVAL_MEDIASOURCE = config.SAMPLING_INTERVAL_MEDIASOURCE, SAMPLING_INTERVAL_LOW_LATENCY = config.SAMPLING_INTERVAL_LOW_LATENCY, SAMPLING_INTERVAL_NO_MEDIASOURCE = config.SAMPLING_INTERVAL_NO_MEDIASOURCE, RESUME_GAP_AFTER_SEEKING = config.RESUME_GAP_AFTER_SEEKING, RESUME_GAP_AFTER_NOT_ENOUGH_DATA = config.RESUME_GAP_AFTER_NOT_ENOUGH_DATA, RESUME_GAP_AFTER_BUFFERING = config.RESUME_GAP_AFTER_BUFFERING, REBUFFERING_GAP = config.REBUFFERING_GAP, MINIMUM_BUFFER_AMOUNT_BEFORE_FREEZING = config.MINIMUM_BUFFER_AMOUNT_BEFORE_FREEZING;
/**
 * HTMLMediaElement Events for which playback observations are calculated and
 * emitted.
 * @type {Array.<string>}
 */
var SCANNED_MEDIA_ELEMENTS_EVENTS = ["canplay",
    "play",
    "seeking",
    "seeked",
    "loadedmetadata",
    "ratechange"];
/**
 * Class allowing to "observe" current playback conditions so the RxPlayer is
 * then able to react upon them.
 *
 * This is a central class of the RxPlayer as many modules rely on the
 * `PlaybackObserver` to know the current state of the media being played.
 *
 * You can use the PlaybackObserver to either get the last observation
 * performed, get the current media state or subscribe to an Observable emitting
 * regularly media conditions.
 *
 * @class {PlaybackObserver}
 */
var PlaybackObserver = /** @class */ (function () {
    /**
     * @param {HTMLMediaElement} mediaElement
     * @param {Object} options
     */
    function PlaybackObserver(mediaElement, options) {
        this._internalSeekingEventsIncomingCounter = 0;
        this._mediaElement = mediaElement;
        this._withMediaSource = options.withMediaSource;
        this._lowLatencyMode = options.lowLatencyMode;
        this._lastObservation = null;
        this._observation$ = null;
    }
    /**
     * Returns the current position advertised by the `HTMLMediaElement`, in
     * seconds.
     * @returns {number}
     */
    PlaybackObserver.prototype.getCurrentTime = function () {
        return this._mediaElement.currentTime;
    };
    /**
     * Update the current position (seek) on the `HTMLMediaElement`, by giving a
     * new position in seconds.
     *
     * Note that seeks performed through this method are caracherized as
     * "internal" seeks. They don't result into the exact same playback
     * observation than regular seeks (which most likely comes from the outside,
     * e.g. the user).
     * @param {number}
     */
    PlaybackObserver.prototype.setCurrentTime = function (time) {
        this._internalSeekingEventsIncomingCounter += 1;
        this._mediaElement.currentTime = time;
    };
    /**
     * Returns the current `readyState` advertised by the `HTMLMediaElement`.
     * @returns {number}
     */
    PlaybackObserver.prototype.getReadyState = function () {
        return this._mediaElement.readyState;
    };
    /**
     * Returns an Observable regularly emitting playback observation, optionally
     * starting with the last one.
     *
     * Note that this Observable is shared and unique, so that multiple `observe`
     * call will return the exact same Observable and multiple concurrent
     * `subscribe` will receive the same events at the same time.
     * This was done for performance and simplicity reasons.
     *
     * @param {boolean} includeLastObservation
     * @returns {Observable}
     */
    PlaybackObserver.prototype.observe = function (includeLastObservation) {
        var _this = this;
        return observableDefer(function () {
            if (_this._observation$ === null || _this._lastObservation === null) {
                _this._lastObservation = _this._generateInitialObservation();
                _this._observation$ = _this._createInnerObservable().pipe(share());
                return _this.observe(includeLastObservation);
            }
            else {
                return includeLastObservation ?
                    _this._observation$.pipe(startWith(_this._lastObservation)) :
                    _this._observation$;
            }
        });
    };
    /**
     * Generate a new playback observer which can listen to other
     * properties and which can only be accessed to read observations (e.g.
     * it cannot ask to perform a seek).
     *
     * The object returned will respect the `IReadOnlyPlaybackObserver` interface
     * and will inherit this `PlaybackObserver`'s lifecycle: it will emit when
     * the latter emits.
     *
     * As argument, this method takes a function which will allow to produce
     * the new set of properties to be present on each observation.
     * @param {Function} mapObservable
     * @returns {Object}
     */
    PlaybackObserver.prototype.deriveReadOnlyObserver = function (mapObservable) {
        return generateReadOnlyObserver(this, mapObservable);
    };
    /**
     * Creates the observable that will generate playback observations.
     * @returns {Observable}
     */
    PlaybackObserver.prototype._createInnerObservable = function () {
        var _this = this;
        return observableDefer(function () {
            var getCurrentObservation = function (event) {
                var _a;
                var tmpEvt = event;
                if (tmpEvt === "seeking" && _this._internalSeekingEventsIncomingCounter > 0) {
                    tmpEvt = "internal-seeking";
                    _this._internalSeekingEventsIncomingCounter -= 1;
                }
                var lastObservation = (_a = _this._lastObservation) !== null && _a !== void 0 ? _a : _this._generateInitialObservation();
                var mediaTimings = getMediaInfos(_this._mediaElement, tmpEvt);
                var internalSeeking = mediaTimings.seeking &&
                    // We've just received the event for internally seeking
                    (tmpEvt === "internal-seeking" ||
                        // or We're still waiting on the previous internal-seek
                        (lastObservation.internalSeeking && tmpEvt !== "seeking"));
                var rebufferingStatus = getRebufferingStatus(lastObservation, mediaTimings, { lowLatencyMode: _this._lowLatencyMode,
                    withMediaSource: _this._withMediaSource });
                var freezingStatus = getFreezingStatus(lastObservation, mediaTimings);
                var timings = objectAssign({}, { rebuffering: rebufferingStatus,
                    freezing: freezingStatus, internalSeeking: internalSeeking }, mediaTimings);
                log.debug("API: current media element state", timings);
                return timings;
            };
            var eventObs = SCANNED_MEDIA_ELEMENTS_EVENTS.map(function (eventName) {
                return observableFromEvent(_this._mediaElement, eventName)
                    .pipe(map(function () { return eventName; }));
            });
            var interval = _this._lowLatencyMode ? SAMPLING_INTERVAL_LOW_LATENCY :
                _this._withMediaSource ? SAMPLING_INTERVAL_MEDIASOURCE :
                    SAMPLING_INTERVAL_NO_MEDIASOURCE;
            var interval$ = observableInterval(interval)
                .pipe(map(function () { return "timeupdate"; }));
            return observableMerge.apply(void 0, __spreadArray([interval$], eventObs, false)).pipe(map(function (event) {
                var newObservation = getCurrentObservation(event);
                if (log.getLevel() === "DEBUG") {
                    log.debug("API: current playback timeline:\n" +
                        prettyPrintBuffered(newObservation.buffered, newObservation.position), "\n".concat(event));
                }
                _this._lastObservation = newObservation;
                return newObservation;
            }));
        });
    };
    PlaybackObserver.prototype._generateInitialObservation = function () {
        return objectAssign(getMediaInfos(this._mediaElement, "init"), { rebuffering: null,
            freezing: null,
            internalSeeking: false });
    };
    return PlaybackObserver;
}());
export default PlaybackObserver;
/**
 * Returns the amount of time in seconds the buffer should have ahead of the
 * current position before resuming playback. Based on the infos of the
 * rebuffering status.
 *
 * Waiting time differs between a rebuffering happening after a "seek" or one
 * happening after a buffer starvation occured.
 * @param {Object|null} rebufferingStatus
 * @param {Boolean} lowLatencyMode
 * @returns {Number}
 */
function getRebufferingEndGap(rebufferingStatus, lowLatencyMode) {
    if (rebufferingStatus === null) {
        return 0;
    }
    var suffix = lowLatencyMode ? "LOW_LATENCY" :
        "DEFAULT";
    switch (rebufferingStatus.reason) {
        case "seeking":
            return RESUME_GAP_AFTER_SEEKING[suffix];
        case "not-ready":
            return RESUME_GAP_AFTER_NOT_ENOUGH_DATA[suffix];
        case "buffering":
            return RESUME_GAP_AFTER_BUFFERING[suffix];
    }
}
/**
 * @param {Object} currentRange
 * @param {Number} duration
 * @param {Boolean} lowLatencyMode
 * @returns {Boolean}
 */
function hasLoadedUntilTheEnd(currentRange, duration, lowLatencyMode) {
    var suffix = lowLatencyMode ? "LOW_LATENCY" :
        "DEFAULT";
    return currentRange !== null &&
        (duration - currentRange.end) <= REBUFFERING_GAP[suffix];
}
/**
 * Get basic playback information.
 * @param {HTMLMediaElement} mediaElement
 * @param {string} event
 * @returns {Object}
 */
function getMediaInfos(mediaElement, event) {
    var buffered = mediaElement.buffered, currentTime = mediaElement.currentTime, duration = mediaElement.duration, ended = mediaElement.ended, paused = mediaElement.paused, playbackRate = mediaElement.playbackRate, readyState = mediaElement.readyState, seeking = mediaElement.seeking;
    var currentRange = getRange(buffered, currentTime);
    return { bufferGap: currentRange !== null ? currentRange.end - currentTime :
            // TODO null/0 would probably be
            // more appropriate
            Infinity, buffered: buffered, currentRange: currentRange, position: currentTime, duration: duration, ended: ended, paused: paused, playbackRate: playbackRate, readyState: readyState, seeking: seeking, event: event };
}
/**
 * Infer rebuffering status of the media based on:
 *   - the return of the function getMediaInfos
 *   - the previous observation object.
 *
 * @param {Object} prevObservation - Previous playback observation object.
 * @param {Object} currentInfo - Current set of basic information on the
 * `HTMLMediaElement`. This does not need every single property from a regular
 * playback observation.
 * @param {Object} options
 * @returns {Object|null}
 */
function getRebufferingStatus(prevObservation, currentInfo, _a) {
    var withMediaSource = _a.withMediaSource, lowLatencyMode = _a.lowLatencyMode;
    var currentEvt = currentInfo.event, currentTime = currentInfo.position, bufferGap = currentInfo.bufferGap, currentRange = currentInfo.currentRange, duration = currentInfo.duration, paused = currentInfo.paused, readyState = currentInfo.readyState, ended = currentInfo.ended;
    var prevRebuffering = prevObservation.rebuffering, prevEvt = prevObservation.event, prevTime = prevObservation.position;
    var fullyLoaded = hasLoadedUntilTheEnd(currentRange, duration, lowLatencyMode);
    var canSwitchToRebuffering = (readyState >= 1 &&
        currentEvt !== "loadedmetadata" &&
        prevRebuffering === null &&
        !(fullyLoaded || ended));
    var rebufferEndPosition = null;
    var shouldRebuffer;
    var shouldStopRebuffer;
    var rebufferGap = lowLatencyMode ? REBUFFERING_GAP.LOW_LATENCY :
        REBUFFERING_GAP.DEFAULT;
    if (withMediaSource) {
        if (canSwitchToRebuffering) {
            if (bufferGap <= rebufferGap) {
                shouldRebuffer = true;
                rebufferEndPosition = currentTime + bufferGap;
            }
            else if (bufferGap === Infinity) {
                shouldRebuffer = true;
                rebufferEndPosition = currentTime;
            }
        }
        else if (prevRebuffering !== null) {
            var resumeGap = getRebufferingEndGap(prevRebuffering, lowLatencyMode);
            if (shouldRebuffer !== true && prevRebuffering !== null && readyState > 1 &&
                (fullyLoaded || ended || (bufferGap < Infinity && bufferGap > resumeGap))) {
                shouldStopRebuffer = true;
            }
            else if (bufferGap === Infinity || bufferGap <= resumeGap) {
                rebufferEndPosition = bufferGap === Infinity ? currentTime :
                    currentTime + bufferGap;
            }
        }
    }
    // when using a direct file, the media will stall and unstall on its
    // own, so we only try to detect when the media timestamp has not changed
    // between two consecutive timeupdates
    else {
        if (canSwitchToRebuffering &&
            (!paused && currentEvt === "timeupdate" &&
                prevEvt === "timeupdate" && currentTime === prevTime ||
                currentEvt === "seeking" && bufferGap === Infinity)) {
            shouldRebuffer = true;
        }
        else if (prevRebuffering !== null &&
            (currentEvt !== "seeking" && currentTime !== prevTime ||
                currentEvt === "canplay" ||
                bufferGap < Infinity &&
                    (bufferGap > getRebufferingEndGap(prevRebuffering, lowLatencyMode) ||
                        fullyLoaded || ended))) {
            shouldStopRebuffer = true;
        }
    }
    if (shouldStopRebuffer === true) {
        return null;
    }
    else if (shouldRebuffer === true || prevRebuffering !== null) {
        var reason = void 0;
        if (currentEvt === "seeking" ||
            prevRebuffering !== null && prevRebuffering.reason === "seeking") {
            reason = "seeking";
        }
        else if (currentInfo.seeking) {
            reason = "seeking";
        }
        else if (readyState === 1) {
            reason = "not-ready";
        }
        else {
            reason = "buffering";
        }
        if (prevRebuffering !== null && prevRebuffering.reason === reason) {
            return { reason: prevRebuffering.reason,
                timestamp: prevRebuffering.timestamp,
                position: rebufferEndPosition };
        }
        return { reason: reason, timestamp: performance.now(),
            position: rebufferEndPosition };
    }
    return null;
}
/**
 * Detect if the current media can be considered as "freezing" (i.e. not
 * advancing for unknown reasons).
 *
 * Returns a corresponding `IFreezingStatus` object if that's the case and
 * `null` if not.
 * @param {Object} prevObservation
 * @param {Object} currentInfo
 * @returns {Object|null}
 */
function getFreezingStatus(prevObservation, currentInfo) {
    if (prevObservation.freezing) {
        if (currentInfo.ended ||
            currentInfo.paused ||
            currentInfo.readyState === 0 ||
            currentInfo.playbackRate === 0 ||
            prevObservation.position !== currentInfo.position) {
            return null; // Quit freezing status
        }
        return prevObservation.freezing; // Stay in it
    }
    return currentInfo.event === "timeupdate" &&
        currentInfo.bufferGap > MINIMUM_BUFFER_AMOUNT_BEFORE_FREEZING &&
        !currentInfo.ended &&
        !currentInfo.paused &&
        currentInfo.readyState >= 1 &&
        currentInfo.playbackRate !== 0 &&
        currentInfo.position === prevObservation.position ?
        { timestamp: performance.now() } :
        null;
}
/**
 * Pretty print a TimeRanges Object, to see the current content of it in a
 * one-liner string.
 *
 * @example
 * This function is called by giving it directly the TimeRanges, such as:
 * ```js
 * prettyPrintBuffered(document.getElementsByTagName("video")[0].buffered);
 * ```
 *
 * Let's consider this possible return:
 *
 * ```
 * 0.00|==29.95==|29.95 ~30.05~ 60.00|==29.86==|89.86
 *          ^14
 * ```
 * This means that our video element has 29.95 seconds of buffer between 0 and
 * 29.95 seconds.
 * Then 30.05 seconds where no buffer is found.
 * Then 29.86 seconds of buffer between 60.00 and 89.86 seconds.
 *
 * A caret on the second line indicates the current time we're at.
 * The number coming after it is the current time.
 * @param {TimeRanges} buffered
 * @param {number} currentTime
 * @returns {string}
 */
function prettyPrintBuffered(buffered, currentTime) {
    var str = "";
    var currentTimeStr = "";
    for (var i = 0; i < buffered.length; i++) {
        var start = buffered.start(i);
        var end = buffered.end(i);
        var fixedStart = start.toFixed(2);
        var fixedEnd = end.toFixed(2);
        var fixedDuration = (end - start).toFixed(2);
        var newIntervalStr = "".concat(fixedStart, "|==").concat(fixedDuration, "==|").concat(fixedEnd);
        str += newIntervalStr;
        if (currentTimeStr.length === 0 && end > currentTime) {
            var padBefore = str.length - Math.floor(newIntervalStr.length / 2);
            currentTimeStr = " ".repeat(padBefore) + "^".concat(currentTime);
        }
        if (i < buffered.length - 1) {
            var nextStart = buffered.start(i + 1);
            var fixedDiff = (nextStart - end).toFixed(2);
            var holeStr = " ~".concat(fixedDiff, "~ ");
            str += holeStr;
            if (currentTimeStr.length === 0 && currentTime < nextStart) {
                var padBefore = str.length - Math.floor(holeStr.length / 2);
                currentTimeStr = " ".repeat(padBefore) + "^".concat(currentTime);
            }
        }
    }
    if (currentTimeStr.length === 0) {
        currentTimeStr = " ".repeat(str.length) + "^".concat(currentTime);
    }
    return str + "\n" + currentTimeStr;
}
/**
 * Create `IReadOnlyPlaybackObserver` from a source `IReadOnlyPlaybackObserver`
 * and a mapping function.
 * @param {Object} src
 * @param {Function} mapObservable
 * @returns {Object}
 */
function generateReadOnlyObserver(src, mapObservable) {
    var newObs = observableDefer(function () {
        return mapObservable(src.observe(true));
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    return {
        getCurrentTime: function () {
            return src.getCurrentTime();
        },
        getReadyState: function () {
            return src.getReadyState();
        },
        observe: function (includeLastObservation) {
            return includeLastObservation ? newObs :
                newObs.pipe(skip(1));
        },
        deriveReadOnlyObserver: function (newUdateObserver) {
            return generateReadOnlyObserver(this, newUdateObserver);
        },
    };
}
