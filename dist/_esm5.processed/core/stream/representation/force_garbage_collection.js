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
import { concatAll, defer as observableDefer, from as observableFrom, of as observableOf, } from "rxjs";
import config from "../../../config";
import log from "../../../log";
import { getInnerAndOuterTimeRanges } from "../../../utils/ranges";
/**
 * Run the garbage collector.
 *
 * Try to clean up buffered ranges from a low gcGap at first.
 * If it does not succeed to clean up space, use a higher gcCap.
 *
 * @param {Observable} timings$
 * @param {Object} bufferingQueue
 * @returns {Observable}
 */
export default function forceGarbageCollection(currentPosition, bufferingQueue) {
    return observableDefer(function () {
        var GC_GAP_CALM = config.getCurrent().BUFFER_GC_GAPS.CALM;
        var GC_GAP_BEEFY = config.getCurrent().BUFFER_GC_GAPS.BEEFY;
        log.warn("Stream: Running garbage collector");
        var buffered = bufferingQueue.getBufferedRanges();
        var cleanedupRanges = selectGCedRanges(currentPosition, buffered, GC_GAP_CALM);
        // more aggressive GC if we could not find any range to clean
        if (cleanedupRanges.length === 0) {
            cleanedupRanges = selectGCedRanges(currentPosition, buffered, GC_GAP_BEEFY);
        }
        log.debug("Stream: GC cleaning", cleanedupRanges);
        return observableFrom(cleanedupRanges.map(function (_a) {
            var start = _a.start, end = _a.end;
            return start >= end ? observableOf(null) :
                bufferingQueue.removeBuffer(start, end);
        })).pipe(concatAll());
    });
}
/**
 * Buffer garbage collector algorithm.
 *
 * Tries to free up some part of the ranges that are distant from the current
 * playing time.
 * See: https://w3c.github.io/media-source/#sourcebuffer-prepare-append
 *
 * @param {Number} position
 * @param {TimeRanges} buffered - current buffered ranges
 * @param {Number} gcGap - delta gap from current timestamp from which we
 * should consider cleaning up.
 * @returns {Array.<Object>} - Ranges selected for clean up
 */
function selectGCedRanges(position, buffered, gcGap) {
    var _a = getInnerAndOuterTimeRanges(buffered, position), innerRange = _a.innerRange, outerRanges = _a.outerRanges;
    var cleanedupRanges = [];
    // start by trying to remove all ranges that do not contain the
    // current time and respect the gcGap
    for (var i = 0; i < outerRanges.length; i++) {
        var outerRange = outerRanges[i];
        if (position - gcGap > outerRange.end) {
            cleanedupRanges.push(outerRange);
        }
        else if (position + gcGap < outerRange.start) {
            cleanedupRanges.push(outerRange);
        }
    }
    // try to clean up some space in the current range
    if (innerRange !== null) {
        log.debug("Stream: GC removing part of inner range", cleanedupRanges);
        if (position - gcGap > innerRange.start) {
            cleanedupRanges.push({ start: innerRange.start,
                end: position - gcGap });
        }
        if (position + gcGap < innerRange.end) {
            cleanedupRanges.push({ start: position + gcGap,
                end: innerRange.end });
        }
    }
    return cleanedupRanges;
}
