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
import { IReadOnlySharedReference } from "../../../utils/reference";
import WeakMapMemory from "../../../utils/weak_map_memory";
import ABRManager from "../../abr";
import { IReadOnlyPlaybackObserver } from "../../api";
import { SegmentFetcherCreator } from "../../fetchers";
import SegmentBuffersStore, { IBufferType, ITextTrackSegmentBufferOptions, SegmentBuffer } from "../../segment_buffers";
import { IAdaptationStreamOptions } from "../adaptation";
import { IPeriodStreamEvent } from "../types";
import { IAudioTrackSwitchingMode } from "./get_adaptation_switch_strategy";
/** Playback observation required by the `PeriodStream`. */
export interface IPeriodStreamPlaybackObservation {
    /** The position we are in the video in seconds at the time of the observation. */
    position: number;
    /** `duration` property of the HTMLMediaElement. */
    duration: number;
    /** If `true`, the player is currently paused. */
    isPaused: boolean;
    /** `readyState` property of the HTMLMediaElement. */
    readyState: number;
    /** Target playback rate at which we want to play the content. */
    speed: number;
    /**
     * Offset, in seconds to add to `position` to obtain the starting position at
     * which we actually want to download segments for.
     */
    wantedTimeOffset: number;
    /**
     * Only set for live contents.
     * Difference between the live edge and the current position, in seconds.
     */
    liveGap: number | undefined;
}
/** Arguments required by the `PeriodStream`. */
export interface IPeriodStreamArguments {
    abrManager: ABRManager;
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
export default function PeriodStream({ abrManager, bufferType, content, garbageCollectors, playbackObserver, segmentFetcherCreator, segmentBuffersStore, options, wantedBufferAhead, maxVideoBufferSize, }: IPeriodStreamArguments): Observable<IPeriodStreamEvent>;
