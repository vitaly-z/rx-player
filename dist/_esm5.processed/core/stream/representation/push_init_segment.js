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
import { defer as observableDefer, EMPTY, map, } from "rxjs";
import EVENTS from "../events_generators";
import appendSegmentToBuffer from "./append_segment_to_buffer";
/**
 * Push the initialization segment to the SegmentBuffer.
 * The Observable returned:
 *   - emit an event once the segment has been pushed.
 *   - throws on Error.
 * @param {Object} args
 * @returns {Observable}
 */
export default function pushInitSegment(_a) {
    var playbackObserver = _a.playbackObserver, content = _a.content, segment = _a.segment, segmentData = _a.segmentData, segmentBuffer = _a.segmentBuffer;
    return observableDefer(function () {
        if (segmentData === null) {
            return EMPTY;
        }
        var codec = content.representation.getMimeTypeString();
        var data = { initSegment: segmentData,
            chunk: null,
            timestampOffset: 0,
            appendWindow: [undefined, undefined], codec: codec };
        var inventoryInfos = Object.assign({ segment: segment, start: 0,
            end: 0 }, content);
        return appendSegmentToBuffer(playbackObserver, segmentBuffer, { data: data, inventoryInfos: inventoryInfos }).pipe(map(function () {
            var buffered = segmentBuffer.getBufferedRanges();
            return EVENTS.addedSegment(content, segment, buffered, segmentData);
        }));
    });
}
