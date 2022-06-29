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
import log from "../../../log";
import { areSameContent, } from "../../../manifest";
import takeFirstSet from "../../../utils/take_first_set";
import BufferedHistory from "./buffered_history";
/**
 * Keep track of every chunk downloaded and currently in the linked media
 * buffer.
 *
 * The main point of this class is to know which chunks are already pushed to
 * the corresponding media buffer, at which bitrate, and which have been garbage-collected
 * since by the browser (and thus may need to be re-loaded).
 * @class SegmentInventory
 */
var SegmentInventory = /** @class */ (function () {
    function SegmentInventory() {
        var _a = config.getCurrent(), BUFFERED_HISTORY_RETENTION_TIME = _a.BUFFERED_HISTORY_RETENTION_TIME, BUFFERED_HISTORY_MAXIMUM_ENTRIES = _a.BUFFERED_HISTORY_MAXIMUM_ENTRIES;
        this._inventory = [];
        this._bufferedHistory = new BufferedHistory(BUFFERED_HISTORY_RETENTION_TIME, BUFFERED_HISTORY_MAXIMUM_ENTRIES);
    }
    /**
     * Reset the whole inventory.
     */
    SegmentInventory.prototype.reset = function () {
        this._inventory.length = 0;
    };
    /**
     * Infer each segment's `bufferedStart` and `bufferedEnd` properties from the
     * TimeRanges given.
     *
     * The TimeRanges object given should come from the media buffer linked to
     * that SegmentInventory.
     *
     * /!\ A SegmentInventory should not be associated to multiple media buffers
     * at a time, so each `synchronizeBuffered` call should be given a TimeRanges
     * coming from the same buffer.
     * @param {TimeRanges} buffered
     */
    SegmentInventory.prototype.synchronizeBuffered = function (buffered) {
        var inventory = this._inventory;
        var inventoryIndex = 0; // Current index considered.
        var thisSegment = inventory[0]; // Current segmentInfos considered
        var MINIMUM_SEGMENT_SIZE = config.getCurrent().MINIMUM_SEGMENT_SIZE;
        /** Type of buffer considered, used for logs */
        var bufferType = thisSegment === null || thisSegment === void 0 ? void 0 : thisSegment.infos.adaptation.type;
        var rangesLength = buffered.length;
        for (var i = 0; i < rangesLength; i++) {
            if (thisSegment === undefined) { // we arrived at the end of our inventory
                return;
            }
            // take the i'nth contiguous buffered TimeRange
            var rangeStart = buffered.start(i);
            var rangeEnd = buffered.end(i);
            if (rangeEnd - rangeStart < MINIMUM_SEGMENT_SIZE) {
                log.warn("SI: skipped TimeRange when synchronizing because it was too small", bufferType, rangeStart, rangeEnd);
                continue;
            }
            var indexBefore = inventoryIndex; // keep track of that number
            // Find the first segment either within this TimeRange or completely past
            // it:
            // skip until first segment with at least `MINIMUM_SEGMENT_SIZE` past the
            // start of that range.
            while (thisSegment !== undefined &&
                (takeFirstSet(thisSegment.bufferedEnd, thisSegment.end)
                    - rangeStart) < MINIMUM_SEGMENT_SIZE) {
                thisSegment = inventory[++inventoryIndex];
            }
            // Contains infos about the last garbage-collected segment before
            // `thisSegment`.
            var lastDeletedSegmentInfos = null;
            // remove garbage-collected segments
            // (Those not in that TimeRange nor in the previous one)
            var numberOfSegmentToDelete = inventoryIndex - indexBefore;
            if (numberOfSegmentToDelete > 0) {
                var lastDeletedSegment = // last garbage-collected segment
                 inventory[indexBefore + numberOfSegmentToDelete - 1];
                lastDeletedSegmentInfos = {
                    end: takeFirstSet(lastDeletedSegment.bufferedEnd, lastDeletedSegment.end),
                    precizeEnd: lastDeletedSegment.precizeEnd,
                };
                log.debug("SI: ".concat(numberOfSegmentToDelete, " segments GCed."), bufferType);
                var removed = inventory.splice(indexBefore, numberOfSegmentToDelete);
                for (var _i = 0, removed_1 = removed; _i < removed_1.length; _i++) {
                    var seg = removed_1[_i];
                    if (seg.bufferedStart === undefined && seg.bufferedEnd === undefined) {
                        this._bufferedHistory.addBufferedSegment(seg.infos, null);
                    }
                }
                inventoryIndex = indexBefore;
            }
            if (thisSegment === undefined) {
                return;
            }
            // If the current segment is actually completely outside that range (it
            // is contained in one of the next one), skip that part.
            if (rangeEnd -
                takeFirstSet(thisSegment.bufferedStart, thisSegment.start)
                >= MINIMUM_SEGMENT_SIZE) {
                guessBufferedStartFromRangeStart(thisSegment, rangeStart, lastDeletedSegmentInfos, bufferType);
                if (inventoryIndex === inventory.length - 1) {
                    // This is the last segment in the inventory.
                    // We can directly update the end as the end of the current range.
                    guessBufferedEndFromRangeEnd(thisSegment, rangeEnd, bufferType);
                    return;
                }
                thisSegment = inventory[++inventoryIndex];
                // Make contiguous until first segment outside that range
                var thisSegmentStart = takeFirstSet(thisSegment.bufferedStart, thisSegment.start);
                var thisSegmentEnd = takeFirstSet(thisSegment.bufferedEnd, thisSegment.end);
                var nextRangeStart = i < rangesLength - 1 ? buffered.start(i + 1) :
                    undefined;
                while (thisSegment !== undefined &&
                    (rangeEnd - thisSegmentStart) >= MINIMUM_SEGMENT_SIZE &&
                    (nextRangeStart === undefined ||
                        rangeEnd - thisSegmentStart >= thisSegmentEnd - nextRangeStart)) {
                    var prevSegment = inventory[inventoryIndex - 1];
                    // those segments are contiguous, we have no way to infer their real
                    // end
                    if (prevSegment.bufferedEnd === undefined) {
                        prevSegment.bufferedEnd = thisSegment.precizeStart ? thisSegment.start :
                            prevSegment.end;
                        log.debug("SI: calculating buffered end of contiguous segment", bufferType, prevSegment.bufferedEnd, prevSegment.end);
                    }
                    thisSegment.bufferedStart = prevSegment.bufferedEnd;
                    thisSegment = inventory[++inventoryIndex];
                    if (thisSegment !== undefined) {
                        thisSegmentStart = takeFirstSet(thisSegment.bufferedStart, thisSegment.start);
                        thisSegmentEnd = takeFirstSet(thisSegment.bufferedEnd, thisSegment.end);
                    }
                }
            }
            // update the bufferedEnd of the last segment in that range
            var lastSegmentInRange = inventory[inventoryIndex - 1];
            if (lastSegmentInRange !== undefined) {
                guessBufferedEndFromRangeEnd(lastSegmentInRange, rangeEnd, bufferType);
            }
        }
        // if we still have segments left, they are not affiliated to any range.
        // They might have been garbage collected, delete them from here.
        if (thisSegment != null) {
            log.debug("SI: last segments have been GCed", bufferType, inventoryIndex, inventory.length);
            var removed = inventory.splice(inventoryIndex, inventory.length - inventoryIndex);
            for (var _a = 0, removed_2 = removed; _a < removed_2.length; _a++) {
                var seg = removed_2[_a];
                if (seg.bufferedStart === undefined && seg.bufferedEnd === undefined) {
                    this._bufferedHistory.addBufferedSegment(seg.infos, null);
                }
            }
        }
        if (bufferType !== undefined && log.hasLevel("DEBUG")) {
            log.debug("SI: current ".concat(bufferType, " inventory timeline:\n") +
                prettyPrintInventory(this._inventory));
        }
    };
    /**
     * Add a new chunk in the inventory.
     *
     * Chunks are decodable sub-parts of a whole segment. Once all chunks in a
     * segment have been inserted, you should call the `completeSegment` method.
     * @param {Object} chunkInformation
     */
    SegmentInventory.prototype.insertChunk = function (_a) {
        var period = _a.period, adaptation = _a.adaptation, representation = _a.representation, segment = _a.segment, chunkSize = _a.chunkSize, start = _a.start, end = _a.end;
        if (segment.isInit) {
            return;
        }
        var bufferType = adaptation.type;
        if (start >= end) {
            log.warn("SI: Invalid chunked inserted: starts before it ends", bufferType, start, end);
            return;
        }
        var inventory = this._inventory;
        var newSegment = { partiallyPushed: true, chunkSize: chunkSize, splitted: false, start: start, end: end, precizeStart: false,
            precizeEnd: false,
            bufferedStart: undefined,
            bufferedEnd: undefined,
            infos: { segment: segment, period: period, adaptation: adaptation, representation: representation } };
        // begin by the end as in most use cases this will be faster
        for (var i = inventory.length - 1; i >= 0; i--) {
            var segmentI = inventory[i];
            if ((segmentI.start) <= start) {
                if ((segmentI.end) <= start) {
                    // our segment is after, push it after this one
                    //
                    // Case 1:
                    //   prevSegment  : |------|
                    //   newSegment   :        |======|
                    //   ===>         : |------|======|
                    //
                    // Case 2:
                    //   prevSegment  : |------|
                    //   newSegment   :          |======|
                    //   ===>         : |------| |======|
                    log.debug("SI: Pushing segment strictly after previous one.", bufferType, start, segmentI.end);
                    this._inventory.splice(i + 1, 0, newSegment);
                    i += 2; // Go to segment immediately after newSegment
                    while (i < inventory.length && inventory[i].start < newSegment.end) {
                        if (inventory[i].end > newSegment.end) {
                            // The next segment ends after newSegment.
                            // Mutate the next segment.
                            //
                            // Case 1:
                            //   prevSegment  : |------|
                            //   newSegment   :        |======|
                            //   nextSegment  :            |----|
                            //   ===>         : |------|======|-|
                            log.debug("SI: Segment pushed updates the start of the next one", bufferType, newSegment.end, inventory[i].start);
                            inventory[i].start = newSegment.end;
                            inventory[i].bufferedStart = undefined;
                            inventory[i].precizeStart = inventory[i].precizeStart &&
                                newSegment.precizeEnd;
                            return;
                        }
                        // The next segment was completely contained in newSegment.
                        // Remove it.
                        //
                        // Case 1:
                        //   prevSegment  : |------|
                        //   newSegment   :        |======|
                        //   nextSegment  :          |---|
                        //   ===>         : |------|======|
                        //
                        // Case 2:
                        //   prevSegment  : |------|
                        //   newSegment   :        |======|
                        //   nextSegment  :          |----|
                        //   ===>         : |------|======|
                        log.debug("SI: Segment pushed removes the next one", bufferType, start, end, inventory[i].start, inventory[i].end);
                        inventory.splice(i, 1);
                    }
                    return;
                }
                else {
                    if (segmentI.start === start) {
                        if (segmentI.end <= end) {
                            // In those cases, replace
                            //
                            // Case 1:
                            //  prevSegment  : |-------|
                            //  newSegment   : |=======|
                            //  ===>         : |=======|
                            //
                            // Case 2:
                            //  prevSegment  : |-------|
                            //  newSegment   : |==========|
                            //  ===>         : |==========|
                            log.debug("SI: Segment pushed replace another one", bufferType, start, end, segmentI.end);
                            this._inventory.splice(i, 1, newSegment);
                            i += 1; // Go to segment immediately after newSegment
                            while (i < inventory.length && inventory[i].start < newSegment.end) {
                                if (inventory[i].end > newSegment.end) {
                                    // The next segment ends after newSegment.
                                    // Mutate the next segment.
                                    //
                                    // Case 1:
                                    //   newSegment   : |======|
                                    //   nextSegment  :      |----|
                                    //   ===>         : |======|--|
                                    log.debug("SI: Segment pushed updates the start of the next one", bufferType, newSegment.end, inventory[i].start);
                                    inventory[i].start = newSegment.end;
                                    inventory[i].bufferedStart = undefined;
                                    inventory[i].precizeStart = inventory[i].precizeStart &&
                                        newSegment.precizeEnd;
                                    return;
                                }
                                // The next segment was completely contained in newSegment.
                                // Remove it.
                                //
                                // Case 1:
                                //   newSegment   : |======|
                                //   nextSegment  :   |---|
                                //   ===>         : |======|
                                //
                                // Case 2:
                                //   newSegment   : |======|
                                //   nextSegment  :   |----|
                                //   ===>         : |======|
                                log.debug("SI: Segment pushed removes the next one", bufferType, start, end, inventory[i].start, inventory[i].end);
                                inventory.splice(i, 1);
                            }
                            return;
                        }
                        else {
                            // The previous segment starts at the same time and finishes
                            // after the new segment.
                            // Update the start of the previous segment and put the new
                            // segment before.
                            //
                            // Case 1:
                            //  prevSegment  : |------------|
                            //  newSegment   : |==========|
                            //  ===>         : |==========|-|
                            log.debug("SI: Segment pushed ends before another with the same start", bufferType, start, end, segmentI.end);
                            inventory.splice(i, 0, newSegment);
                            segmentI.start = newSegment.end;
                            segmentI.bufferedStart = undefined;
                            segmentI.precizeStart = segmentI.precizeStart &&
                                newSegment.precizeEnd;
                            return;
                        }
                    }
                    else {
                        if (segmentI.end <= newSegment.end) {
                            // our segment has a "complex" relation with this one,
                            // update the old one end and add this one after it.
                            //
                            // Case 1:
                            //  prevSegment  : |-------|
                            //  newSegment   :    |======|
                            //  ===>         : |--|======|
                            //
                            // Case 2:
                            //  prevSegment  : |-------|
                            //  newSegment   :    |====|
                            //  ===>         : |--|====|
                            log.debug("SI: Segment pushed updates end of previous one", bufferType, start, end, segmentI.start, segmentI.end);
                            this._inventory.splice(i + 1, 0, newSegment);
                            segmentI.end = newSegment.start;
                            segmentI.bufferedEnd = undefined;
                            segmentI.precizeEnd = segmentI.precizeEnd &&
                                newSegment.precizeStart;
                            i += 2; // Go to segment immediately after newSegment
                            while (i < inventory.length && inventory[i].start < newSegment.end) {
                                if (inventory[i].end > newSegment.end) {
                                    // The next segment ends after newSegment.
                                    // Mutate the next segment.
                                    //
                                    // Case 1:
                                    //   newSegment   : |======|
                                    //   nextSegment  :      |----|
                                    //   ===>         : |======|--|
                                    log.debug("SI: Segment pushed updates the start of the next one", bufferType, newSegment.end, inventory[i].start);
                                    inventory[i].start = newSegment.end;
                                    inventory[i].bufferedStart = undefined;
                                    inventory[i].precizeStart = inventory[i].precizeStart &&
                                        newSegment.precizeEnd;
                                    return;
                                }
                                // The next segment was completely contained in newSegment.
                                // Remove it.
                                //
                                // Case 1:
                                //   newSegment   : |======|
                                //   nextSegment  :   |---|
                                //   ===>         : |======|
                                //
                                // Case 2:
                                //   newSegment   : |======|
                                //   nextSegment  :   |----|
                                //   ===>         : |======|
                                log.debug("SI: Segment pushed removes the next one", bufferType, start, end, inventory[i].start, inventory[i].end);
                                inventory.splice(i, 1);
                            }
                            return;
                        }
                        else {
                            // The previous segment completely recovers the new segment.
                            // Split the previous segment into two segments, before and after
                            // the new segment.
                            //
                            // Case 1:
                            //  prevSegment  : |---------|
                            //  newSegment   :    |====|
                            //  ===>         : |--|====|-|
                            log.warn("SI: Segment pushed is contained in a previous one", bufferType, start, end, segmentI.start, segmentI.end);
                            var nextSegment = { partiallyPushed: segmentI.partiallyPushed,
                                /**
                                 * Note: this sadly means we're doing as if
                                 * that chunk is present two times.
                                 * Thankfully, this scenario should be
                                 * fairly rare.
                                 */
                                chunkSize: segmentI.chunkSize,
                                splitted: true,
                                start: newSegment.end,
                                end: segmentI.end,
                                precizeStart: segmentI.precizeStart &&
                                    segmentI.precizeEnd &&
                                    newSegment.precizeEnd,
                                precizeEnd: segmentI.precizeEnd,
                                bufferedStart: undefined,
                                bufferedEnd: segmentI.end,
                                infos: segmentI.infos };
                            segmentI.end = newSegment.start;
                            segmentI.splitted = true;
                            segmentI.bufferedEnd = undefined;
                            segmentI.precizeEnd = segmentI.precizeEnd &&
                                newSegment.precizeStart;
                            inventory.splice(i + 1, 0, newSegment);
                            inventory.splice(i + 2, 0, nextSegment);
                            return;
                        }
                    }
                }
            }
        }
        // if we got here, we are at the first segment
        // check bounds of the previous first segment
        var firstSegment = this._inventory[0];
        if (firstSegment === undefined) { // we do not have any segment yet
            log.debug("SI: first segment pushed", bufferType, start, end);
            this._inventory.push(newSegment);
            return;
        }
        if (firstSegment.start >= end) {
            // our segment is before, put it before
            //
            // Case 1:
            //  firstSegment :      |----|
            //  newSegment   : |====|
            //  ===>         : |====|----|
            //
            // Case 2:
            //  firstSegment :        |----|
            //  newSegment   : |====|
            //  ===>         : |====| |----|
            log.debug("SI: Segment pushed comes before all previous ones", bufferType, start, end, firstSegment.start);
            this._inventory.splice(0, 0, newSegment);
        }
        else if (firstSegment.end <= end) {
            // Our segment is bigger, replace the first
            //
            // Case 1:
            //  firstSegment :   |---|
            //  newSegment   : |=======|
            //  ===>         : |=======|
            //
            // Case 2:
            //  firstSegment :   |-----|
            //  newSegment   : |=======|
            //  ===>         : |=======|
            log.debug("SI: Segment pushed starts before and completely " +
                "recovers the previous first one", bufferType, start, end, firstSegment.start, firstSegment.end);
            this._inventory.splice(0, 1, newSegment);
            while (inventory.length > 1 && inventory[1].start < newSegment.end) {
                if (inventory[1].end > newSegment.end) {
                    // The next segment ends after newSegment.
                    // Mutate the next segment.
                    //
                    // Case 1:
                    //   newSegment   : |======|
                    //   nextSegment  :      |----|
                    //   ===>         : |======|--|
                    log.debug("SI: Segment pushed updates the start of the next one", bufferType, newSegment.end, inventory[1].start);
                    inventory[1].start = newSegment.end;
                    inventory[1].bufferedStart = undefined;
                    inventory[1].precizeStart = newSegment.precizeEnd;
                    return;
                }
                // The next segment was completely contained in newSegment.
                // Remove it.
                //
                // Case 1:
                //   newSegment   : |======|
                //   nextSegment  :   |---|
                //   ===>         : |======|
                //
                // Case 2:
                //   newSegment   : |======|
                //   nextSegment  :   |----|
                //   ===>         : |======|
                log.debug("SI: Segment pushed removes the next one", bufferType, start, end, inventory[1].start, inventory[1].end);
                inventory.splice(1, 1);
            }
            return;
        }
        else {
            // our segment has a "complex" relation with the first one,
            // update the old one start and add this one before it.
            //
            // Case 1:
            //  firstSegment :    |------|
            //  newSegment   : |======|
            //  ===>         : |======|--|
            log.debug("SI: Segment pushed start of the next one", bufferType, start, end, firstSegment.start, firstSegment.end);
            firstSegment.start = end;
            firstSegment.bufferedStart = undefined;
            firstSegment.precizeStart = newSegment.precizeEnd;
            this._inventory.splice(0, 0, newSegment);
            return;
        }
    };
    /**
     * Indicate that inserted chunks can now be considered as a complete segment.
     * Take in argument the same content than what was given to `insertChunk` for
     * the corresponding chunks.
     * @param {Object} content
     */
    SegmentInventory.prototype.completeSegment = function (content, newBuffered) {
        if (content.segment.isInit) {
            return;
        }
        var inventory = this._inventory;
        var resSegments = [];
        for (var i = 0; i < inventory.length; i++) {
            if (areSameContent(inventory[i].infos, content)) {
                var splitted = false;
                if (resSegments.length > 0) {
                    splitted = true;
                    if (resSegments.length === 1) {
                        log.warn("SI: Completed Segment is splitted.", content.segment.id, content.segment.time, content.segment.end);
                        resSegments[0].splitted = true;
                    }
                }
                var firstI = i;
                var segmentSize = inventory[i].chunkSize;
                i += 1;
                while (i < inventory.length &&
                    areSameContent(inventory[i].infos, content)) {
                    var chunkSize = inventory[i].chunkSize;
                    if (segmentSize !== undefined && chunkSize !== undefined) {
                        segmentSize += chunkSize;
                    }
                    i++;
                }
                var lastI = i - 1;
                var length_1 = lastI - firstI;
                var lastEnd = inventory[lastI].end;
                var lastBufferedEnd = inventory[lastI].bufferedEnd;
                if (length_1 > 0) {
                    this._inventory.splice(firstI + 1, length_1);
                    i -= length_1;
                }
                this._inventory[firstI].partiallyPushed = false;
                this._inventory[firstI].chunkSize = segmentSize;
                this._inventory[firstI].end = lastEnd;
                this._inventory[firstI].bufferedEnd = lastBufferedEnd;
                this._inventory[firstI].splitted = splitted;
                resSegments.push(this._inventory[firstI]);
            }
        }
        if (resSegments.length === 0) {
            log.warn("SI: Completed Segment not found", content.segment.id, content.segment.time);
        }
        else {
            this.synchronizeBuffered(newBuffered);
            for (var _i = 0, resSegments_1 = resSegments; _i < resSegments_1.length; _i++) {
                var seg = resSegments_1[_i];
                if (seg.bufferedStart !== undefined && seg.bufferedEnd !== undefined) {
                    this._bufferedHistory.addBufferedSegment(seg.infos, { start: seg.bufferedStart,
                        end: seg.bufferedEnd });
                }
                else {
                    log.debug("SI: buffered range not known after sync. Skipping history.", seg.start, seg.end);
                }
            }
        }
    };
    /**
     * Returns the whole inventory.
     *
     * To get a list synchronized with what a media buffer actually has buffered
     * you might want to call `synchronizeBuffered` before calling this method.
     * @returns {Array.<Object>}
     */
    SegmentInventory.prototype.getInventory = function () {
        return this._inventory;
    };
    /**
     * Returns a recent history of registered operations performed and event
     * received linked to the segment given in argument.
     *
     * Not all operations and events are registered in the returned history.
     * Please check the return type for more information on what is available.
     *
     * Note that history is short-lived for memory usage and performance reasons.
     * You may not receive any information on operations that happened too long
     * ago.
     * @param {Object} context
     * @returns {Array.<Object>}
     */
    SegmentInventory.prototype.getHistoryFor = function (context) {
        return this._bufferedHistory.getHistoryFor(context);
    };
    return SegmentInventory;
}());
export default SegmentInventory;
/**
 * Returns `true` if the buffered start of the given chunk looks coherent enough
 * relatively to what is announced in the Manifest.
 * @param {Object} thisSegment
 * @returns {Boolean}
 */
