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
import Manifest, { Adaptation, Period, Representation } from "../../../manifest";
import { IReadOnlyPlaybackObserver } from "../../api";
import { IPrioritizedSegmentFetcher } from "../../fetchers";
import { SegmentBuffer } from "../../segment_buffers";
import { IRepresentationStreamEvent } from "../types";
/**
 * Build up buffer for a single Representation.
 *
 * Download and push segments linked to the given Representation according
 * to what is already in the SegmentBuffer and where the playback currently is.
 *
 * Multiple RepresentationStream observables can run on the same SegmentBuffer.
 * This allows for example smooth transitions between multiple periods.
 *
 * @param {Object} args
 * @returns {Observable}
 */
export default function RepresentationStream<TSegmentDataType>({ content, options, playbackObserver, segmentBuffer, segmentFetcher, terminate$, }: IRepresentationStreamArguments<TSegmentDataType>): Observable<IRepresentationStreamEvent>;
/** Object that should be emitted by the given `IReadOnlyPlaybackObserver`. */
export interface IRepresentationStreamPlaybackObservation {
    /**
     * Information on the current media position in seconds at the time of a
     * Playback Observation.
     */
    position: IPositionPlaybackObservation;
}
/** Position-related information linked to an emitted Playback observation. */
export interface IPositionPlaybackObservation {
    /**
     * Known position at the time the Observation was emitted, in seconds.
     *
     * Note that it might have changed since. If you want truly precize
     * information, you should recuperate it from the HTMLMediaElement directly
     * through another mean.
     */
    last: number;
    /**
     * Actually wanted position in seconds that is not yet reached.
     *
     * This might for example be set to the initial position when the content is
     * loading (and thus potentially at a `0` position) but which will be seeked
     * to a given position once possible.
     */
    pending: number | undefined;
}
/** Item emitted by the `terminate$` Observable given to a RepresentationStream. */
export interface ITerminationOrder {
    urgent: boolean;
}
/** Arguments to give to the RepresentationStream. */
export interface IRepresentationStreamArguments<TSegmentDataType> {
    /** The context of the Representation you want to load. */
    content: {
        adaptation: Adaptation;
        manifest: Manifest;
        period: Period;
        representation: Representation;
    };
    /** The `SegmentBuffer` on which segments will be pushed. */
    segmentBuffer: SegmentBuffer;
    /** Interface used to load new segments. */
    segmentFetcher: IPrioritizedSegmentFetcher<TSegmentDataType>;
    /**
     * Observable emitting when the RepresentationStream should "terminate".
     *
     * When this Observable emits, the RepresentationStream will begin a
     * "termination process": it will, depending on the type of termination
     * wanted, either stop immediately pending segment requests or wait until they
     * are finished before fully terminating (sending the
     * `IStreamTerminatingEvent` and then completing the `RepresentationStream`
     * Observable once the corresponding segments have been pushed).
     */
    terminate$: Observable<ITerminationOrder>;
    /** Periodically emits the current playback conditions. */
    playbackObserver: IReadOnlyPlaybackObserver<IRepresentationStreamPlaybackObservation>;
    /** Supplementary arguments which configure the RepresentationStream's behavior. */
    options: IRepresentationStreamOptions;
}
/**
 * Various specific stream "options" which tweak the behavior of the
 * RepresentationStream.
 */
export interface IRepresentationStreamOptions {
    /**
     * The buffer size we have to reach in seconds (compared to the current
     * position. When that size is reached, no segments will be loaded until it
     * goes below that size again.
     */
    bufferGoal$: Observable<number>;
    /**
     *  The buffer size limit in memory that we can reach.
     *  Once reached, no segments will be loaded until it
     *  goes below that size again
     */
    maxBufferSize$: Observable<number>;
    /**
     * Hex-encoded DRM "system ID" as found in:
     * https://dashif.org/identifiers/content_protection/
     *
     * Allows to identify which DRM system is currently used, to allow potential
     * optimizations.
     *
     * Set to `undefined` in two cases:
     *   - no DRM system is used (e.g. the content is unencrypted).
     *   - We don't know which DRM system is currently used.
     */
    drmSystemId: string | undefined;
    /**
     * Bitrate threshold from which no "fast-switching" should occur on a segment.
     *
     * Fast-switching is an optimization allowing to replace segments from a
     * low-bitrate Representation by segments from a higher-bitrate
     * Representation. This allows the user to see/hear an improvement in quality
     * faster, hence "fast-switching".
     *
     * This Observable allows to limit this behavior to only allow the replacement
     * of segments with a bitrate lower than a specific value - the number emitted
     * by that Observable.
     *
     * If set to `undefined`, no threshold is active and any segment can be
     * replaced by higher quality segment(s).
     *
     * `0` can be emitted to disable any kind of fast-switching.
     */
    fastSwitchThreshold$: Observable<undefined | number>;
}
