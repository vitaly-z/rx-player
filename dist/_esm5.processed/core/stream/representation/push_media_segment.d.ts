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
import { Observable } from "rxjs";
import { IAdaptation, IManifest, IPeriod, IRepresentation, ISegment } from "../../../manifest";
import { ISegmentParserParsedMediaChunk } from "../../../transports";
import { IReadOnlyPlaybackObserver } from "../../api";
import { SegmentBuffer } from "../../segment_buffers";
import { IStreamEventAddedSegment } from "../types";
/**
 * Push a given media segment (non-init segment) to a SegmentBuffer.
 * The Observable returned:
 *   - emit an event once the segment has been pushed.
 *   - throws on Error.
 * @param {Object} args
 * @returns {Observable}
 */
export default function pushMediaSegment<T>({ playbackObserver, content, initSegmentData, parsedSegment, segment, segmentBuffer }: {
    playbackObserver: IReadOnlyPlaybackObserver<{
        position: number;
        wantedTimeOffset: number;
    }>;
    content: {
        adaptation: IAdaptation;
        manifest: IManifest;
        period: IPeriod;
        representation: IRepresentation;
    };
    initSegmentData: T | null;
    parsedSegment: ISegmentParserParsedMediaChunk<T>;
    segment: ISegment;
    segmentBuffer: SegmentBuffer;
}): Observable<IStreamEventAddedSegment<T>>;