function bufferedStartLooksCoherent(thisSegment) {
    if (thisSegment.bufferedStart === undefined ||
        thisSegment.partiallyPushed) {
        return false;
    }
    var start = thisSegment.start, end = thisSegment.end;
    var duration = end - start;
    var _a = config.getCurrent(), MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE = _a.MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE, MAX_MANIFEST_BUFFERED_DURATION_DIFFERENCE = _a.MAX_MANIFEST_BUFFERED_DURATION_DIFFERENCE;
    return Math.abs(start - thisSegment.bufferedStart) <=
        MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE &&
        (thisSegment.bufferedEnd === undefined ||
            thisSegment.bufferedEnd > thisSegment.bufferedStart &&
                Math.abs(thisSegment.bufferedEnd - thisSegment.bufferedStart -
                    duration) <= Math.min(MAX_MANIFEST_BUFFERED_DURATION_DIFFERENCE, duration / 3));
}
/**
 * Returns `true` if the buffered end of the given chunk looks coherent enough
 * relatively to what is announced in the Manifest.
 * @param {Object} thisSegment
 * @returns {Boolean}
 */
function bufferedEndLooksCoherent(thisSegment) {
    if (thisSegment.bufferedEnd === undefined ||
        thisSegment.partiallyPushed) {
        return false;
    }
    var start = thisSegment.start, end = thisSegment.end;
    var duration = end - start;
    var _a = config.getCurrent(), MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE = _a.MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE, MAX_MANIFEST_BUFFERED_DURATION_DIFFERENCE = _a.MAX_MANIFEST_BUFFERED_DURATION_DIFFERENCE;
    return Math.abs(end - thisSegment.bufferedEnd) <=
        MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE &&
        thisSegment.bufferedStart != null &&
        thisSegment.bufferedEnd > thisSegment.bufferedStart &&
        Math.abs(thisSegment.bufferedEnd - thisSegment.bufferedStart -
            duration) <= Math.min(MAX_MANIFEST_BUFFERED_DURATION_DIFFERENCE, duration / 3);
}
/**
 * Evaluate the given buffered Chunk's buffered start from its range's start,
 * considering that this chunk is the first one in it.
 * @param {Object} firstSegmentInRange
 * @param {number} rangeStart
 * @param {Object} lastDeletedSegmentInfos
 */
