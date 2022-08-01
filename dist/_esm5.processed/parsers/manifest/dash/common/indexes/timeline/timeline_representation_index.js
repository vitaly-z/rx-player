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
import config from "../../../../../../config";
import { NetworkError } from "../../../../../../errors";
import log from "../../../../../../log";
import clearTimelineFromPosition from "../../../../utils/clear_timeline_from_position";
import { checkDiscontinuity, fromIndexTime, getIndexSegmentEnd, toIndexTime, } from "../../../../utils/index_helpers";
import isSegmentStillAvailable from "../../../../utils/is_segment_still_available";
import updateSegmentTimeline from "../../../../utils/update_segment_timeline";
import getInitSegment from "../get_init_segment";
import getSegmentsFromTimeline from "../get_segments_from_timeline";
import isPeriodFulfilled from "../is_period_fulfilled";
import { createIndexURLs } from "../tokens";
import constructTimelineFromElements from "./construct_timeline_from_elements";
// eslint-disable-next-line max-len
import constructTimelineFromPreviousTimeline from "./construct_timeline_from_previous_timeline";
var TimelineRepresentationIndex = /** @class */ (function () {
    /**
     * @param {Object} index
     * @param {Object} context
     */
    function TimelineRepresentationIndex(index, context) {
        var _a, _b, _c;
        if (!TimelineRepresentationIndex.isTimelineIndexArgument(index)) {
            throw new Error("The given index is not compatible with a " +
                "TimelineRepresentationIndex.");
        }
        var availabilityTimeComplete = context.availabilityTimeComplete, manifestBoundsCalculator = context.manifestBoundsCalculator, isDynamic = context.isDynamic, isLastPeriod = context.isLastPeriod, representationBaseURLs = context.representationBaseURLs, representationId = context.representationId, representationBitrate = context.representationBitrate, periodStart = context.periodStart, periodEnd = context.periodEnd, isEMSGWhitelisted = context.isEMSGWhitelisted;
        var timescale = (_a = index.timescale) !== null && _a !== void 0 ? _a : 1;
        var presentationTimeOffset = index.presentationTimeOffset != null ?
            index.presentationTimeOffset :
            0;
        var scaledStart = periodStart * timescale;
        var indexTimeOffset = presentationTimeOffset - scaledStart;
        this._manifestBoundsCalculator = manifestBoundsCalculator;
        this._isEMSGWhitelisted = isEMSGWhitelisted;
        this._isLastPeriod = isLastPeriod;
        this._lastUpdate = context.receivedTime == null ?
            performance.now() :
            context.receivedTime;
        this._unsafelyBaseOnPreviousIndex = null;
        if (context.unsafelyBaseOnPreviousRepresentation !== null &&
            context.unsafelyBaseOnPreviousRepresentation.index
                instanceof TimelineRepresentationIndex) {
            // avoid too much nested references, to keep memory down
            context.unsafelyBaseOnPreviousRepresentation
                .index._unsafelyBaseOnPreviousIndex = null;
            this._unsafelyBaseOnPreviousIndex = context
                .unsafelyBaseOnPreviousRepresentation.index;
        }
        this._isDynamic = isDynamic;
        this._parseTimeline = (_b = index.timelineParser) !== null && _b !== void 0 ? _b : null;
        var urlSources = representationBaseURLs.map(function (b) { return b.url; });
        this._index = { availabilityTimeComplete: availabilityTimeComplete, indexRange: index.indexRange, indexTimeOffset: indexTimeOffset, initialization: index.initialization == null ?
                undefined :
                {
                    mediaURLs: createIndexURLs(urlSources, index.initialization.media, representationId, representationBitrate),
                    range: index.initialization.range,
                },
            mediaURLs: createIndexURLs(urlSources, index.media, representationId, representationBitrate),
            startNumber: index.startNumber,
            timeline: (_c = index.timeline) !== null && _c !== void 0 ? _c : null, timescale: timescale };
        this._scaledPeriodStart = toIndexTime(periodStart, this._index);
        this._scaledPeriodEnd = periodEnd === undefined ? undefined :
            toIndexTime(periodEnd, this._index);
    }
    /**
     * Construct init Segment.
     * @returns {Object}
     */
    TimelineRepresentationIndex.prototype.getInitSegment = function () {
        return getInitSegment(this._index, this._isEMSGWhitelisted);
    };
    /**
     * Asks for segments to download for a given time range.
     * @param {Number} from - Beginning of the time wanted, in seconds
     * @param {Number} duration - duration wanted, in seconds
     * @returns {Array.<Object>}
     */
    TimelineRepresentationIndex.prototype.getSegments = function (from, duration) {
        this._refreshTimeline(); // clear timeline if needed
        if (this._index.timeline === null) {
            this._index.timeline = this._getTimeline();
        }
        // destructuring to please TypeScript
        var _a = this._index, mediaURLs = _a.mediaURLs, startNumber = _a.startNumber, timeline = _a.timeline, timescale = _a.timescale, indexTimeOffset = _a.indexTimeOffset;
        return getSegmentsFromTimeline({ mediaURLs: mediaURLs, startNumber: startNumber, timeline: timeline, timescale: timescale, indexTimeOffset: indexTimeOffset }, from, duration, this._isEMSGWhitelisted, this._scaledPeriodEnd);
    };
    /**
     * Returns true if the index should be refreshed.
     * @param {Number} _up
     * @param {Number} to
     * @returns {Boolean}
     */
    TimelineRepresentationIndex.prototype.shouldRefresh = function () {
        // DASH Manifest based on a SegmentTimeline should have minimumUpdatePeriod
        // attribute which should be sufficient to know when to refresh it.
        return false;
    };
    /**
     * Returns the starting time, in seconds, of the earliest segment currently
     * available.
     * Returns null if nothing is in the index
     * @returns {Number|null}
     */
    TimelineRepresentationIndex.prototype.getFirstPosition = function () {
        this._refreshTimeline();
        if (this._index.timeline === null) {
            this._index.timeline = this._getTimeline();
        }
        var timeline = this._index.timeline;
        return timeline.length === 0 ? null :
            fromIndexTime(Math.max(this._scaledPeriodStart, timeline[0].start), this._index);
    };
    /**
     * Returns the ending time, in seconds, of the last segment currently
     * available.
     * Returns null if nothing is in the index
     * @returns {Number|null}
     */
    TimelineRepresentationIndex.prototype.getLastPosition = function () {
        this._refreshTimeline();
        if (this._index.timeline === null) {
            this._index.timeline = this._getTimeline();
        }
        var lastTime = TimelineRepresentationIndex.getIndexEnd(this._index.timeline, this._scaledPeriodEnd);
        return lastTime === null ? null :
            fromIndexTime(lastTime, this._index);
    };
    /**
     * Returns true if a Segment returned by this index is still considered
     * available.
     * Returns false if it is not available anymore.
     * Returns undefined if we cannot know whether it is still available or not.
     * @param {Object} segment
     * @returns {Boolean|undefined}
     */
    TimelineRepresentationIndex.prototype.isSegmentStillAvailable = function (segment) {
        if (segment.isInit) {
            return true;
        }
        this._refreshTimeline();
        if (this._index.timeline === null) {
            this._index.timeline = this._getTimeline();
        }
        var _a = this._index, timeline = _a.timeline, timescale = _a.timescale, indexTimeOffset = _a.indexTimeOffset;
        return isSegmentStillAvailable(segment, timeline, timescale, indexTimeOffset);
    };
    /**
     * Checks if the time given is in a discontinuity. That is:
     *   - We're on the upper bound of the current range (end of the range - time
     *     is inferior to the timescale)
     *   - The next range starts after the end of the current range.
     * @param {Number} time
     * @returns {Number|null}
     */
    TimelineRepresentationIndex.prototype.checkDiscontinuity = function (time) {
        this._refreshTimeline();
        var timeline = this._index.timeline;
        if (timeline === null) {
            timeline = this._getTimeline();
            this._index.timeline = timeline;
        }
        return checkDiscontinuity({ timeline: timeline, timescale: this._index.timescale,
            indexTimeOffset: this._index.indexTimeOffset }, time, this._scaledPeriodEnd);
    };
    /**
     * @param {Error} error
     * @returns {Boolean}
     */
    TimelineRepresentationIndex.prototype.canBeOutOfSyncError = function (error) {
        if (!this._isDynamic) {
            return false;
        }
        return error instanceof NetworkError &&
            error.isHttpError(404);
    };
    TimelineRepresentationIndex.prototype.areSegmentsChronologicallyGenerated = function () {
        return true;
    };
    /**
     * Replace this RepresentationIndex with one from a new version of the
     * Manifest.
     * @param {Object} newIndex
     */
    TimelineRepresentationIndex.prototype._replace = function (newIndex) {
        this._parseTimeline = newIndex._parseTimeline;
        this._index = newIndex._index;
        this._isDynamic = newIndex._isDynamic;
        this._scaledPeriodStart = newIndex._scaledPeriodStart;
        this._scaledPeriodEnd = newIndex._scaledPeriodEnd;
        this._lastUpdate = newIndex._lastUpdate;
        this._manifestBoundsCalculator = newIndex._manifestBoundsCalculator;
        this._isLastPeriod = newIndex._isLastPeriod;
    };
    /**
     * Update this RepresentationIndex with a shorter version of it coming from a
     * new version of the MPD.
     * @param {Object} newIndex
     */
    TimelineRepresentationIndex.prototype._update = function (newIndex) {
        if (this._index.timeline === null) {
            this._index.timeline = this._getTimeline();
        }
        if (newIndex._index.timeline === null) {
            newIndex._index.timeline = newIndex._getTimeline();
        }
        var hasReplaced = updateSegmentTimeline(this._index.timeline, newIndex._index.timeline);
        if (hasReplaced) {
            this._index.startNumber = newIndex._index.startNumber;
        }
        this._isDynamic = newIndex._isDynamic;
        this._scaledPeriodStart = newIndex._scaledPeriodStart;
        this._scaledPeriodEnd = newIndex._scaledPeriodEnd;
        this._lastUpdate = newIndex._lastUpdate;
        this._isLastPeriod = newIndex._isLastPeriod;
    };
    /**
     * Returns `true` if this RepresentationIndex currently contains its last
     * segment.
     * Returns `false` if it's still pending.
     * @returns {Boolean}
     */
    TimelineRepresentationIndex.prototype.isFinished = function () {
        if (!this._isDynamic || !this._isLastPeriod) {
            // Either the content is not dynamic, in which case no new segment will
            // be generated, either it is but this index is not linked to the current
            // last Period in the MPD, in which case it is inferred that it has been
            // completely generated. Note that this second condition might break very
            // very rare use cases where old Periods are still being generated, yet it
            // should fix more cases than it breaks.
            return true;
        }
        if (this._index.timeline === null) {
            this._index.timeline = this._getTimeline();
        }
        var timeline = this._index.timeline;
        if (this._scaledPeriodEnd === undefined || timeline.length === 0) {
            return false;
        }
        var lastTimelineElement = timeline[timeline.length - 1];
        var lastTime = getIndexSegmentEnd(lastTimelineElement, null, this._scaledPeriodEnd);
        return isPeriodFulfilled(this._index.timescale, lastTime, this._scaledPeriodEnd);
    };
    /**
     * @returns {Boolean}
     */
    TimelineRepresentationIndex.prototype.isInitialized = function () {
        return true;
    };
    /**
     * Returns `true` if the given object can be used as an "index" argument to
     * create a new `TimelineRepresentationIndex`.
     * @param {Object} index
     * @returns {boolean}
     */
    TimelineRepresentationIndex.isTimelineIndexArgument = function (index) {
        return typeof index.timelineParser === "function" ||
            Array.isArray(index.timeline);
    };
    /**
     * Clean-up timeline to remove segment information which should not be
     * available due to timeshifting.
     */
    TimelineRepresentationIndex.prototype._refreshTimeline = function () {
        if (this._index.timeline === null) {
            this._index.timeline = this._getTimeline();
        }
        if (!this._isDynamic) {
            return;
        }
        var firstPosition = this._manifestBoundsCalculator.estimateMinimumBound();
        if (firstPosition == null) {
            return; // we don't know yet
        }
        var scaledFirstPosition = toIndexTime(firstPosition, this._index);
        var nbEltsRemoved = clearTimelineFromPosition(this._index.timeline, scaledFirstPosition);
        if (this._index.startNumber !== undefined) {
            this._index.startNumber += nbEltsRemoved;
        }
    };
    TimelineRepresentationIndex.getIndexEnd = function (timeline, scaledPeriodEnd) {
        if (timeline.length <= 0) {
            return null;
        }
        return Math.min(getIndexSegmentEnd(timeline[timeline.length - 1], null, scaledPeriodEnd), scaledPeriodEnd !== null && scaledPeriodEnd !== void 0 ? scaledPeriodEnd : Infinity);
    };
    /**
     * Allows to generate the "timeline" for this RepresentationIndex.
     * Call this function when the timeline is unknown.
     * This function was added to only perform that task lazily, i.e. only when
     * first needed.
     * After calling it, every now unneeded variable will be freed from memory.
     * This means that calling _getTimeline more than once will just return an
     * empty array.
     *
     * /!\ Please note that this structure should follow the exact same structure
     * than a SegmentTimeline element in the corresponding MPD.
     * This means:
     *   - It should have the same amount of elements in its array than there was
     *     `<S>` elements in the SegmentTimeline.
     *   - Each of those same elements should have the same start time, the same
     *     duration and the same repeat counter than what could be deduced from
     *     the SegmentTimeline.
     * This is needed to be able to run parsing optimization when refreshing the
     * MPD. Not doing so could lead to the RxPlayer not being able to play the
     * stream anymore.
     * @returns {Array.<Object>}
     */
    TimelineRepresentationIndex.prototype._getTimeline = function () {
        if (this._parseTimeline === null) {
            if (this._index.timeline !== null) {
                return this._index.timeline;
            }
            log.error("DASH: Timeline already lazily parsed.");
            return [];
        }
        var newElements = this._parseTimeline();
        this._parseTimeline = null; // Free memory
        var MIN_DASH_S_ELEMENTS_TO_PARSE_UNSAFELY = config.getCurrent().MIN_DASH_S_ELEMENTS_TO_PARSE_UNSAFELY;
        if (this._unsafelyBaseOnPreviousIndex === null ||
            newElements.length < MIN_DASH_S_ELEMENTS_TO_PARSE_UNSAFELY) {
            // Just completely parse the current timeline
            return constructTimelineFromElements(newElements);
        }
        // Construct previously parsed timeline if not already done
        var prevTimeline;
        if (this._unsafelyBaseOnPreviousIndex._index.timeline === null) {
            prevTimeline = this._unsafelyBaseOnPreviousIndex._getTimeline();
            this._unsafelyBaseOnPreviousIndex._index.timeline = prevTimeline;
        }
        else {
            prevTimeline = this._unsafelyBaseOnPreviousIndex._index.timeline;
        }
        this._unsafelyBaseOnPreviousIndex = null; // Free memory
        return constructTimelineFromPreviousTimeline(newElements, prevTimeline);
    };
    return TimelineRepresentationIndex;
}());
export default TimelineRepresentationIndex;
