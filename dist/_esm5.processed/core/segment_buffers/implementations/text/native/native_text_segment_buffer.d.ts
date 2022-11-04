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
import { IEndOfSegmentInfos, IPushChunkInfos, SegmentBuffer } from "../../types";
import ManualTimeRanges from "../../utils/manual_time_ranges";
/**
 * Implementation of an SegmentBuffer for "native" text tracks.
 * "Native" text tracks rely on a `<track>` HTMLElement and its associated
 * expected behavior to display subtitles synchronized to the video.
 * @class NativeTextSegmentBuffer
 */
export default class NativeTextSegmentBuffer extends SegmentBuffer {
    readonly bufferType: "text";
    private readonly _videoElement;
    private readonly _track;
    private readonly _trackElement;
    private _buffered;
    /**
     * @param {HTMLMediaElement} videoElement
     * @param {Boolean} hideNativeSubtitle
     */
    constructor(videoElement: HTMLMediaElement, hideNativeSubtitle: boolean);
    /**
     * @param {Object} infos
     * @returns {Promise}
     */
    pushChunk(infos: IPushChunkInfos<unknown>): Promise<void>;
    /**
     * Remove buffered data.
     * @param {number} start - start position, in seconds
     * @param {number} end - end position, in seconds
     * @returns {Promise}
     */
    removeBuffer(start: number, end: number): Promise<void>;
    /**
     * @param {Object} infos
     * @returns {Promise}
     */
    endOfSegment(_infos: IEndOfSegmentInfos): Promise<void>;
    /**
     * Returns the currently buffered data, in a TimeRanges object.
     * @returns {TimeRanges}
     */
    getBufferedRanges(): ManualTimeRanges;
    dispose(): void;
    private _removeData;
}
/** Data of chunks that should be pushed to the NativeTextSegmentBuffer. */
export interface INativeTextTracksBufferSegmentData {
    /** The text track data, in the format indicated in `type`. */
    data: string;
    /** The format of `data` (examples: "ttml", "srt" or "vtt") */
    type: string;
    /**
     * Language in which the text track is, as a language code.
     * This is mostly needed for "sami" subtitles, to know which cues can / should
     * be parsed.
     */
    language?: string | undefined;
    /** start time from which the segment apply, in seconds. */
    start?: number | undefined;
    /** end time until which the segment apply, in seconds. */
    end?: number | undefined;
}