function guessBufferedStartFromRangeStart(firstSegmentInRange, rangeStart, lastDeletedSegmentInfos, bufferType) {
    var MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE = config.getCurrent().MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE;
    if (firstSegmentInRange.bufferedStart !== undefined) {
        if (firstSegmentInRange.bufferedStart < rangeStart) {
            log.debug("SI: Segment partially GCed at the start", bufferType, firstSegmentInRange.bufferedStart, rangeStart);
            firstSegmentInRange.bufferedStart = rangeStart;
        }
        if (!firstSegmentInRange.precizeStart &&
            bufferedStartLooksCoherent(firstSegmentInRange)) {
            firstSegmentInRange.start = firstSegmentInRange.bufferedStart;
            firstSegmentInRange.precizeStart = true;
        }
    }
    else if (firstSegmentInRange.precizeStart) {
        log.debug("SI: buffered start is precize start", bufferType, firstSegmentInRange.start);
        firstSegmentInRange.bufferedStart = firstSegmentInRange.start;
    }
    else if (lastDeletedSegmentInfos !== null &&
        lastDeletedSegmentInfos.end > rangeStart &&
        (lastDeletedSegmentInfos.precizeEnd ||
            firstSegmentInRange.start - lastDeletedSegmentInfos.end <=
                MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE)) {
        log.debug("SI: buffered start is end of previous segment", bufferType, rangeStart, firstSegmentInRange.start, lastDeletedSegmentInfos.end);
        firstSegmentInRange.bufferedStart = lastDeletedSegmentInfos.end;
        if (bufferedStartLooksCoherent(firstSegmentInRange)) {
            firstSegmentInRange.start = lastDeletedSegmentInfos.end;
            firstSegmentInRange.precizeStart = true;
        }
    }
    else if (firstSegmentInRange.start - rangeStart <=
        MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE) {
        log.debug("SI: found true buffered start", bufferType, rangeStart, firstSegmentInRange.start);
        firstSegmentInRange.bufferedStart = rangeStart;
        if (bufferedStartLooksCoherent(firstSegmentInRange)) {
            firstSegmentInRange.start = rangeStart;
            firstSegmentInRange.precizeStart = true;
        }
    }
    else if (rangeStart < firstSegmentInRange.start) {
        log.debug("SI: range start too far from expected start", bufferType, rangeStart, firstSegmentInRange.start);
    }
    else {
        log.debug("SI: Segment appears immediately garbage collected at the start", bufferType, firstSegmentInRange.bufferedStart, rangeStart);
        firstSegmentInRange.bufferedStart = rangeStart;
    }
}
/**
 * Evaluate the given buffered Chunk's buffered end from its range's end,
 * considering that this chunk is the last one in it.
 * @param {Object} lastSegmentInRange
 * @param {number} rangeEnd
 * @param {string} bufferType
 */
