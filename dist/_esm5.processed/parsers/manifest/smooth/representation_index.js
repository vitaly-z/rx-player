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
import { NetworkError } from "../../../errors";
import log from "../../../log";
import clearTimelineFromPosition from "../utils/clear_timeline_from_position";
import { checkDiscontinuity, getIndexSegmentEnd, } from "../utils/index_helpers";
import isSegmentStillAvailable from "../utils/is_segment_still_available";
import updateSegmentTimeline from "../utils/update_segment_timeline";
import addSegmentInfos from "./utils/add_segment_infos";
import { replaceSegmentSmoothTokens } from "./utils/tokens";
/**
 * @param {Number} start
 * @param {Number} up
 * @param {Number} duration
 * @returns {Number}
 */
function getSegmentNumber(start, up, duration) {
    var diff = up - start;
    return diff > 0 ? Math.floor(diff / duration) :
        0;
}
/**
 * Convert second-based start time and duration to the timescale of the
 * manifest's index.
 * @param {Object} index
 * @param {Number} start
 * @param {Number} duration
 * @returns {Object} - Object with two properties:
 *   - up {Number}: timescaled timestamp of the beginning time
 *   - to {Number}: timescaled timestamp of the end time (start time + duration)
 */
function normalizeRange(index, start, duration) {
    var timescale = index.timescale === undefined ||
        index.timescale === 0 ? 1 :
        index.timescale;
    return { up: start * timescale,
        to: (start + duration) * timescale };
}
/**
 * Calculate the number of times a segment repeat based on the next segment.
 * @param {Object} segment
 * @param {Object} nextSegment
 * @returns {Number}
 */
function calculateRepeat(segment, nextSegment) {
    var repeatCount = segment.repeatCount;
    // A negative value of the @r attribute of the S element indicates
    // that the duration indicated in @d attribute repeats until the
    // start of the next S element, the end of the Period or until the
    // next MPD update.
    // TODO Also for SMOOTH????
    if (segment.duration != null && repeatCount < 0) {
        var repeatEnd = nextSegment !== undefined ? nextSegment.start :
            Infinity;
        repeatCount = Math.ceil((repeatEnd - segment.start) / segment.duration) - 1;
    }
    return repeatCount;
}
/**
 * RepresentationIndex implementation for Smooth Manifests.
 *
 * Allows to interact with the index to create new Segments.
 *
 * @class SmoothRepresentationIndex
 */
