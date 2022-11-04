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
import config from "../../config";
import log from "../../log";
import noop from "../../utils/noop";
import objectAssign from "../../utils/object_assign";
import { getRange } from "../../utils/ranges";
import createSharedReference from "../../utils/reference";
import TaskCanceller from "../../utils/task_canceller";
/**
 * HTMLMediaElement Events for which playback observations are calculated and
 * emitted.
 * @type {Array.<string>}
 */
var SCANNED_MEDIA_ELEMENTS_EVENTS = ["canplay",
    "ended",
    "play",
    "pause",
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
     * Create a new `PlaybackObserver`, which allows to produce new "playback
     * observations" on various media events and intervals.
     *
     * Note that creating a `PlaybackObserver` lead to the usage of resources,
     * such as event listeners which will only be freed once the `stop` method is
     * called.
     * @param {HTMLMediaElement} mediaElement
     * @param {Object} options
     */
    function PlaybackObserver(mediaElement, options) {
        this._internalSeeksIncoming = [];
        this._mediaElement = mediaElement;
        this._withMediaSource = options.withMediaSource;
        this._lowLatencyMode = options.lowLatencyMode;
        this._canceller = new TaskCanceller();
        this._observationRef = this._createSharedReference();
    }
    /**
     * Stop the `PlaybackObserver` from emitting playback observations and free all
     * resources reserved to emitting them such as event listeners, intervals and
     * subscribing callbacks.
     *
     * Once `stop` is called, no new playback observation will ever be emitted.
     *
     * Note that it is important to call stop once the `PlaybackObserver` is no
     * more needed to avoid unnecessarily leaking resources.
     */
    PlaybackObserver.prototype.stop = function () {
        this._canceller.cancel();
    };
    /**
     * Returns the current position advertised by the `HTMLMediaElement`, in
     * seconds.
     * @returns {number}
     */
    PlaybackObserver.prototype.getCurrentTime = function () {
        return this._mediaElement.currentTime;
    };
    /**
     * Returns the current playback rate advertised by the `HTMLMediaElement`.
     * @returns {number}
     */
    PlaybackObserver.prototype.getPlaybackRate = function () {
        return this._mediaElement.playbackRate;
    };
    /**
     * Returns the current `paused` status advertised by the `HTMLMediaElement`.
     *
     * Use this instead of the same status emitted on an observation when you want
     * to be sure you're using the current value.
     * @returns {boolean}
     */
    PlaybackObserver.prototype.getIsPaused = function () {
        return this._mediaElement.paused;
    };
    /**
     * Update the current position (seek) on the `HTMLMediaElement`, by giving a
     * new position in seconds.
     *
     * Note that seeks performed through this method are caracherized as
     * "internal" seeks. They don't result into the exact same playback
     * observation than regular seeks (which most likely comes from the outside,
     * e.g. the user).
     * @param {number} time
     */
    PlaybackObserver.prototype.setCurrentTime = function (time) {
        this._internalSeeksIncoming.push(time);
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
     * Returns an `IReadOnlySharedReference` storing the last playback observation
     * produced by the `PlaybackObserver` and updated each time a new one is
     * produced.
     *
     * This value can then be for example subscribed to to be notified of future
     * playback observations.
     *
     * @returns {Object}
     */
    PlaybackObserver.prototype.getReference = function () {
        return this._observationRef;
    };
    /**
     * Register a callback so it regularly receives playback observations.
     * @param {Function} cb
     * @param {Object} options - Configuration options:
     *   - `includeLastObservation`: If set to `true` the last observation will
     *     be first emitted synchronously.
     *   - `clearSignal`: If set, the callback will be unregistered when this
     *     CancellationSignal emits.
     */
    PlaybackObserver.prototype.listen = function (cb, options) {
        var _a;
        if (this._canceller.isUsed || ((_a = options === null || options === void 0 ? void 0 : options.clearSignal) === null || _a === void 0 ? void 0 : _a.isCancelled) === true) {
            return noop;
        }
        this._observationRef.onUpdate(cb, {
            clearSignal: options === null || options === void 0 ? void 0 : options.clearSignal,
            emitCurrentValue: options === null || options === void 0 ? void 0 : options.includeLastObservation,
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
     * @param {Function} transform
     * @returns {Object}
     */
    PlaybackObserver.prototype.deriveReadOnlyObserver = function (transform) {
        return generateReadOnlyObserver(this, transform, this._canceller.signal);
    };
    /**
     * Creates the `IReadOnlySharedReference` that will generate playback
     * observations.
     * @returns {Observable}
     */
    PlaybackObserver.prototype._createSharedReference = function () {
        var _this = this;
        if (this._observationRef !== undefined) {
            return this._observationRef;
        }
        var lastObservation;
        var _a = config.getCurrent(), SAMPLING_INTERVAL_MEDIASOURCE = _a.SAMPLING_INTERVAL_MEDIASOURCE, SAMPLING_INTERVAL_LOW_LATENCY = _a.SAMPLING_INTERVAL_LOW_LATENCY, SAMPLING_INTERVAL_NO_MEDIASOURCE = _a.SAMPLING_INTERVAL_NO_MEDIASOURCE;
        var getCurrentObservation = function (event) {
            var tmpEvt = event;
            var startedInternalSeekTime;
            if (tmpEvt === "seeking" && _this._internalSeeksIncoming.length > 0) {
                tmpEvt = "internal-seeking";
                startedInternalSeekTime = _this._internalSeeksIncoming.shift();
            }
            var _lastObservation = lastObservation !== null && lastObservation !== void 0 ? lastObservation : _this._generateInitialObservation();
            var mediaTimings = getMediaInfos(_this._mediaElement, tmpEvt, _this._withMediaSource);
            var pendingInternalSeek = null;
            if (mediaTimings.seeking) {
                if (typeof startedInternalSeekTime === "number") {
                    pendingInternalSeek = startedInternalSeekTime;
                }
                else if (_lastObservation.pendingInternalSeek !== null && event !== "seeking") {
                    pendingInternalSeek = _lastObservation.pendingInternalSeek;
                }
            }
            var rebufferingStatus = getRebufferingStatus(_lastObservation, mediaTimings, { lowLatencyMode: _this._lowLatencyMode,
                withMediaSource: _this._withMediaSource });
            var freezingStatus = getFreezingStatus(_lastObservation, mediaTimings);
            var timings = objectAssign({}, { rebuffering: rebufferingStatus,
                freezing: freezingStatus, pendingInternalSeek: pendingInternalSeek }, mediaTimings);
            if (log.hasLevel("DEBUG")) {
                log.debug("API: current media element state tick", "event", timings.event, "position", timings.position, "seeking", timings.seeking, "internalSeek", timings.pendingInternalSeek, "rebuffering", timings.rebuffering !== null, "freezing", timings.freezing !== null, "ended", timings.ended, "paused", timings.paused, "playbackRate", timings.playbackRate, "readyState", timings.readyState);
            }
            return timings;
        };
        var returnedSharedReference = createSharedReference(getCurrentObservation("init"));
        var generateObservationForEvent = function (event) {
            var newObservation = getCurrentObservation(event);
            if (log.hasLevel("DEBUG")) {
                log.debug("API: current playback timeline:\n" +
                    prettyPrintBuffered(newObservation.buffered, newObservation.position), "\n".concat(event));
            }
            lastObservation = newObservation;
            returnedSharedReference.setValue(newObservation);
        };
        var interval = this._lowLatencyMode ? SAMPLING_INTERVAL_LOW_LATENCY :
            this._withMediaSource ? SAMPLING_INTERVAL_MEDIASOURCE :
                SAMPLING_INTERVAL_NO_MEDIASOURCE;
        var intervalId = setInterval(onInterval, interval);
        var removeEventListeners = SCANNED_MEDIA_ELEMENTS_EVENTS.map(function (eventName) {
            _this._mediaElement.addEventListener(eventName, onMediaEvent);
            function onMediaEvent() {
                restartInterval();
                generateObservationForEvent(eventName);
            }
            return function () {
                _this._mediaElement.removeEventListener(eventName, onMediaEvent);
            };
        });
        this._canceller.signal.register(function () {
            clearInterval(intervalId);
            removeEventListeners.forEach(function (cb) { return cb(); });
            returnedSharedReference.finish();
        });
        return returnedSharedReference;
        function onInterval() {
            generateObservationForEvent("timeupdate");
        }
        function restartInterval() {
            clearInterval(intervalId);
            intervalId = setInterval(onInterval, interval);
        }
    };
    PlaybackObserver.prototype._generateInitialObservation = function () {
        return objectAssign(getMediaInfos(this._mediaElement, "init", this._withMediaSource), { rebuffering: null,
            freezing: null,
            pendingInternalSeek: null });
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
    var _a = config.getCurrent(), RESUME_GAP_AFTER_SEEKING = _a.RESUME_GAP_AFTER_SEEKING, RESUME_GAP_AFTER_NOT_ENOUGH_DATA = _a.RESUME_GAP_AFTER_NOT_ENOUGH_DATA, RESUME_GAP_AFTER_BUFFERING = _a.RESUME_GAP_AFTER_BUFFERING;
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
function hasLoadedUntilTheEnd(currentTime, currentRange, ended, duration, lowLatencyMode) {
    var REBUFFERING_GAP = config.getCurrent().REBUFFERING_GAP;
    var suffix = lowLatencyMode ? "LOW_LATENCY" :
        "DEFAULT";
    if (currentRange === undefined) {
        return ended && Math.abs(duration - currentTime) <= REBUFFERING_GAP[suffix];
    }
    return currentRange !== null &&
        (duration - currentRange.end) <= REBUFFERING_GAP[suffix];
}
/**
 * Get basic playback information.
 * @param {HTMLMediaElement} mediaElement
 * @param {string} event
 * @returns {Object}
 */
function getMediaInfos(mediaElement, event, withMediaSource) {
    var buffered = mediaElement.buffered, currentTime = mediaElement.currentTime, duration = mediaElement.duration, ended = mediaElement.ended, paused = mediaElement.paused, playbackRate = mediaElement.playbackRate, readyState = mediaElement.readyState, seeking = mediaElement.seeking;
    var currentRange;
    var bufferGap;
    if (!withMediaSource && buffered.length === 0 && readyState >= 3) {
        // Sometimes `buffered` stay empty for directfile contents yet we are able
        // to play. This seems to be linked to browser-side issues but has been
        // encountered on enough platforms (Chrome desktop and PlayStation 4's
        // WebKit for us to do something about it in the player.
        currentRange = undefined;
        bufferGap = undefined;
    }
    else {
        currentRange = getRange(buffered, currentTime);
        bufferGap = currentRange !== null ? currentRange.end - currentTime :
            // TODO null/0 would probably be
            // more appropriate
            Infinity;
    }
    return { bufferGap: bufferGap, buffered: buffered, currentRange: currentRange, position: currentTime, duration: duration, ended: ended, paused: paused, playbackRate: playbackRate, readyState: readyState, seeking: seeking, event: event };
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
    var REBUFFERING_GAP = config.getCurrent().REBUFFERING_GAP;
    var currentEvt = currentInfo.event, currentTime = currentInfo.position, bufferGap = currentInfo.bufferGap, currentRange = currentInfo.currentRange, duration = currentInfo.duration, paused = currentInfo.paused, readyState = currentInfo.readyState, ended = currentInfo.ended;
    var prevRebuffering = prevObservation.rebuffering, prevEvt = prevObservation.event, prevTime = prevObservation.position;
    var fullyLoaded = hasLoadedUntilTheEnd(currentTime, currentRange, ended, duration, lowLatencyMode);
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
            if (bufferGap === Infinity) {
                shouldRebuffer = true;
                rebufferEndPosition = currentTime;
            }
            else if (bufferGap === undefined) {
                if (readyState < 3) {
                    shouldRebuffer = true;
                    rebufferEndPosition = undefined;
                }
            }
            else if (bufferGap <= rebufferGap) {
                shouldRebuffer = true;
                rebufferEndPosition = currentTime + bufferGap;
            }
        }
        else if (prevRebuffering !== null) {
            var resumeGap = getRebufferingEndGap(prevRebuffering, lowLatencyMode);
            if (shouldRebuffer !== true && prevRebuffering !== null && readyState > 1 &&
                (fullyLoaded || ended ||
                    (bufferGap !== undefined && isFinite(bufferGap) && bufferGap > resumeGap)) ||
                (bufferGap === undefined && readyState >= 3)) {
                shouldStopRebuffer = true;
            }
            else if (bufferGap === undefined) {
                rebufferEndPosition = undefined;
            }
            else if (bufferGap === Infinity) {
                rebufferEndPosition = currentTime;
            }
            else if (bufferGap <= resumeGap) {
                rebufferEndPosition = currentTime + bufferGap;
            }
        }
    }
    // when using a direct file, the media will stall and unstall on its
    // own, so we only try to detect when the media timestamp has not changed
    // between two consecutive timeupdates
    else {
        if (canSwitchToRebuffering &&
            ((!paused &&
                currentEvt === "timeupdate" && prevEvt === "timeupdate" &&
                currentTime === prevTime) ||
                (currentEvt === "seeking" && (bufferGap === Infinity || (bufferGap === undefined && readyState < 3))))) {
            shouldRebuffer = true;
        }
        else if (prevRebuffering !== null &&
            ((currentEvt !== "seeking" && currentTime !== prevTime) ||
                currentEvt === "canplay" ||
                (bufferGap === undefined && readyState >= 3) ||
                (bufferGap !== undefined && bufferGap < Infinity &&
                    (bufferGap > getRebufferingEndGap(prevRebuffering, lowLatencyMode) ||
                        fullyLoaded || ended)))) {
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
    var MINIMUM_BUFFER_AMOUNT_BEFORE_FREEZING = config.getCurrent().MINIMUM_BUFFER_AMOUNT_BEFORE_FREEZING;
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
        currentInfo.bufferGap !== undefined &&
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
 * @param {Function} transform
 * @returns {Object}
 */
function generateReadOnlyObserver(src, transform, cancellationSignal) {
    var mappedRef = transform(src.getReference(), cancellationSignal);
    return {
        getCurrentTime: function () {
            return src.getCurrentTime();
        },
        getReadyState: function () {
            return src.getReadyState();
        },
        getPlaybackRate: function () {
            return src.getPlaybackRate();
        },
        getIsPaused: function () {
            return src.getIsPaused();
        },
        getReference: function () {
            return mappedRef;
        },
        listen: function (cb, options) {
            var _a;
            if (cancellationSignal.isCancelled || ((_a = options === null || options === void 0 ? void 0 : options.clearSignal) === null || _a === void 0 ? void 0 : _a.isCancelled) === true) {
                return;
            }
            mappedRef.onUpdate(cb, {
                clearSignal: options === null || options === void 0 ? void 0 : options.clearSignal,
                emitCurrentValue: options === null || options === void 0 ? void 0 : options.includeLastObservation,
            });
        },
        deriveReadOnlyObserver: function (newTransformFn) {
            return generateReadOnlyObserver(this, newTransformFn, cancellationSignal);
        },
    };
}