function guessBufferedEndFromRangeEnd(lastSegmentInRange, rangeEnd, bufferType) {
    var MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE = config.getCurrent().MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE;
    if (lastSegmentInRange.bufferedEnd !== undefined) {
        if (lastSegmentInRange.bufferedEnd > rangeEnd) {
            log.debug("SI: Segment partially GCed at the end", bufferType, lastSegmentInRange.bufferedEnd, rangeEnd);
            lastSegmentInRange.bufferedEnd = rangeEnd;
        }
        if (!lastSegmentInRange.precizeEnd &&
            rangeEnd - lastSegmentInRange.end <= MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE &&
            bufferedEndLooksCoherent(lastSegmentInRange)) {
            lastSegmentInRange.precizeEnd = true;
            lastSegmentInRange.end = rangeEnd;
        }
    }
    else if (lastSegmentInRange.precizeEnd) {
        log.debug("SI: buffered end is precize end", bufferType, lastSegmentInRange.end);
        lastSegmentInRange.bufferedEnd = lastSegmentInRange.end;
    }
    else if (rangeEnd - lastSegmentInRange.end <=
        MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE) {
        log.debug("SI: found true buffered end", bufferType, rangeEnd, lastSegmentInRange.end);
        lastSegmentInRange.bufferedEnd = rangeEnd;
        if (bufferedEndLooksCoherent(lastSegmentInRange)) {
            lastSegmentInRange.end = rangeEnd;
            lastSegmentInRange.precizeEnd = true;
        }
    }
    else if (rangeEnd > lastSegmentInRange.end) {
        log.debug("SI: range end too far from expected end", bufferType, rangeEnd, lastSegmentInRange.end);
        lastSegmentInRange.bufferedEnd = lastSegmentInRange.end;
    }
    else {
        log.debug("SI: Segment appears immediately garbage collected at the end", bufferType, lastSegmentInRange.bufferedEnd, rangeEnd);
        lastSegmentInRange.bufferedEnd = rangeEnd;
    }
}
/**
 * Pretty print the inventory, to easily note which segments are where in the
 * current buffer.
 *
 * This is mostly useful when logging.
 *
 * @example
 * This function is called by giving it the inventory, such as:
 * ```js
 * prettyPrintInventory(inventory);
 * ```
 *
 * Let's consider this possible return:
 * ```
 * 0.00|A|9.00 ~ 9.00|B|45.08 ~ 282.08|B|318.08
 * [A] P: gen-dash-period-0 || R: video/5(2362822)
 * [B] P: gen-dash-period-0 || R: video/6(2470094)
 * ```
 * We have a first part, from 0 to 9 seconds, which contains segments for
 * the Representation with the id "video/5" and an associated bitrate of
 * 2362822 bits per seconds (in the Period with the id "gen-dash-period-0").
 *
 * Then from 9.00 seconds to 45.08 seconds, we have segments from another
 * Representation from the same Period (with the id "video/6" and a bitrate
 * of 2470094 bits per seconds).
 *
 * At last we have a long time between 45.08 and 282.08 with no segment followed
 * by a segment from that same Representation between 282.08 seconds and 318.08
 * seconds.
 * @param {Array.<Object>} inventory
 * @returns {string}
 */
