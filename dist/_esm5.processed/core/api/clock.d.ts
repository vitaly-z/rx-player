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
 * This file defines a global clock for the RxPlayer.
 *
 * Each clock tick also pass information about the current state of the
 * media element to sub-parts of the player.
 */
import { Observable } from "rxjs";
/** "Event" that triggered the clock tick. */
export declare type IClockMediaEventType = 
/** First clock tick automatically emitted. */
"init" | // set once on first emit
/** Regularly emitted clock tick when no event happened in a long time. */
"timeupdate" | 
/** On the HTML5 event with the same name */
"canplay" | 
/** On the HTML5 event with the same name */
"canplaythrough" | // HTML5 Event
/** On the HTML5 event with the same name */
"play" | 
/** On the HTML5 event with the same name */
"seeking" | 
/** On the HTML5 event with the same name */
"seeked" | 
/** On the HTML5 event with the same name */
"stalled" | 
/** On the HTML5 event with the same name */
"loadedmetadata" | 
/** On the HTML5 event with the same name */
"ratechange" | 
/** An internal seek happens */
"internal-seeking";
/** Information recuperated on the media element on each clock tick. */
interface IMediaInfos {
    /** Gap between `currentTime` and the next position with un-buffered data. */
    bufferGap: number;
    /** Value of `buffered` (buffered ranges) for the media element. */
    buffered: TimeRanges;
    /** The buffered range we are currently playing. */
    currentRange: {
        start: number;
        end: number;
    } | null;
    /** `currentTime` (position) set on the media element at the time of the tick. */
    position: number;
    /** Current `duration` set on the media element. */
    duration: number;
    /** Current `ended` set on the media element. */
    ended: boolean;
    /** Current `paused` set on the media element. */
    paused: boolean;
    /** Current `playbackRate` set on the media element. */
    playbackRate: number;
    /** Current `readyState` value on the media element. */
    readyState: number;
    /** Current `seeking` value on the mediaElement. */
    seeking: boolean;
    /** Event that triggered this clock tick. */
    event: IClockMediaEventType;
}
/** Describes when the player is "stalled" and what event started that status. */
export interface IStalledStatus {
    /** What started the player to stall. */
    reason: "seeking" | // Building buffer after seeking
    "not-ready" | // Building buffer after low readyState
    "internal-seek" | // Building buffer after a seek happened inside the player
    "buffering";
    /** `performance.now` at the time the stalling happened. */
    timestamp: number;
    /**
     * Position, in seconds, at which data is awaited.
     * If `null` the player is stalled but not because it is awaiting future data.
     */
    position: number | null;
}
/** Information emitted on each clock tick. */
export interface IClockTick extends IMediaInfos {
    /** Set if the player is stalled, `null` if not. */
    stalled: IStalledStatus | null;
    getCurrentTime: () => number;
}
/** Handle time relative information */
export interface IClockHandler {
    clock$: Observable<IClockTick>;
    setCurrentTime: (time: number) => void;
}
export interface IClockOptions {
    withMediaSource: boolean;
    lowLatencyMode: boolean;
}
/**
 * Timings observable.
 *
 * This Observable samples snapshots of player's current state:
 *   * time position
 *   * playback rate
 *   * current buffered range
 *   * gap with current buffered range ending
 *   * media duration
 *
 * In addition to sampling, this Observable also reacts to "seeking" and "play"
 * events.
 *
 * Observable is shared for performance reason: reduces the number of event
 * listeners and intervals/timeouts but also limit access to the media element
 * properties and gap calculations.
 *
 * The sampling is manual instead of based on "timeupdate" to reduce the
 * number of events.
 * @param {HTMLMediaElement} mediaElement
 * @param {Object} options
 * @returns {Observable}
 */
declare function createClock(mediaElement: HTMLMediaElement, options: IClockOptions): IClockHandler;
export default createClock;
