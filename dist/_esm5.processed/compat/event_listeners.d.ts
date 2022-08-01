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
 * This file provides browser-agnostic event listeners under the form of
 * RxJS Observables
 */
import { Observable } from "rxjs";
import { IEventEmitter } from "../utils/event_emitter";
import { IReadOnlySharedReference } from "../utils/reference";
import { CancellationSignal } from "../utils/task_canceller";
import { ICompatPictureInPictureWindow } from "./browser_compatibility_types";
export interface IEventEmitterLike {
    addEventListener: (eventName: string, handler: () => void) => void;
    removeEventListener: (eventName: string, handler: () => void) => void;
}
export declare type IEventTargetLike = HTMLElement | IEventEmitterLike | IEventEmitter<unknown>;
/**
 * Returns a reference:
 *   - Set to `true` when the current page is considered visible and active.
 *   - Set to `false` otherwise.
 * @param {Object} stopListening - `CancellationSignal` allowing to free the
 * resources allocated to update this value.
 * @returns {Object}
 */
declare function getPageActivityRef(stopListening: CancellationSignal): IReadOnlySharedReference<boolean>;
export interface IPictureInPictureEvent {
    isEnabled: boolean;
    pipWindow: ICompatPictureInPictureWindow | null;
}
/**
 * Emit when video enters and leaves Picture-In-Picture mode.
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
declare function getPictureOnPictureStateRef(elt: HTMLMediaElement, stopListening: CancellationSignal): IReadOnlySharedReference<IPictureInPictureEvent>;
/**
 * Returns a reference:
 *   - Set to `true` when video is considered as visible (the page is visible
 *     and/or the Picture-In-Picture is activated).
 *   - Set to `false` otherwise.
 * @param {Object} pipStatus
 * @param {Object} stopListening - `CancellationSignal` allowing to free the
 * resources reserved to listen to video visibility change.
 * @returns {Observable}
 */
declare function getVideoVisibilityRef(pipStatus: IReadOnlySharedReference<IPictureInPictureEvent>, stopListening: CancellationSignal): IReadOnlySharedReference<boolean>;
/**
 * Get video width from HTML video element, or video estimated dimensions
 * when Picture-in-Picture is activated.
 * @param {HTMLMediaElement} mediaElement
 * @param {Object} pipStatusRef
 * @param {Object} stopListening
 * @returns {Object}
 */
declare function getVideoWidthRef(mediaElement: HTMLMediaElement, pipStatusRef: IReadOnlySharedReference<IPictureInPictureEvent>, stopListening: CancellationSignal): IReadOnlySharedReference<number>;
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
declare const onLoadedMetadata$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
declare const onSeeking$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
declare const onSeeked$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
declare const onEnded$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
declare const onTimeUpdate$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {HTMLElement} element
 * @returns {Observable}
 */
declare const onFullscreenChange$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
declare const onTextTrackChanges$: (textTrackList: TextTrackList) => Observable<TrackEvent>;
/**
 * @param {MediaSource} mediaSource
 * @returns {Observable}
 */
declare const onSourceOpen$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {MediaSource} mediaSource
 * @returns {Observable}
 */
declare const onSourceClose$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {MediaSource} mediaSource
 * @returns {Observable}
 */
declare const onSourceEnded$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {SourceBuffer} sourceBuffer
 * @returns {Observable}
 */
declare const onUpdate$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {MediaSource} mediaSource
 * @returns {Observable}
 */
declare const onRemoveSourceBuffers$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
declare const onEncrypted$: (element: IEventTargetLike) => Observable<MediaEncryptedEvent>;
/**
 * @param {MediaKeySession} mediaKeySession
 * @returns {Observable}
 */
declare const onKeyMessage$: (element: IEventTargetLike) => Observable<MediaKeyMessageEvent>;
/**
 * @param {MediaKeySession} mediaKeySession
 * @returns {Observable}
 */
declare const onKeyAdded$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {MediaKeySession} mediaKeySession
 * @returns {Observable}
 */
declare const onKeyError$: (element: IEventTargetLike) => Observable<Event>;
/**
 * @param {MediaKeySession} mediaKeySession
 * @returns {Observable}
 */
declare const onKeyStatusesChange$: (element: IEventTargetLike) => Observable<Event>;
/**
 * Utilitary function allowing to add an event listener and remove it
 * automatically once the given `CancellationSignal` emits.
 * @param {EventTarget} elt - The element on which should be attached the event
 * listener.
 * @param {string} evt - The event you wish to listen to
 * @param {Function} listener - The listener function
 * @param {Object} stopListening - Removes the event listener once this signal
 * emits
 */
declare function addEventListener(elt: IEventEmitterLike, evt: string, listener: (x?: unknown) => void, stopListening: CancellationSignal): void;
export { addEventListener, getPageActivityRef, getPictureOnPictureStateRef, getVideoVisibilityRef, getVideoWidthRef, onEncrypted$, onEnded$, onFullscreenChange$, onKeyAdded$, onKeyError$, onKeyMessage$, onKeyStatusesChange$, onLoadedMetadata$, onRemoveSourceBuffers$, onSeeked$, onSeeking$, onSourceClose$, onSourceEnded$, onSourceOpen$, onTextTrackChanges$, onTimeUpdate$, onUpdate$, };
