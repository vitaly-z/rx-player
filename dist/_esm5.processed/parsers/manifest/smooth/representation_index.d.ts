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
import { ICustomError } from "../../../errors";
import { IRepresentationIndex, ISegment } from "../../../manifest";
/**
 * Object describing information about one segment or several consecutive
 * segments.
 */
export interface IIndexSegment {
    /** Time (timescaled) at which the segment starts. */
    start: number;
    /** Duration (timescaled) of the segment. */
    duration: number;
    /**
     * Amount of consecutive segments with that duration.
     *
     * For example let's consider the following IIndexSegment:
     * ```
     * { start: 10, duration: 2, repeatCount: 2 }
     * ```
     * Here, because `repeatCount` is set to `2`, this object actually defines 3
     * segments:
     *   1. one starting at `10` and ending at `12` (10 + 2)
     *   2. another one starting at `12` (the previous one's end) and ending at
     *      `14` (12 + 2)
     *   3. another one starting at `14` (the previous one's end) and ending at
     *      `16` (14 +2)
     */
    repeatCount: number;
}
/**
 * Object containing information about the segments available in a
 * `SmoothRepresentationIndex`.
 */
interface ITimelineIndex {
    /**
     * "Timescale" used here allowing to convert the time in this object into
     * seconds (by doing `time / timescale`).
     */
    timescale: number;
    /**
     * Generic tokenized (e.g. with placeholders for time information) URL for
     * every segments anounced here.
     */
    media: string;
    /** Contains information about all segments available here. */
    timeline: IIndexSegment[];
}
/**
 * Supplementary options taken by a SmoothRepresentationIndex bringing the
 * context the segments are in.
 */
export interface ISmoothRepresentationIndexContextInformation {
    /**
     * if `true`, the `SmoothRepresentationIndex` will return segments even if
     * we're not sure they had time to be generated on the server side.
     *
     * TODO(Paul B.) This is a somewhat ugly option, only here for very specific
     * Canal+ use-cases for now (most of all for Peer-to-Peer efficiency),
     * scheduled to be removed in a next major version.
     */
    aggressiveMode: boolean;
    /**
     * If `true` the corresponding Smooth Manifest was announced as a live
     * content.
     * `false` otherwise.
     */
    isLive: boolean;
    /** Value of `performance.now()` when the Manifest request was finished. */
    manifestReceivedTime: number | undefined;
    /**
     * Contains information allowing to generate the corresponding initialization
     * segment.
     */
    segmentPrivateInfos: ISmoothInitSegmentPrivateInfos;
    /** Depth of the DVR window, in seconds. */
    timeShiftBufferDepth: number | undefined;
}
/** Information allowing to generate a Smooth initialization segment. */
interface ISmoothInitSegmentPrivateInfos {
    bitsPerSample?: number;
    channels?: number;
    codecPrivateData?: string;
    packetSize?: number;
    samplingRate?: number;
    protection?: {
        keyId: Uint8Array;
    };
}
/**
 * RepresentationIndex implementation for Smooth Manifests.
 *
 * Allows to interact with the index to create new Segments.
 *
 * @class SmoothRepresentationIndex
 */
