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
/**
 * Class allowing to "observe" current playback conditions so the RxPlayer is
 * then able to react upon them.
 *
 * This is a central class of the RxPlayer as many modules rely on the
 * `PlaybackObserver` to know the current state of the media being played.
 *
 * You can use the PlaybackObserver to either get the last observation
 * performed, get the current media state or subscribe to an Observable emitting
 * regularly media conditions.
 *
 * @class {PlaybackObserver}
 */
export default class PlaybackObserver {
    /** HTMLMediaElement which we want to observe. */
    private _mediaElement;
    /** If `true`, a `MediaSource` object is linked to `_mediaElement`. */
    private _withMediaSource;
    /**
     * If `true`, we're playing in a low-latency mode, which might have an
     * influence on some chosen interval values here.
     */
    private _lowLatencyMode;
    /**
     * The RxPlayer usually wants to differientate when a seek was sourced from
     * the RxPlayer's internal logic vs when it was sourced from an outside
     * application code.
     *
     * To implement this in the PlaybackObserver, we maintain this counter
     * allowing to know when a "seeking" event received from a `HTMLMediaElement`
     * was due to an "internal seek" or an external seek:
     *   - This counter is incremented each time an "internal seek" (seek from the
     *     inside of the RxPlayer has been performed.
     *   - This counter is decremented each time we received a "seeking" event.
     *
     * This allows us to correctly characterize seeking events: if the counter is
     * superior to `0`, it is probably due to an internal "seek".
     */
    private _internalSeekingEventsIncomingCounter;
    /**
     * Last playback observation made by the `PlaybackObserver`.
     *
     * `null` if no observation has been made yet.
     */
    private _lastObservation;
    /**
     * Lazily-created shared Observable that will emit playback observations.
     * Set to `null` until the first time it is generated.
     */
    private _observation$;
    /**
     * @param {HTMLMediaElement} mediaElement
     * @param {Object} options
     */
    constructor(mediaElement: HTMLMediaElement, options: IPlaybackObserverOptions);
    /**
     * Returns the current position advertised by the `HTMLMediaElement`, in
     * seconds.
     * @returns {number}
     */
    getCurrentTime(): number;
    /**
     * Update the current position (seek) on the `HTMLMediaElement`, by giving a
     * new position in seconds.
     *
     * Note that seeks performed through this method are caracherized as
     * "internal" seeks. They don't result into the exact same playback
     * observation than regular seeks (which most likely comes from the outside,
     * e.g. the user).
     * @param {number}
     */
    setCurrentTime(time: number): void;
    /**
     * Returns the current `readyState` advertised by the `HTMLMediaElement`.
     * @returns {number}
     */
    getReadyState(): number;
    /**
     * Returns an Observable regularly emitting playback observation, optionally
     * starting with the last one.
     *
     * Note that this Observable is shared and unique, so that multiple `observe`
     * call will return the exact same Observable and multiple concurrent
     * `subscribe` will receive the same events at the same time.
     * This was done for performance and simplicity reasons.
     *
     * @param {boolean} includeLastObservation
     * @returns {Observable}
     */
    observe(includeLastObservation: boolean): Observable<IPlaybackObservation>;
    /**
     * Generate a new playback observer which can listen to other
     * properties and which can only be accessed to read observations (e.g.
     * it cannot ask to perform a seek).
     *
     * The object returned will respect the `IReadOnlyPlaybackObserver` interface
     * and will inherit this `PlaybackObserver`'s lifecycle: it will emit when
     * the latter emits.
     *
     * As argument, this method takes a function which will allow to produce
     * the new set of properties to be present on each observation.
     * @param {Function} mapObservable
     * @returns {Object}
     */
    deriveReadOnlyObserver<TDest>(mapObservable: (observation$: Observable<IPlaybackObservation>) => Observable<TDest>): IReadOnlyPlaybackObserver<TDest>;
    /**
     * Creates the observable that will generate playback observations.
     * @returns {Observable}
     */
    private _createInnerObservable;
    private _generateInitialObservation;
}
/** "Event" that triggered the playback observation. */
export declare type IPlaybackObserverEventType = 
/** First playback observation automatically emitted. */
"init" | // set once on first emit
/** Regularly emitted playback observation when no event happened in a long time. */
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
/** Information recuperated on the media element on each playback observation. */
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
    /**
     * `currentTime` (position) set on the media element at the time of the
     * PlaybackObserver's measure.
     */
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
    /** Event that triggered this playback observation. */
    event: IPlaybackObserverEventType;
}
/**
 * Describes when the player is "rebuffering" and what event started that
 * status.
 * "Rebuffering" is a status where the player has not enough buffer ahead to
 * play reliably.
 * The RxPlayer should pause playback when a playback observation indicates the
 * rebuffering status.
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
/** Information emitted on each playback observation. */
export interface IPlaybackObservation extends IMediaInfos {
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
}
/**
 * Interface providing a generic and read-only version of a `PlaybackObserver`.
 *
 * This interface allows to provide regular and specific playback information
 * without allowing any effect on playback like seeking.
 *
 * This can be very useful to give specific playback information to modules you
 * don't want to be able to update playback.
 *
 * Note that a `PlaybackObserver` is compatible and can thus be upcasted to a
 * `IReadOnlyPlaybackObserver` to "remove" its right to update playback.
 */
export interface IReadOnlyPlaybackObserver<TObservationType> {
    /** Get the current playing position, in seconds. */
    getCurrentTime(): number;
    /** Get the HTMLMediaElement's current `readyState`. */
    getReadyState(): number;
    /**
     * Returns an Observable regularly emitting playback observation, optionally
     * starting with the last one.
     *
     * Note that this Observable is shared and unique, so that multiple `observe`
     * call will return the exact same Observable and multiple concurrent
     * `subscribe` will receive the same events at the same time.
     * This was done for performance and simplicity reasons.
     *
     * @param {boolean} includeLastObservation
     * @returns {Observable}
     */
    observe(includeLastObservation: boolean): Observable<TObservationType>;
    /**
     * Generate a new `IReadOnlyPlaybackObserver` from this one.
     *
     * As argument, this method takes a function which will allow to produce
     * the new set of properties to be present on each observation.
     * @param {Function} mapObservable
     * @returns {Object}
     */
    deriveReadOnlyObserver<TDest>(mapObservable: (observation$: Observable<TObservationType>) => Observable<TDest>, mapObservation: (observation: TObservationType) => TDest): IReadOnlyPlaybackObserver<TDest>;
}
export interface IPlaybackObserverOptions {
    withMediaSource: boolean;
    lowLatencyMode: boolean;
}
export {};
