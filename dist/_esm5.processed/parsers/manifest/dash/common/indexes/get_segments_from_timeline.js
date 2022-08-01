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
import { calculateRepeat, toIndexTime, } from "../../../utils/index_helpers";
import { createDashUrlDetokenizer } from "./tokens";
/**
 * For the given start time and duration of a timeline element, calculate how
 * much this element should be repeated to contain the time given.
 * 0 being the same element, 1 being the next one etc.
 * @param {Number} segmentStartTime
 * @param {Number} segmentDuration
 * @param {Number} wantedTime
 * @returns {Number}
 */
function getWantedRepeatIndex(segmentStartTime, segmentDuration, wantedTime) {
    var diff = wantedTime - segmentStartTime;
    return diff > 0 ? Math.floor(diff / segmentDuration) :
        0;
}
/**
 * Get a list of Segments for the time range wanted.
 * @param {Object} index - index object, constructed by parsing the manifest.
 * @param {number} from - starting timestamp wanted, in seconds
 * @param {number} durationWanted - duration wanted, in seconds
 * @param {function} isEMSGWhitelisted
 * @param {number|undefined} maximumTime
 * @returns {Array.<Object>}
 */
export default function getSegmentsFromTimeline(index, from, durationWanted, isEMSGWhitelisted, maximumTime) {
    var scaledUp = toIndexTime(from, index);
    var scaledTo = toIndexTime(from + durationWanted, index);
    var timeline = index.timeline, timescale = index.timescale, mediaURLs = index.mediaURLs, startNumber = index.startNumber;
    var currentNumber = startNumber !== null && startNumber !== void 0 ? startNumber : 1;
    var segments = [];
    var timelineLength = timeline.length;
    for (var i = 0; i < timelineLength; i++) {
        var timelineItem = timeline[i];
        var duration = timelineItem.duration, start = timelineItem.start, range = timelineItem.range;
        var repeat = calculateRepeat(timelineItem, timeline[i + 1], maximumTime);
        var complete = index.availabilityTimeComplete !== false ||
            i !== timelineLength - 1 &&
                repeat !== 0;
        var segmentNumberInCurrentRange = getWantedRepeatIndex(start, duration, scaledUp);
        var segmentTime = start + segmentNumberInCurrentRange * duration;
        while (segmentTime < scaledTo && segmentNumberInCurrentRange <= repeat) {
            var segmentNumber = currentNumber + segmentNumberInCurrentRange;
            var detokenizedURLs = mediaURLs === null ?
                null :
                mediaURLs.map(createDashUrlDetokenizer(segmentTime, segmentNumber));
            var time = segmentTime - index.indexTimeOffset;
            var realDuration = duration;
            if (time < 0) {
                realDuration = duration + time; // Remove from duration the part before `0`
                time = 0;
            }
            var segment = { id: String(segmentTime),
                time: time / timescale,
                end: (time + realDuration) / timescale,
                duration: realDuration / timescale,
                isInit: false, range: range, timescale: 1,
                mediaURLs: detokenizedURLs,
                number: segmentNumber,
                timestampOffset: -(index.indexTimeOffset / timescale), complete: complete, privateInfos: { isEMSGWhitelisted: isEMSGWhitelisted } };
            segments.push(segment);
            // update segment number and segment time for the next segment
            segmentNumberInCurrentRange++;
            segmentTime = start + segmentNumberInCurrentRange * duration;
        }
        if (segmentTime >= scaledTo) {
            // we reached ``scaledTo``, we're done
            return segments;
        }
        currentNumber += repeat + 1;
    }
    return segments;
}