export default class SmoothRepresentationIndex implements IRepresentationIndex {
    /**
     * The maximum duration in seconds any known segment linked to this
     * RepresentationIndex has.
     * `undefined` if no segment is available.
     */
    /**
     * Information needed to generate an initialization segment.
     * Taken from the Manifest.
     */
    private _initSegmentInfos;
    /**
     * if `true`, this class will return segments even if we're not sure they had
     * time to be generated on the server side.
     *
     * This is a somewhat ugly option, only here for very specific Canal+
     * use-cases for now (most of all for Peer-to-Peer efficiency), scheduled to
     * be removed in a next major version.
     */
    private _isAggressiveMode;
    /**
     * Value only calculated for live contents.
     *
     * Calculates the difference, in timescale, between the current time (as
     * calculated via performance.now()) and the time of the last segment known
     * to have been generated on the server-side.
     * Useful to know if a segment present in the timeline has actually been
     * generated on the server-side
     */
    private _scaledLiveGap?;
    /**
     * Defines the end of the latest available segment when this index was known to
     * be valid, in the index's timescale.
     */
    private _initialScaledLastPosition?;
    /**
     * Defines the earliest time when this index was known to be valid (that is, when
     * all segments declared in it are available). This means either:
     *   - the manifest downloading time, if known
     *   - else, the time of creation of this RepresentationIndex, as the best guess
     */
    private _indexValidityTime;
    /**
     * If `true` the corresponding Smooth Manifest was announced as a live
     * content.
     * `false` otherwise.
     */
    private _isLive;
    /**
     * Contains information on the list of segments available in this
     * SmoothRepresentationIndex.
     */
    private _index;
    /** Depth of the DVR window anounced in the Manifest, in seconds. */
    private _timeShiftBufferDepth;
    /**
     * Creates a new `SmoothRepresentationIndex`.
     * @param {Object} index
     * @param {Object} options
     */
    constructor(index: ITimelineIndex, options: ISmoothRepresentationIndexContextInformation);
    /**
     * Construct init Segment compatible with a Smooth Manifest.
     * @returns {Object}
     */
    getInitSegment(): ISegment;
    /**
     * Generate a list of Segments for a particular period of time.
     *
     * @param {Number} from
     * @param {Number} duration
     * @returns {Array.<Object>}
     */
    getSegments(from: number, dur: number): ISegment[];
    /**
     * Returns true if, based on the arguments, the index should be refreshed.
     * (If we should re-fetch the manifest)
     * @param {Number} up
     * @param {Number} to
     * @returns {Boolean}
     */
    shouldRefresh(up: number, to: number): boolean;
    /**
     * Returns first position available in the index.
     *
     * @param {Object} index
     * @returns {Number|null}
     */
    getFirstPosition(): number | null;
    /**
     * Returns last position available in the index.
     * @param {Object} index
     * @returns {Number}
     */
    getLastPosition(): number | undefined;
    /**
     * Checks if `timeSec` is in a discontinuity.
     * That is, if there's no segment available for the `timeSec` position.
     * @param {number} timeSec - The time to check if it's in a discontinuity, in
     * seconds.
     * @returns {number | null} - If `null`, no discontinuity is encountered at
     * `time`. If this is a number instead, there is one and that number is the
     * position for which a segment is available in seconds.
     */
    checkDiscontinuity(timeSec: number): number | null;
    /**
     * Returns `true` as Smooth segments should always be generated in
     * chronological order.
     * @returns {boolean}
     */
    areSegmentsChronologicallyGenerated(): true;
    /**
     * Returns `true` if a Segment returned by this index is still considered
     * available.
     * Returns `false` if it is not available anymore.
     * Returns `undefined` if we cannot know whether it is still available or not.
     * @param {Object} segment
     * @returns {Boolean|undefined}
     */
    isSegmentStillAvailable(segment: ISegment): boolean | undefined;
    /**
     * @param {Error} error
     * @returns {Boolean}
     */
    canBeOutOfSyncError(error: ICustomError): boolean;
    /**
     * Replace this RepresentationIndex by a newly downloaded one.
     * Check if the old index had more information about new segments and re-add
     * them if that's the case.
     * @param {Object} newIndex
     */
    _replace(newIndex: SmoothRepresentationIndex): void;
    /**
     * Update the current index with a new, partial, version.
     * This method might be use to only add information about new segments.
     * @param {Object} newIndex
     */
    _update(newIndex: SmoothRepresentationIndex): void;
    /**
     * Returns `true` if the last segments in this index have already been
     * generated.
     * Returns `false` if the index is still waiting on future segments to be
     * generated.
     *
     * For Smooth, it should only depend on whether the content is a live content
     * or not.
     * TODO What about Smooth live content that finishes at some point?
     * @returns {boolean}
     */
    isFinished(): boolean;
    /**
     * @returns {Boolean}
     */
    isInitialized(): true;
    /**
     * Add new segments to a `SmoothRepresentationIndex`.
     * @param {Array.<Object>} nextSegments - The segment information parsed.
     * @param {Object} segment - Information on the segment which contained that
     * new segment information.
     */
    addNewSegments(nextSegments: Array<{
        duration: number;
        time: number;
        timescale: number;
    }>, currentSegment: {
        duration: number;
        time: number;
    }): void;
    /**
     * Clean-up timeline to remove segment information which should not be
     * available due to the timeshift window
     */
    private _refreshTimeline;
}
export {};
