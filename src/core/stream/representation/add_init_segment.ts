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

import {
  defer as observableDefer,
  EMPTY,
  map,
  Observable,
} from "rxjs";
import Manifest, {
  Adaptation,
  ISegment,
  Period,
  Representation,
} from "../../../manifest";
import fromCancellablePromise from "../../../utils/rx-from_cancellable_promise";
import TaskCanceller from "../../../utils/task_canceller";
import { IReadOnlyPlaybackObserver } from "../../api";
import { SegmentBuffer } from "../../segment_buffers";
import EVENTS from "../events_generators";
import { IStreamEventAddedSegment } from "../types";
import { appendInitSegmentToBuffer } from "./append_segment_to_buffer";
import { IRepresentationStreamPlaybackObservation } from "./representation_stream";

/**
 * Declare and push a new initialization segment to the SegmentBuffer.
 * The Observable returned:
 *   - emit an event once the segment has been pushed.
 *   - throws on Error.
 *
 * Note that this reserves resources to store the corresponding initialization
 * segment on the SegmentBuffer.
 * You should free that segment through the SegmentBuffer's methods once this is
 * not needed anymore.
 * @param {Object} args
 * @returns {Observable}
 */
export default function add_init_segment<T>(
  { playbackObserver,
    content,
    segment,
    segmentData,
    segmentBuffer } :
  { playbackObserver : IReadOnlyPlaybackObserver<
      IRepresentationStreamPlaybackObservation
    >;
    content: { adaptation : Adaptation;
               manifest : Manifest;
               period : Period;
               representation : Representation; };
    segmentData : T | null;
    segment : ISegment;
    segmentBuffer : SegmentBuffer; }
) : Observable< IStreamEventAddedSegment<T> > {
  return observableDefer(() => {
    if (segmentData === null) {
      return EMPTY;
    }
    const codec = content.representation.getMimeTypeString();
    const canceller = new TaskCanceller();
    return fromCancellablePromise(canceller, () =>
      appendInitSegmentToBuffer(playbackObserver,
                                segmentBuffer,
                                { data: segmentData,
                                  codec,
                                  uniqueId: content.representation.id },
                                canceller.signal))
      .pipe(map(() => {
        const buffered = segmentBuffer.getBufferedRanges();
        return EVENTS.addedSegment(content, segment, buffered, segmentData);
      }));
  });
}
