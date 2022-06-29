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
/**
 * Choose a bitrate based on the currently available buffer.
 *
 * This algorithm is based on a deviation of the BOLA algorithm.
 * It is a hybrid solution that also relies on a given bitrate's
 * "maintainability".
 * Each time a chunk is downloaded, from the ratio between the chunk duration
 * and chunk's request time, we can assume that the representation is
 * "maintanable" or not.
 * If so, we may switch to a better quality, or conversely to a worse quality.
 *
 * @class BufferBasedChooser
 */
export default class BufferBasedChooser {
    private _levelsMap;
    private _bitrates;
    /**
     * @param {Array.<number>} bitrates
     */
    constructor(bitrates: number[]);
    /**
     * @param {Object} playbackObservation
     * @returns {number|undefined}
     */
    getEstimate(playbackObservation: IBufferBasedChooserPlaybackObservation): number | undefined;
}
/** Playback observation needed by the `BufferBasedChooser`. */
export interface IBufferBasedChooserPlaybackObservation {
    /**
     * Difference in seconds between the current position and the next
     * non-buffered position in the buffer for the currently-considered
     * media type.
     */
    bufferGap: number;
    /** The bitrate of the currently downloaded segments, in bps. */
    currentBitrate?: number | undefined;
    /** The "maintainability score" of the currently downloaded segments. */
    currentScore?: number | undefined;
    /** Playback rate wanted (e.g. `1` is regular playback, `2` is double speed etc.). */
    speed: number;
}
