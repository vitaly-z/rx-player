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
/**
 * Describes when the player is "rebuffering" and what event started that
 * status.
 * "Rebuffering" is a status where the player has not enough buffer ahead to
 * play reliably.
 * The RxPlayer should pause playback when the clock indicates the rebuffering
 * status.
 */
export interface IRebufferingStatus {
    /** What started the player to rebuffer. */
    reason: "seeking" | // Building buffer after seeking
    "not-ready" | // Building buffer after low readyState
    "buffering";
    /** `performance.now` at the time the rebuffering happened. */
    timestamp: number;
    /**
     * Position, in seconds, at which data is awaited.
     * If `null` the player is rebuffering but not because it is awaiting future data.
     */
    position: number | null;
}
/**
 * Describes when the player is "frozen".
 * This status is reserved for when the player is stuck at the same position for
 * an unknown reason.
 */
export interface IFreezingStatus {
    /** `performance.now` at the time the freezing started to be detected. */
    timestamp: number;
}
/** Information emitted on each clock tick. */
export interface IClockTick extends IMediaInfos {
    /**
     * Set if the player is short on audio and/or video media data and is a such,
     * rebuffering.
     * `null` if not.
     */
    rebuffering: IRebufferingStatus | null;
    /**
     * Set if the player is frozen, that is, stuck in place for unknown reason.
     * Note that this reason can be a valid one, such as a necessary license not
     * being obtained yet.
     *
     * `null` if the player is not frozen.
     */
    freezing: IFreezingStatus | null;
    /**
     * If `true`, an "internal seek" (a seeking operation triggered by the
     * RxPlayer code) is currently pending.
     */
    internalSeeking: boolean;
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
