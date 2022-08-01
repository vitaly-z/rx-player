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
import config from "../../../../../config";
import getInitSegment from "./get_init_segment";
import isPeriodFulfilled from "./is_period_fulfilled";
import { createDashUrlDetokenizer, createIndexURLs, } from "./tokens";
/**
 * IRepresentationIndex implementation for DASH' SegmentTemplate without a
 * SegmentTimeline.
 * @class TemplateRepresentationIndex
 */
var TemplateRepresentationIndex = /** @class */ (function () {
    /**
     * @param {Object} index
     * @param {Object} context
     */
    function TemplateRepresentationIndex(index, context) {
        var _a;
        var aggressiveMode = context.aggressiveMode, availabilityTimeOffset = context.availabilityTimeOffset, manifestBoundsCalculator = context.manifestBoundsCalculator, isDynamic = context.isDynamic, periodEnd = context.periodEnd, periodStart = context.periodStart, representationBaseURLs = context.representationBaseURLs, representationId = context.representationId, representationBitrate = context.representationBitrate, isEMSGWhitelisted = context.isEMSGWhitelisted;
        var timescale = (_a = index.timescale) !== null && _a !== void 0 ? _a : 1;
        var minBaseUrlAto = representationBaseURLs.length === 0 ?
            0 :
            representationBaseURLs.reduce(function (acc, rbu) {
                return Math.min(acc, rbu.availabilityTimeOffset);
            }, Infinity);
        this._availabilityTimeOffset = availabilityTimeOffset + minBaseUrlAto;
        this._manifestBoundsCalculator = manifestBoundsCalculator;
        this._aggressiveMode = aggressiveMode;
        var presentationTimeOffset = index.presentationTimeOffset != null ?
            index.presentationTimeOffset :
            0;
        var scaledStart = periodStart * timescale;
        var indexTimeOffset = presentationTimeOffset - scaledStart;
        if (index.duration === undefined) {
            throw new Error("Invalid SegmentTemplate: no duration");
        }
        var urlSources = representationBaseURLs.map(function (b) { return b.url; });
        this._index = { duration: index.duration, timescale: timescale, indexRange: index.indexRange, indexTimeOffset: indexTimeOffset, initialization: index.initialization == null ?
                undefined :
                { mediaURLs: createIndexURLs(urlSources, index.initialization.media, representationId, representationBitrate),
                    range: index.initialization.range },
            mediaURLs: createIndexURLs(urlSources, index.media, representationId, representationBitrate), presentationTimeOffset: presentationTimeOffset, startNumber: index.startNumber };
        this._isDynamic = isDynamic;
        this._periodStart = periodStart;
        this._scaledPeriodEnd = periodEnd === undefined ?
            undefined :
            (periodEnd - periodStart) * timescale;
        this._isEMSGWhitelisted = isEMSGWhitelisted;
    }
    /**
     * Construct init Segment.
     * @returns {Object}
     */
    TemplateRepresentationIndex.prototype.getInitSegment = function () {
        return getInitSegment(this._index, this._isEMSGWhitelisted);
    };
    /**
     * @param {Number} fromTime
     * @param {Number} dur
     * @returns {Array.<Object>}
     */
    TemplateRepresentationIndex.prototype.getSegments = function (fromTime, dur) {
        var index = this._index;
        var duration = index.duration, startNumber = index.startNumber, timescale = index.timescale, mediaURLs = index.mediaURLs;
        var scaledStart = this._periodStart * timescale;
        var scaledEnd = this._scaledPeriodEnd;
        // Convert the asked position to the right timescales, and consider them
        // relatively to the Period's start.
        var upFromPeriodStart = fromTime * timescale - scaledStart;
        var toFromPeriodStart = (fromTime + dur) * timescale - scaledStart;
        var firstSegmentStart = this._getFirstSegmentStart();
        var lastSegmentStart = this._getLastSegmentStart();
        if (firstSegmentStart == null || lastSegmentStart == null) {
            return [];
        }
        var startPosition = Math.max(firstSegmentStart, upFromPeriodStart);
        var lastWantedStartPosition = Math.min(lastSegmentStart, toFromPeriodStart);
        if ((lastWantedStartPosition + duration) <= startPosition) {
            return [];
        }
        var segments = [];
        // number corresponding to the Period's start
        var numberOffset = startNumber !== null && startNumber !== void 0 ? startNumber : 1;
        // calcul initial time from Period start, where the first segment would have
        // the `0` number
        var numberIndexedToZero = Math.floor(startPosition / duration);
        for (var timeFromPeriodStart = numberIndexedToZero * duration; timeFromPeriodStart <= lastWantedStartPosition; timeFromPeriodStart += duration) {
            // To obtain the real number, adds the real number from the Period's start
            var realNumber = numberIndexedToZero + numberOffset;
            var realDuration = scaledEnd != null &&
                timeFromPeriodStart + duration > scaledEnd ?
                scaledEnd - timeFromPeriodStart :
                duration;
            var realTime = timeFromPeriodStart + scaledStart;
            var manifestTime = timeFromPeriodStart + this._index.presentationTimeOffset;
            var detokenizedURLs = mediaURLs === null ?
                null :
                mediaURLs.map(createDashUrlDetokenizer(manifestTime, realNumber));
            var args = { id: String(realNumber),
                number: realNumber,
                time: realTime / timescale,
                end: (realTime + realDuration) / timescale,
                duration: realDuration / timescale,
                timescale: 1,
                isInit: false,
                scaledDuration: realDuration / timescale,
                mediaURLs: detokenizedURLs,
                timestampOffset: -(index.indexTimeOffset / timescale),
                complete: true,
                privateInfos: {
                    isEMSGWhitelisted: this._isEMSGWhitelisted,
                } };
            segments.push(args);
            numberIndexedToZero++;
        }
        return segments;
    };
    /**
     * Returns first possible position in the index, in seconds.
     * @returns {number|null|undefined}
     */
    TemplateRepresentationIndex.prototype.getFirstPosition = function () {
        var firstSegmentStart = this._getFirstSegmentStart();
        if (firstSegmentStart == null) {
            return firstSegmentStart; // return undefined or null
        }
        return (firstSegmentStart / this._index.timescale) + this._periodStart;
    };
    /**
     * Returns last possible position in the index, in seconds.
     * @returns {number|null}
     */
    TemplateRepresentationIndex.prototype.getLastPosition = function () {
        var _a;
        var lastSegmentStart = this._getLastSegmentStart();
        if (lastSegmentStart == null) {
            // In that case (null or undefined), getLastPosition should reflect
            // the result of getLastSegmentStart, as the meaning is the same for
            // the two functions. So, we return the result of the latter.
            return lastSegmentStart;
        }
        var lastSegmentEnd = Math.min(lastSegmentStart + this._index.duration, (_a = this._scaledPeriodEnd) !== null && _a !== void 0 ? _a : Infinity);
        return (lastSegmentEnd / this._index.timescale) + this._periodStart;
    };
    /**
     * Returns true if, based on the arguments, the index should be refreshed.
     * We never have to refresh a SegmentTemplate-based manifest.
     * @returns {Boolean}
     */
    TemplateRepresentationIndex.prototype.shouldRefresh = function () {
        return false;
    };
    /**
     * We cannot check for discontinuity in SegmentTemplate-based indexes.
     * @returns {null}
     */
    TemplateRepresentationIndex.prototype.checkDiscontinuity = function () {
        return null;
    };
    /**
     * @returns {Boolean}
     */
    TemplateRepresentationIndex.prototype.areSegmentsChronologicallyGenerated = function () {
        return true;
    };
    /**
     * Returns `true` if the given segment should still be available as of now
     * (not removed since and still request-able).
     * Returns `false` if that's not the case.
     * Returns `undefined` if we do not know whether that's the case or not.
     * @param {Object} segment
     * @returns {boolean|undefined}
     */
    TemplateRepresentationIndex.prototype.isSegmentStillAvailable = function (segment) {
        if (segment.isInit) {
            return true;
        }
        var segmentsForTime = this.getSegments(segment.time, 0.1);
        if (segmentsForTime.length === 0) {
            return false;
        }
        return segmentsForTime[0].time === segment.time &&
            segmentsForTime[0].end === segment.end &&
            segmentsForTime[0].number === segment.number;
    };
    /**
     * SegmentTemplate without a SegmentTimeline should not be updated.
     * @returns {Boolean}
     */
    TemplateRepresentationIndex.prototype.canBeOutOfSyncError = function () {
        return false;
    };
    /**
     * @returns {Boolean}
     */
    TemplateRepresentationIndex.prototype.isFinished = function () {
        if (!this._isDynamic) {
            return true;
        }
        if (this._scaledPeriodEnd === undefined) {
            return false;
        }
        var timescale = this._index.timescale;
        var lastSegmentStart = this._getLastSegmentStart();
        // As last segment start is null if live time is before
        // current period, consider the index not to be finished.
        if (lastSegmentStart == null) {
            return false;
        }
        var lastSegmentEnd = lastSegmentStart + this._index.duration;
        return isPeriodFulfilled(timescale, lastSegmentEnd, this._scaledPeriodEnd);
    };
    /**
     * @returns {Boolean}
     */
    TemplateRepresentationIndex.prototype.isInitialized = function () {
        return true;
    };
    /**
     * @param {Object} newIndex
     */
    TemplateRepresentationIndex.prototype._replace = function (newIndex) {
        this._index = newIndex._index;
        this._aggressiveMode = newIndex._aggressiveMode;
        this._isDynamic = newIndex._isDynamic;
        this._periodStart = newIndex._periodStart;
        this._scaledPeriodEnd = newIndex._scaledPeriodEnd;
        this._manifestBoundsCalculator = newIndex._manifestBoundsCalculator;
    };
    /**
     * @param {Object} newIndex
     */
    TemplateRepresentationIndex.prototype._update = function (newIndex) {
        // As segments are not declared individually, as long as this Representation
        // is present, we have every information we need
        this._replace(newIndex);
    };
    /**
     * Returns the timescaled start of the first segment that should be available,
     * relatively to the start of the Period.
     * @returns {number | null | undefined}
     */
    TemplateRepresentationIndex.prototype._getFirstSegmentStart = function () {
        if (!this._isDynamic) {
            return 0; // it is the start of the Period
        }
        // 1 - check that this index is already available
        if (this._scaledPeriodEnd === 0 || this._scaledPeriodEnd === undefined) {
            // /!\ The scaled max position augments continuously and might not
            // reflect exactly the real server-side value. As segments are
            // generated discretely.
            var maximumBound = this._manifestBoundsCalculator.estimateMaximumBound();
            if (maximumBound !== undefined && maximumBound < this._periodStart) {
                // Maximum position is before this period.
                // No segment is yet available here
                return null;
            }
        }
        var _a = this._index, duration = _a.duration, timescale = _a.timescale;
        var firstPosition = this._manifestBoundsCalculator.estimateMinimumBound();
        if (firstPosition === undefined) {
            return undefined;
        }
        var segmentTime = firstPosition > this._periodStart ?
            (firstPosition - this._periodStart) * timescale :
            0;
        var numberIndexedToZero = Math.floor(segmentTime / duration);
        return numberIndexedToZero * duration;
    };
    /**
     * Returns the timescaled start of the last segment that should be available,
     * relatively to the start of the Period.
     * Returns null if live time is before current period.
     * @returns {number|null|undefined}
     */
    TemplateRepresentationIndex.prototype._getLastSegmentStart = function () {
        var _a;
        var _b = this._index, duration = _b.duration, timescale = _b.timescale;
        if (this._isDynamic) {
            var lastPos = this._manifestBoundsCalculator.estimateMaximumBound();
            if (lastPos === undefined) {
                return undefined;
            }
            var agressiveModeOffset = this._aggressiveMode ? (duration / timescale) :
                0;
            if (this._scaledPeriodEnd != null &&
                this._scaledPeriodEnd <
                    (lastPos + agressiveModeOffset - this._periodStart) * this._index.timescale) {
                if (this._scaledPeriodEnd < duration) {
                    return null;
                }
                return (Math.floor(this._scaledPeriodEnd / duration) - 1) * duration;
            }
            // /!\ The scaled last position augments continuously and might not
            // reflect exactly the real server-side value. As segments are
            // generated discretely.
            var scaledLastPosition = (lastPos - this._periodStart) * timescale;
            // Maximum position is before this period.
            // No segment is yet available here
            if (scaledLastPosition < 0) {
                return null;
            }
            var availabilityTimeOffset = ((this._availabilityTimeOffset !== undefined ? this._availabilityTimeOffset : 0) +
                agressiveModeOffset) * timescale;
            var numberOfSegmentsAvailable = Math.floor((scaledLastPosition + availabilityTimeOffset) / duration);
            return numberOfSegmentsAvailable <= 0 ?
                null :
                (numberOfSegmentsAvailable - 1) * duration;
        }
        else {
            var maximumTime = (_a = this._scaledPeriodEnd) !== null && _a !== void 0 ? _a : 0;
            var numberIndexedToZero = Math.ceil(maximumTime / duration) - 1;
            var regularLastSegmentStart = numberIndexedToZero * duration;
            // In some SegmentTemplate, we could think that there is one more
            // segment that there actually is due to a very little difference between
            // the period's duration and a multiple of a segment's duration.
            // Check that we're within a good margin
            var minimumDuration = config.getCurrent().MINIMUM_SEGMENT_SIZE * timescale;
            if (maximumTime - regularLastSegmentStart > minimumDuration ||
                numberIndexedToZero === 0) {
                return regularLastSegmentStart;
            }
            return (numberIndexedToZero - 1) * duration;
        }
    };
    return TemplateRepresentationIndex;
}());
export default TemplateRepresentationIndex;