var SmoothRepresentationIndex = /** @class */ (function () {
    /**
     * Creates a new `SmoothRepresentationIndex`.
     * @param {Object} index
     * @param {Object} options
     */
    function SmoothRepresentationIndex(index, options) {
        var aggressiveMode = options.aggressiveMode, isLive = options.isLive, segmentPrivateInfos = options.segmentPrivateInfos, timeShiftBufferDepth = options.timeShiftBufferDepth;
        var estimatedReceivedTime = options.manifestReceivedTime == null ?
            performance.now() :
            options.manifestReceivedTime;
        this._index = index;
        this._indexValidityTime = estimatedReceivedTime;
        this._timeShiftBufferDepth = timeShiftBufferDepth;
        this._initSegmentInfos = { bitsPerSample: segmentPrivateInfos.bitsPerSample,
            channels: segmentPrivateInfos.channels,
            codecPrivateData: segmentPrivateInfos.codecPrivateData,
            packetSize: segmentPrivateInfos.packetSize,
            samplingRate: segmentPrivateInfos.samplingRate,
            timescale: index.timescale,
            protection: segmentPrivateInfos.protection };
        this._isAggressiveMode = aggressiveMode;
        this._isLive = isLive;
        if (index.timeline.length !== 0) {
            var lastItem = index.timeline[index.timeline.length - 1];
            var scaledEnd = getIndexSegmentEnd(lastItem, null);
            this._initialScaledLastPosition = scaledEnd;
            if (isLive) {
                var scaledReceivedTime = (estimatedReceivedTime / 1000) * index.timescale;
                this._scaledLiveGap = scaledReceivedTime - scaledEnd;
            }
        }
    }
    /**
     * Construct init Segment compatible with a Smooth Manifest.
     * @returns {Object}
     */
    SmoothRepresentationIndex.prototype.getInitSegment = function () {
        return { id: "init",
            isInit: true,
            privateInfos: { smoothInitSegment: this._initSegmentInfos },
            mediaURLs: null,
            time: 0,
            end: 0,
            duration: 0,
            timescale: 1,
            complete: true };
    };
    /**
     * Generate a list of Segments for a particular period of time.
     *
     * @param {Number} from
     * @param {Number} duration
     * @returns {Array.<Object>}
     */
    SmoothRepresentationIndex.prototype.getSegments = function (from, dur) {
        this._refreshTimeline();
        var _a = normalizeRange(this._index, from, dur), up = _a.up, to = _a.to;
        var _b = this._index, timeline = _b.timeline, timescale = _b.timescale, media = _b.media;
        var isAggressive = this._isAggressiveMode;
        var currentNumber;
        var segments = [];
        var timelineLength = timeline.length;
        var maxPosition = this._scaledLiveGap == null ?
            undefined :
            ((performance.now() / 1000) * timescale) - this._scaledLiveGap;
        for (var i = 0; i < timelineLength; i++) {
            var segmentRange = timeline[i];
            var duration = segmentRange.duration, start = segmentRange.start;
            var repeat = calculateRepeat(segmentRange, timeline[i + 1]);
            var segmentNumberInCurrentRange = getSegmentNumber(start, up, duration);
            var segmentTime = start + segmentNumberInCurrentRange * duration;
            var timeToAddToCheckMaxPosition = isAggressive ? 0 :
                duration;
            while (segmentTime < to &&
                segmentNumberInCurrentRange <= repeat &&
                (maxPosition == null ||
                    (segmentTime + timeToAddToCheckMaxPosition) <= maxPosition)) {
                var time = segmentTime;
                var number = currentNumber != null ?
                    currentNumber + segmentNumberInCurrentRange :
                    undefined;
                var segment = { id: String(segmentTime),
                    isInit: false,
                    time: time / timescale,
                    end: (time + duration) / timescale,
                    duration: duration / timescale,
                    timescale: 1, number: number, mediaURLs: [replaceSegmentSmoothTokens(media, time)],
                    complete: true,
                    privateInfos: { smoothMediaSegment: { time: time, duration: duration } } };
                segments.push(segment);
                // update segment number and segment time for the next segment
                segmentNumberInCurrentRange++;
                segmentTime = start + segmentNumberInCurrentRange * duration;
            }
            if (segmentTime >= to) {
                // we reached ``to``, we're done
                return segments;
            }
            if (currentNumber != null) {
                currentNumber += repeat + 1;
            }
        }
        return segments;
    };
    /**
     * Returns true if, based on the arguments, the index should be refreshed.
     * (If we should re-fetch the manifest)
     * @param {Number} up
     * @param {Number} to
     * @returns {Boolean}
     */
    SmoothRepresentationIndex.prototype.shouldRefresh = function (up, to) {
        this._refreshTimeline();
        if (!this._isLive) {
            return false;
        }
        var _a = this._index, timeline = _a.timeline, timescale = _a.timescale;
        var lastSegmentInCurrentTimeline = timeline[timeline.length - 1];
        if (lastSegmentInCurrentTimeline === undefined) {
            return false;
        }
        var repeat = lastSegmentInCurrentTimeline.repeatCount;
        var endOfLastSegmentInCurrentTimeline = lastSegmentInCurrentTimeline.start + (repeat + 1) *
            lastSegmentInCurrentTimeline.duration;
        if (to * timescale < endOfLastSegmentInCurrentTimeline) {
            return false;
        }
        if (up * timescale >= endOfLastSegmentInCurrentTimeline) {
            return true;
        }
        // ----
        var startOfLastSegmentInCurrentTimeline = lastSegmentInCurrentTimeline.start + repeat *
            lastSegmentInCurrentTimeline.duration;
        return (up * timescale) > startOfLastSegmentInCurrentTimeline;
    };
    /**
     * Returns first position available in the index.
     *
     * @param {Object} index
     * @returns {Number|null}
     */
    SmoothRepresentationIndex.prototype.getFirstPosition = function () {
        this._refreshTimeline();
        var index = this._index;
        if (index.timeline.length === 0) {
            return null;
        }
        return index.timeline[0].start / index.timescale;
    };
    /**
     * Returns last position available in the index.
     * @param {Object} index
     * @returns {Number}
     */
    SmoothRepresentationIndex.prototype.getLastPosition = function () {
        this._refreshTimeline();
        var index = this._index;
        if (this._scaledLiveGap == null) {
            var lastTimelineElement = index.timeline[index.timeline.length - 1];
            return getIndexSegmentEnd(lastTimelineElement, null) / index.timescale;
        }
        for (var i = index.timeline.length - 1; i >= 0; i--) {
            var timelineElt = index.timeline[i];
            var timescaledNow = (performance.now() / 1000) * index.timescale;
            var start = timelineElt.start, duration = timelineElt.duration, repeatCount = timelineElt.repeatCount;
            for (var j = repeatCount; j >= 0; j--) {
                var end = start + (duration * (j + 1));
                var positionToReach = this._isAggressiveMode ? end - duration :
                    end;
                if (positionToReach <= timescaledNow - this._scaledLiveGap) {
                    return end / index.timescale;
                }
            }
        }
        return undefined;
    };
    /**
     * Checks if `timeSec` is in a discontinuity.
     * That is, if there's no segment available for the `timeSec` position.
     * @param {number} timeSec - The time to check if it's in a discontinuity, in
     * seconds.
     * @returns {number | null} - If `null`, no discontinuity is encountered at
     * `time`. If this is a number instead, there is one and that number is the
     * position for which a segment is available in seconds.
     */
    SmoothRepresentationIndex.prototype.checkDiscontinuity = function (timeSec) {
        this._refreshTimeline();
        return checkDiscontinuity(this._index, timeSec, undefined);
    };
    /**
     * Returns `true` as Smooth segments should always be generated in
     * chronological order.
     * @returns {boolean}
     */
    SmoothRepresentationIndex.prototype.areSegmentsChronologicallyGenerated = function () {
        return true;
    };
    /**
     * Returns `true` if a Segment returned by this index is still considered
     * available.
     * Returns `false` if it is not available anymore.
     * Returns `undefined` if we cannot know whether it is still available or not.
     * @param {Object} segment
     * @returns {Boolean|undefined}
     */
    SmoothRepresentationIndex.prototype.isSegmentStillAvailable = function (segment) {
        if (segment.isInit) {
            return true;
        }
        this._refreshTimeline();
        var _a = this._index, timeline = _a.timeline, timescale = _a.timescale;
        return isSegmentStillAvailable(segment, timeline, timescale, 0);
    };
    /**
     * @param {Error} error
     * @returns {Boolean}
     */
    SmoothRepresentationIndex.prototype.canBeOutOfSyncError = function (error) {
        if (!this._isLive) {
            return false;
        }
        return error instanceof NetworkError &&
            (error.isHttpError(404) || error.isHttpError(412));
    };
    /**
     * Replace this RepresentationIndex by a newly downloaded one.
     * Check if the old index had more information about new segments and re-add
     * them if that's the case.
     * @param {Object} newIndex
     */
    SmoothRepresentationIndex.prototype._replace = function (newIndex) {
        var oldTimeline = this._index.timeline;
        var newTimeline = newIndex._index.timeline;
        var oldTimescale = this._index.timescale;
        var newTimescale = newIndex._index.timescale;
        this._index = newIndex._index;
        this._initialScaledLastPosition = newIndex._initialScaledLastPosition;
        this._indexValidityTime = newIndex._indexValidityTime;
        this._scaledLiveGap = newIndex._scaledLiveGap;
        if (oldTimeline.length === 0 ||
            newTimeline.length === 0 ||
            oldTimescale !== newTimescale) {
            return; // don't take risk, if something is off, take the new one
        }
        var lastOldTimelineElement = oldTimeline[oldTimeline.length - 1];
        var lastNewTimelineElement = newTimeline[newTimeline.length - 1];
        var newEnd = getIndexSegmentEnd(lastNewTimelineElement, null);
        if (getIndexSegmentEnd(lastOldTimelineElement, null) <= newEnd) {
            return;
        }
        for (var i = 0; i < oldTimeline.length; i++) {
            var oldTimelineRange = oldTimeline[i];
            var oldEnd = getIndexSegmentEnd(oldTimelineRange, null);
            if (oldEnd === newEnd) { // just add the supplementary segments
                this._index.timeline = this._index.timeline.concat(oldTimeline.slice(i + 1));
                return;
            }
            if (oldEnd > newEnd) { // adjust repeatCount + add supplementary segments
                if (oldTimelineRange.duration !== lastNewTimelineElement.duration) {
                    return;
                }
                var rangeDuration = newEnd - oldTimelineRange.start;
                if (rangeDuration === 0) {
                    log.warn("Smooth Parser: a discontinuity detected in the previous manifest" +
                        " has been resolved.");
                    this._index.timeline = this._index.timeline.concat(oldTimeline.slice(i));
                    return;
                }
                if (rangeDuration < 0 || rangeDuration % oldTimelineRange.duration !== 0) {
                    return;
                }
                var repeatWithOld = (rangeDuration / oldTimelineRange.duration) - 1;
                var relativeRepeat = oldTimelineRange.repeatCount - repeatWithOld;
                if (relativeRepeat < 0) {
                    return;
                }
                lastNewTimelineElement.repeatCount += relativeRepeat;
                var supplementarySegments = oldTimeline.slice(i + 1);
                this._index.timeline = this._index.timeline.concat(supplementarySegments);
                return;
            }
        }
    };
    /**
     * Update the current index with a new, partial, version.
     * This method might be use to only add information about new segments.
     * @param {Object} newIndex
     */
    SmoothRepresentationIndex.prototype._update = function (newIndex) {
        updateSegmentTimeline(this._index.timeline, newIndex._index.timeline);
        this._initialScaledLastPosition = newIndex._initialScaledLastPosition;
        this._indexValidityTime = newIndex._indexValidityTime;
        this._scaledLiveGap = newIndex._scaledLiveGap;
    };
    /**
     * Returns `true` if the last segments in this index have already been
     * generated.
     * Returns `false` if the index is still waiting on future segments to be
     * generated.
     *
     * For Smooth, it should only depend on whether the content is a live content
     * or not.
     * TODO What about Smooth live content that finishes at some point?
     * @returns {boolean}
     */
    SmoothRepresentationIndex.prototype.isFinished = function () {
        return !this._isLive;
    };
    /**
     * @returns {Boolean}
     */
    SmoothRepresentationIndex.prototype.isInitialized = function () {
        return true;
    };
    /**
     * Add new segments to a `SmoothRepresentationIndex`.
     * @param {Array.<Object>} nextSegments - The segment information parsed.
     * @param {Object} segment - Information on the segment which contained that
     * new segment information.
     */
    SmoothRepresentationIndex.prototype.addNewSegments = function (nextSegments, currentSegment) {
        this._refreshTimeline();
        for (var i = 0; i < nextSegments.length; i++) {
            addSegmentInfos(this._index, nextSegments[i], currentSegment);
        }
    };
    /**
     * Clean-up timeline to remove segment information which should not be
     * available due to the timeshift window
     */
    SmoothRepresentationIndex.prototype._refreshTimeline = function () {
        // clean segments before time shift buffer depth
        if (this._initialScaledLastPosition == null) {
            return;
        }
        var index = this._index;
        var timeShiftBufferDepth = this._timeShiftBufferDepth;
        var timeSinceLastRealUpdate = (performance.now() -
            this._indexValidityTime) / 1000;
        var lastPositionEstimate = timeSinceLastRealUpdate +
            this._initialScaledLastPosition / index.timescale;
        if (timeShiftBufferDepth != null) {
            var minimumPosition = (lastPositionEstimate - timeShiftBufferDepth) *
                index.timescale;
            clearTimelineFromPosition(index.timeline, minimumPosition);
        }
    };
    return SmoothRepresentationIndex;
}());
export default SmoothRepresentationIndex;
