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
import assert from "../../../../../utils/assert";
import getInitSegment from "./get_init_segment";
import { createDashUrlDetokenizer, constructRepresentationUrl, } from "./tokens";
import { getSegmentTimeRoundingError } from "./utils";
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
        var _a, _b;
        var aggressiveMode = context.aggressiveMode, availabilityTimeOffset = context.availabilityTimeOffset, manifestBoundsCalculator = context.manifestBoundsCalculator, isDynamic = context.isDynamic, periodEnd = context.periodEnd, periodStart = context.periodStart, representationId = context.representationId, representationBitrate = context.representationBitrate, isEMSGWhitelisted = context.isEMSGWhitelisted;
        var timescale = (_a = index.timescale) !== null && _a !== void 0 ? _a : 1;
        this._availabilityTimeOffset = availabilityTimeOffset;
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
        var initializationUrl = ((_b = index.initialization) === null || _b === void 0 ? void 0 : _b.media) === undefined ?
            null :
            constructRepresentationUrl(index.initialization.media, representationId, representationBitrate);
        var segmentUrlTemplate = index.media === undefined ?
            null :
            constructRepresentationUrl(index.media, representationId, representationBitrate);
        this._index = { duration: index.duration, timescale: timescale, indexRange: index.indexRange, indexTimeOffset: indexTimeOffset, initialization: index.initialization == null ?
                undefined :
                { url: initializationUrl,
                    range: index.initialization.range },
            url: segmentUrlTemplate, presentationTimeOffset: presentationTimeOffset, startNumber: index.startNumber };
        this._isDynamic = isDynamic;
        this._periodStart = periodStart;
        this._scaledRelativePeriodEnd = periodEnd === undefined ?
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
        var duration = index.duration, startNumber = index.startNumber, timescale = index.timescale, url = index.url;
        var scaledStart = this._periodStart * timescale;
        var scaledEnd = this._scaledRelativePeriodEnd;
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
            var detokenizedURL = url === null ?
                null :
                createDashUrlDetokenizer(manifestTime, realNumber)(url);
            var args = { id: String(realNumber),
                number: realNumber,
                time: realTime / timescale,
                end: (realTime + realDuration) / timescale,
                duration: realDuration / timescale,
                timescale: 1,
                isInit: false,
                scaledDuration: realDuration / timescale,
                url: detokenizedURL,
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
    TemplateRepresentationIndex.prototype.getFirstAvailablePosition = function () {
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
    TemplateRepresentationIndex.prototype.getLastAvailablePosition = function () {
        var _a;
        var lastSegmentStart = this._getLastSegmentStart();
        if (lastSegmentStart == null) {
            // In that case (null or undefined), getLastAvailablePosition should reflect
            // the result of getLastSegmentStart, as the meaning is the same for
            // the two functions. So, we return the result of the latter.
            return lastSegmentStart;
        }
        var lastSegmentEnd = Math.min(lastSegmentStart + this._index.duration, (_a = this._scaledRelativePeriodEnd) !== null && _a !== void 0 ? _a : Infinity);
        return (lastSegmentEnd / this._index.timescale) + this._periodStart;
    };
    /**
     * Returns the absolute end in seconds this RepresentationIndex can reach once
     * all segments are available.
     * @returns {number|null|undefined}
     */
    TemplateRepresentationIndex.prototype.getEnd = function () {
        if (!this._isDynamic) {
            return this.getLastAvailablePosition();
        }
        if (this._scaledRelativePeriodEnd === undefined) {
            return undefined;
        }
        var timescale = this._index.timescale;
        var absoluteScaledPeriodEnd = (this._scaledRelativePeriodEnd +
            this._periodStart * timescale);
        return absoluteScaledPeriodEnd / this._index.timescale;
    };
    /**
     * Returns:
     *   - `true` if in the given time interval, at least one new segment is
     *     expected to be available in the future.
     *   - `false` either if all segments in that time interval are already
     *     available for download or if none will ever be available for it.
     *   - `undefined` when it is not possible to tell.
     *
     * Always `false` in a `BaseRepresentationIndex` because all segments should
     * be directly available.
     * @returns {boolean}
     */
    TemplateRepresentationIndex.prototype.awaitSegmentBetween = function (start, end) {
        assert(start <= end);
        if (!this._isDynamic) {
            return false;
        }
        var timescale = this._index.timescale;
        var segmentTimeRounding = getSegmentTimeRoundingError(timescale);
        var scaledPeriodStart = this._periodStart * timescale;
        var scaledRelativeEnd = end * timescale - scaledPeriodStart;
        if (this._scaledRelativePeriodEnd === undefined) {
            return (scaledRelativeEnd + segmentTimeRounding) >= 0;
        }
        var scaledRelativePeriodEnd = this._scaledRelativePeriodEnd;
        var scaledRelativeStart = start * timescale - scaledPeriodStart;
        return (scaledRelativeStart - segmentTimeRounding) < scaledRelativePeriodEnd &&
            (scaledRelativeEnd + segmentTimeRounding) >= 0;
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
        if (this._scaledRelativePeriodEnd === undefined) {
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
        var segmentTimeRounding = getSegmentTimeRoundingError(timescale);
        return (lastSegmentEnd + segmentTimeRounding) >= this._scaledRelativePeriodEnd;
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
        this._scaledRelativePeriodEnd = newIndex._scaledRelativePeriodEnd;
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
        if (this._scaledRelativePeriodEnd === 0 ||
            this._scaledRelativePeriodEnd === undefined) {
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
            if (this._scaledRelativePeriodEnd != null &&
                this._scaledRelativePeriodEnd <
                    (lastPos + agressiveModeOffset - this._periodStart) * this._index.timescale) {
                if (this._scaledRelativePeriodEnd < duration) {
                    return null;
                }
                return (Math.floor(this._scaledRelativePeriodEnd / duration) - 1) * duration;
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
            var maximumTime = (_a = this._scaledRelativePeriodEnd) !== null && _a !== void 0 ? _a : 0;
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
