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
import config from "../../../config";
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
import { SegmentBufferOperation, } from "../../segment_buffers";
import checkForDiscontinuity from "./check_for_discontinuity";
import getNeededSegments from "./get_needed_segments";
import getSegmentPriority from "./get_segment_priority";
/**
 * Checks on the current buffered data for the given type and Period
 * and returns what should be done to fill the buffer according to the buffer
 * goal, the Representation chosen, etc.
 * Also emits discontinuities if found, which are parts of the buffer that won't
 * be filled by any segment, even in the future.
 *
 * @param {Object} content
 * @param {number} initialWantedTime
 * @param {Object} playbackObserver
 * @param {number|undefined} fastSwitchThreshold
 * @param {number} bufferGoal
 * @param {number} maxBufferSize
 * @param {Object} segmentBuffer
 * @returns {Object}
 */
export default function getBufferStatus(content, initialWantedTime, playbackObserver, fastSwitchThreshold, bufferGoal, maxBufferSize, segmentBuffer) {
    segmentBuffer.synchronizeInventory();
    var representation = content.representation;
    var askedStart = playbackObserver.getIsPaused() ||
        playbackObserver.getPlaybackRate() <= 0 ?
        initialWantedTime - 0.1 :
        initialWantedTime;
    var neededRange = getRangeOfNeededSegments(content, askedStart, bufferGoal);
    var shouldRefreshManifest = representation.index.shouldRefresh(neededRange.start, neededRange.end);
    /**
     * Every segment awaiting an "EndOfSegment" operation, which indicates that a
     * completely-loaded segment is still being pushed to the SegmentBuffer.
     */
    var segmentsBeingPushed = segmentBuffer.getPendingOperations()
        .filter(function (operation) {
        return operation.type === SegmentBufferOperation.EndOfSegment;
    }).map(function (operation) { return operation.value; });
    /** Data on every segments buffered around `neededRange`. */
    var bufferedSegments = getPlayableBufferedSegments({ start: Math.max(neededRange.start - 0.5, 0),
        end: neededRange.end + 0.5 }, segmentBuffer.getInventory());
    var currentPlaybackTime = playbackObserver.getCurrentTime();
    /** Callback allowing to retrieve a segment's history in the buffer. */
    var getBufferedHistory = segmentBuffer.getSegmentHistory.bind(segmentBuffer);
    /** List of segments we will need to download. */
    var _a = getNeededSegments({ content: content, bufferedSegments: bufferedSegments, currentPlaybackTime: currentPlaybackTime, fastSwitchThreshold: fastSwitchThreshold, getBufferedHistory: getBufferedHistory, neededRange: neededRange, segmentsBeingPushed: segmentsBeingPushed, maxBufferSize: maxBufferSize }), segmentsToLoad = _a.segmentsToLoad, segmentsOnHold = _a.segmentsOnHold, isBufferFull = _a.isBufferFull;
    var prioritizedNeededSegments = segmentsToLoad.map(function (segment) { return ({
        priority: getSegmentPriority(segment.time, askedStart),
        segment: segment,
    }); });
    /**
     * `true` if the current `RepresentationStream` has loaded all the
     * needed segments for this Representation until the end of the Period.
     */
    var hasFinishedLoading = representation.index.isInitialized() &&
        representation.index.isFinished() &&
        neededRange.hasReachedPeriodEnd &&
        prioritizedNeededSegments.length === 0 &&
        segmentsOnHold.length === 0;
    /**
     * Start time in seconds of the next available not-yet pushed segment.
     * `null` if no segment is wanted for the current wanted range.
     */
    var nextSegmentStart = null;
    if (segmentsBeingPushed.length > 0) {
        nextSegmentStart = Math.min.apply(Math, segmentsBeingPushed.map(function (info) { return info.segment.time; }));
    }
    if (segmentsOnHold.length > 0) {
        nextSegmentStart = nextSegmentStart !== null ?
            Math.min(nextSegmentStart, segmentsOnHold[0].time) :
            segmentsOnHold[0].time;
    }
    if (prioritizedNeededSegments.length > 0) {
        nextSegmentStart = nextSegmentStart !== null ?
            Math.min(nextSegmentStart, prioritizedNeededSegments[0].segment.time) :
            prioritizedNeededSegments[0].segment.time;
    }
    var imminentDiscontinuity = checkForDiscontinuity(content, neededRange, nextSegmentStart, hasFinishedLoading, bufferedSegments);
    return { imminentDiscontinuity: imminentDiscontinuity, hasFinishedLoading: hasFinishedLoading, neededSegments: prioritizedNeededSegments, isBufferFull: isBufferFull, shouldRefreshManifest: shouldRefreshManifest };
}
/**
 * Returns both the time range of segments that should be loaded (from a
 * starting position to an ending position) and whether the end of the Period is
 * reached by that range.
 * @param {Object} content
 * @param {number} initialWantedTime
 * @param {number} bufferGoal
 * @returns {Object}
 */
