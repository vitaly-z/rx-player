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
import noop from "../../utils/noop";
import { IReadOnlySharedReference } from "../../utils/reference";
import { CancellationSignal } from "../../utils/task_canceller";
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
    private _internalSeeksIncoming;
    /**
     * Stores the last playback observation produced by the `PlaybackObserver`.:
     */
    private _observationRef;
    /**
     * `TaskCanceller` allowing to free all resources and stop producing playback
     * observations.
     */
    private _canceller;
    /**
     * Create a new `PlaybackObserver`, which allows to produce new "playback
     * observations" on various media events and intervals.
     *
     * Note that creating a `PlaybackObserver` lead to the usage of resources,
     * such as event listeners which will only be freed once the `stop` method is
     * called.
     * @param {HTMLMediaElement} mediaElement
     * @param {Object} options
     */
    constructor(mediaElement: HTMLMediaElement, options: IPlaybackObserverOptions);
    /**
     * Stop the `PlaybackObserver` from emitting playback observations and free all
     * resources reserved to emitting them such as event listeners, intervals and
     * subscribing callbacks.
     *
     * Once `stop` is called, no new playback observation will ever be emitted.
     *
     * Note that it is important to call stop once the `PlaybackObserver` is no
     * more needed to avoid unnecessarily leaking resources.
     */
    stop(): void;
    /**
     * Returns the current position advertised by the `HTMLMediaElement`, in
     * seconds.
     * @returns {number}
     */
    getCurrentTime(): number;
    /**
     * Returns the current `paused` status advertised by the `HTMLMediaElement`.
     *
     * Use this instead of the same status emitted on an observation when you want
     * to be sure you're using the current value.
     * @returns {boolean}
     */
    getIsPaused(): boolean;
    /**
     * Update the current position (seek) on the `HTMLMediaElement`, by giving a
     * new position in seconds.
     *
     * Note that seeks performed through this method are caracherized as
     * "internal" seeks. They don't result into the exact same playback
     * observation than regular seeks (which most likely comes from the outside,
     * e.g. the user).
     * @param {number} time
     */
    setCurrentTime(time: number): void;
    /**
     * Returns the current `readyState` advertised by the `HTMLMediaElement`.
     * @returns {number}
     */
    getReadyState(): number;
    /**
     * Returns an `IReadOnlySharedReference` storing the last playback observation
     * produced by the `PlaybackObserver` and updated each time a new one is
     * produced.
     *
     * This value can then be for example subscribed to to be notified of future
     * playback observations.
     *
     * @returns {Object}
     */
    getReference(): IReadOnlySharedReference<IPlaybackObservation>;
    /**
     * Register a callback so it regularly receives playback observations.
     * @param {Function} cb
     * @param {Object} options - Configuration options:
     *   - `includeLastObservation`: If set to `true` the last observation will
     *     be first emitted synchronously.
     *   - `clearSignal`: If set, the callback will be unregistered when this
     *     CancellationSignal emits.
     */
    listen(cb: (observation: IPlaybackObservation) => void, options?: {
        includeLastObservation?: boolean | undefined;
        clearSignal?: CancellationSignal | undefined;
    }): typeof noop | undefined;
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
     * @param {Function} transform
     * @returns {Object}
     */
    deriveReadOnlyObserver<TDest>(transform: (observationRef: IReadOnlySharedReference<IPlaybackObservation>, cancellationSignal: CancellationSignal) => IReadOnlySharedReference<TDest>): IReadOnlyPlaybackObserver<TDest>;
    /**
     * Creates the `IReadOnlySharedReference` that will generate playback
     * observations.
     * @returns {Observable}
     */
    private _createSharedReference;
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
"ended" | 
/** On the HTML5 event with the same name */
"canplaythrough" | // HTML5 Event
/** On the HTML5 event with the same name */
"play" | 
/** On the HTML5 event with the same name */
"pause" | 
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
    pendingInternalSeek: number | null;
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
     * Returns the current `paused` status advertised by the `HTMLMediaElement`.
     *
     * Use this instead of the same status emitted on an observation when you want
     * to be sure you're using the current value.
     * @returns {boolean}
     */
    getIsPaused(): boolean;
    /**
     * Returns an `IReadOnlySharedReference` storing the last playback observation
     * produced by the `IReadOnlyPlaybackObserver` and updated each time a new one
     * is produced.
     *
     * This value can then be for example subscribed to to be notified of future
     * playback observations.
     *
     * @returns {Object}
     */
    getReference(): IReadOnlySharedReference<TObservationType>;
    /**
     * Register a callback so it regularly receives playback observations.
     * @param {Function} cb
     * @param {Object} options - Configuration options:
     *   - `includeLastObservation`: If set to `true` the last observation will
     *     be first emitted synchronously.
     *   - `clearSignal`: If set, the callback will be unregistered when this
     *     CancellationSignal emits.
     * @returns {Function} - Allows to easily unregister the callback
     */
    listen(cb: (observation: TObservationType) => void, options?: {
        includeLastObservation?: boolean | undefined;
        clearSignal?: CancellationSignal | undefined;
    }): void;
    /**
     * Generate a new `IReadOnlyPlaybackObserver` from this one.
     *
     * As argument, this method takes a function which will allow to produce
     * the new set of properties to be present on each observation.
     * @param {Function} transform
     * @returns {Object}
     */
    deriveReadOnlyObserver<TDest>(transform: (observationRef: IReadOnlySharedReference<TObservationType>, cancellationSignal: CancellationSignal) => IReadOnlySharedReference<TDest>): IReadOnlyPlaybackObserver<TDest>;
}
export interface IPlaybackObserverOptions {
    withMediaSource: boolean;
    lowLatencyMode: boolean;
}
export {};