function prettyPrintInventory(inventory) {
    var _a;
    var roundingError = 1 / 60;
    var encounteredReps = {};
    var letters = [];
    var lastChunk = null;
    var lastLetter = null;
    function generateNewLetter(infos) {
        var currentLetter = String.fromCharCode(letters.length + 65);
        letters.push({ letter: currentLetter,
            periodId: infos.period.id,
            representationId: infos.representation.id,
            bitrate: infos.representation.bitrate });
        return currentLetter;
    }
    var str = "";
    for (var i = 0; i < inventory.length; i++) {
        var chunk = inventory[i];
        if (chunk.bufferedStart !== undefined && chunk.bufferedEnd !== undefined) {
            var periodId = chunk.infos.period.id;
            var representationId = chunk.infos.representation.id;
            var encounteredPeriod = encounteredReps[periodId];
            var currentLetter = void 0;
            if (encounteredPeriod === undefined) {
                currentLetter = generateNewLetter(chunk.infos);
                encounteredReps[periodId] = (_a = {}, _a[representationId] = currentLetter, _a);
            }
            else if (encounteredPeriod[representationId] === undefined) {
                currentLetter = generateNewLetter(chunk.infos);
                encounteredPeriod[representationId] = currentLetter;
            }
            else {
                currentLetter = encounteredPeriod[representationId];
            }
            if (lastChunk === null) {
                str += "".concat(chunk.bufferedStart.toFixed(2), "|").concat(currentLetter, "|");
            }
            else if (lastLetter === currentLetter) {
                if (lastChunk.bufferedEnd + roundingError < chunk.bufferedStart) {
                    str += "".concat(lastChunk.bufferedEnd.toFixed(2), " ~ ") +
                        "".concat(chunk.bufferedStart.toFixed(2), "|").concat(currentLetter, "|");
                }
            }
            else {
                str += "".concat(lastChunk.bufferedEnd.toFixed(2), " ~ ") +
                    "".concat(chunk.bufferedStart.toFixed(2), "|").concat(currentLetter, "|");
            }
            lastChunk = chunk;
            lastLetter = currentLetter;
        }
    }
    if (lastChunk !== null) {
        str += String(lastChunk.end.toFixed(2));
    }
    letters.forEach(function (letterInfo) {
        var _a;
        str += "\n[".concat(letterInfo.letter, "] ") +
            "P: ".concat(letterInfo.periodId, " || R: ").concat(letterInfo.representationId) +
            "(".concat((_a = letterInfo.bitrate) !== null && _a !== void 0 ? _a : "unknown bitrate", ")");
    });
    return str;
}