function getRangeOfNeededSegments(content, initialWantedTime, bufferGoal) {
    var _a;
    var wantedStartPosition;
    var manifest = content.manifest, period = content.period, representation = content.representation;
    var lastIndexPosition = representation.index.getLastAvailablePosition();
    var representationIndex = representation.index;
    // There is an exception for when the current initially wanted time is already
    // after the last position with segments AND when we're playing the absolute
    // last Period in the Manifest.
    // In that case, we want to actually request at least the last segment to
    // avoid ending the last Period - and by extension the content - with a
    // segment which isn't the last one.
    if (!isNullOrUndefined(lastIndexPosition) &&
        initialWantedTime >= lastIndexPosition &&
        representationIndex.isInitialized() &&
        representationIndex.isFinished() &&
        isPeriodTheCurrentAndLastOne(manifest, period, initialWantedTime)) {
        wantedStartPosition = lastIndexPosition - 1;
    }
    else {
        wantedStartPosition = initialWantedTime - 0.1;
    }
    var wantedEndPosition = wantedStartPosition + bufferGoal;
    var hasReachedPeriodEnd;
    if (!representation.index.isInitialized() ||
        !representation.index.isFinished() ||
        period.end === undefined) {
        hasReachedPeriodEnd = false;
    }
    else if (lastIndexPosition === undefined) {
        // We do not know the end of this index.
        hasReachedPeriodEnd = wantedEndPosition >= period.end;
    }
    else if (lastIndexPosition === null) {
        // There is no available segment in the index currently.
        hasReachedPeriodEnd = true;
    }
    else {
        // We have a declared end. Check that our range went until the last
        // position available in the index. If that's the case and we're left
        // with no segments after filtering them, it means we already have
        // downloaded the last segments and have nothing left to do: full.
        hasReachedPeriodEnd = wantedEndPosition >= lastIndexPosition;
    }
    return { start: Math.max(wantedStartPosition, period.start),
        end: Math.min(wantedEndPosition, (_a = period.end) !== null && _a !== void 0 ? _a : Infinity), hasReachedPeriodEnd: hasReachedPeriodEnd };
}
/**
 * Returns `true` if the given Period is both:
 *   - the one being played (the current position is known from `time`)
 *   - the absolute last one in the Manifest (that is, there will never be a
 *     Period after it).
 * @param {Object} manifest
 * @param {Object} period
 * @param {number} time
 * @returns {boolean}
 */
function isPeriodTheCurrentAndLastOne(manifest, period, time) {
    var _a;
    return period.containsTime(time) &&
        manifest.isLastPeriodKnown &&
        period.id === ((_a = manifest.periods[manifest.periods.length - 1]) === null || _a === void 0 ? void 0 : _a.id);
}
/**
 * From the given SegmentInventory, filters the "playable" (in a supported codec
 * and not known to be undecipherable) buffered Segment Objects which overlap
 * with the given range.
 * @param {Object} neededRange
 * @param {Array.<Object>} segmentInventory
 * @returns {Array.<Object>}
 */
function getPlayableBufferedSegments(neededRange, segmentInventory) {
    var MINIMUM_SEGMENT_SIZE = config.getCurrent().MINIMUM_SEGMENT_SIZE;
    var segmentRoundingError = Math.max(1 / 60, MINIMUM_SEGMENT_SIZE);
    var minEnd = neededRange.start + segmentRoundingError;
    var maxStart = neededRange.end - segmentRoundingError;
    var overlappingChunks = [];
    for (var i = segmentInventory.length - 1; i >= 0; i--) {
        var eltInventory = segmentInventory[i];
        var representation = eltInventory.infos.representation;
        if (!eltInventory.partiallyPushed &&
            representation.decipherable !== false &&
            representation.isSupported) {
            var inventorySegment = eltInventory.infos.segment;
            var eltInventoryStart = inventorySegment.time /
                inventorySegment.timescale;
            var eltInventoryEnd = !inventorySegment.complete ?
                eltInventory.end :
                eltInventoryStart + inventorySegment.duration / inventorySegment.timescale;
            if ((eltInventoryEnd > minEnd && eltInventoryStart < maxStart) ||
                (eltInventory.end > minEnd && eltInventory.start < maxStart)) {
                overlappingChunks.unshift(eltInventory);
            }
        }
    }
    return overlappingChunks;
}
