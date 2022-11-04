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
import Manifest, { Period } from "../../../manifest";
import { IAudioTrackSwitchingMode } from "../../../public_types";
import { IReadOnlySharedReference } from "../../../utils/reference";
import WeakMapMemory from "../../../utils/weak_map_memory";
import { IRepresentationEstimator } from "../../adaptive";
import { IReadOnlyPlaybackObserver } from "../../api";
import { SegmentFetcherCreator } from "../../fetchers";
import SegmentBuffersStore, { IBufferType, ITextTrackSegmentBufferOptions, SegmentBuffer } from "../../segment_buffers";
import { IAdaptationStreamOptions, IPausedPlaybackObservation } from "../adaptation";
import { IPositionPlaybackObservation } from "../representation";
import { IPeriodStreamEvent } from "../types";
/** Playback observation required by the `PeriodStream`. */
export interface IPeriodStreamPlaybackObservation {
    /**
     * Information on whether the media element was paused at the time of the
     * Observation.
     */
    paused: IPausedPlaybackObservation;
    /**
     * Information on the current media position in seconds at the time of the
     * Observation.
     */
    position: IPositionPlaybackObservation;
    /** `duration` property of the HTMLMediaElement. */
    duration: number;
    /** `readyState` property of the HTMLMediaElement. */
    readyState: number;
    /** Target playback rate at which we want to play the content. */
    speed: number;
    /** Theoretical maximum position on the content that can currently be played. */
    maximumPosition: number;
}
/** Arguments required by the `PeriodStream`. */
export interface IPeriodStreamArguments {
    bufferType: IBufferType;
    content: {
        manifest: Manifest;
        period: Period;
    };
    garbageCollectors: WeakMapMemory<SegmentBuffer, Observable<never>>;
    segmentFetcherCreator: SegmentFetcherCreator;
    segmentBuffersStore: SegmentBuffersStore;
    playbackObserver: IReadOnlyPlaybackObserver<IPeriodStreamPlaybackObservation>;
    options: IPeriodStreamOptions;
    representationEstimator: IRepresentationEstimator;
    wantedBufferAhead: IReadOnlySharedReference<number>;
    maxVideoBufferSize: IReadOnlySharedReference<number>;
}
/** Options tweaking the behavior of the PeriodStream. */
export declare type IPeriodStreamOptions = IAdaptationStreamOptions & {
    /** RxPlayer's behavior when switching the audio track. */
    audioTrackSwitchingMode: IAudioTrackSwitchingMode;
    /** Behavior when a new video and/or audio codec is encountered. */
    onCodecSwitch: "continue" | "reload";
    /** Options specific to the text SegmentBuffer. */
    textTrackOptions?: ITextTrackSegmentBufferOptions;
};
/**
 * Create single PeriodStream Observable:
 *   - Lazily create (or reuse) a SegmentBuffer for the given type.
 *   - Create a Stream linked to an Adaptation each time it changes, to
 *     download and append the corresponding segments to the SegmentBuffer.
 *   - Announce when the Stream is full or is awaiting new Segments through
 *     events
 * @param {Object} args
 * @returns {Observable}
 */
export default function PeriodStream({ bufferType, content, garbageCollectors, playbackObserver, representationEstimator, segmentFetcherCreator, segmentBuffersStore, options, wantedBufferAhead, maxVideoBufferSize, }: IPeriodStreamArguments): Observable<IPeriodStreamEvent>;
