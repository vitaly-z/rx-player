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
import { IReadOnlySharedReference } from "../../utils/reference";
import { IInitClockTick, IWarningEvent } from "./types";
/** Event emitted when trying to perform the initial `play`. */
export declare type IInitialPlayEvent = 
/** Autoplay is not enabled, but all required steps to do so are there. */
{
    type: "skipped";
} | 
/**
 * Tried to play, but autoplay is blocked by the browser.
 * A corresponding warning should have already been sent.
 */
{
    type: "autoplay-blocked";
} | 
/** Autoplay was done with success. */
{
    type: "autoplay";
} | 
/** Warnings preventing the initial play from happening normally. */
IWarningEvent;
/**
 * Emit once as soon as the clock$ announce that the content can begin to be
 * played by calling the `play` method.
 *
 * This depends on browser-defined criteria (e.g. the readyState status) as well
 * as RxPlayer-defined ones (e.g.) not rebuffering.
 *
 * @param {Observable} clock$
 * @returns {Observable.<undefined>}
 */
export declare function waitUntilPlayable(clock$: Observable<IInitClockTick>): Observable<undefined>;
/** Object returned by `initialSeekAndPlay`. */
export interface IInitialSeekAndPlayObject {
    /**
     * Observable which, when subscribed, will try to seek at the initial position
     * then play if needed as soon as the HTMLMediaElement's properties are right.
     *
     * Emits various events relative to the status of this operation.
     */
    seekAndPlay$: Observable<IInitialPlayEvent>;
    /**
     * Shared reference whose value becomes `true` once the initial seek has
     * been considered / has been done by `seekAndPlay$`.
     */
    initialSeekPerformed: IReadOnlySharedReference<boolean>;
    /**
     * Shared reference whose value becomes `true` once the initial play has
     * been considered / has been done by `seekAndPlay$`.
     */
    initialPlayPerformed: IReadOnlySharedReference<boolean>;
}
/**
 * Creates an Observable allowing to seek at the initially wanted position and
 * to play if autoPlay is wanted.
 * @param {Object} args
 * @returns {Object}
 */
export default function initialSeekAndPlay({ clock$, mediaElement, startTime, mustAutoPlay, setCurrentTime }: {
    clock$: Observable<IInitClockTick>;
    isDirectfile: boolean;
    mediaElement: HTMLMediaElement;
    mustAutoPlay: boolean;
    /** Perform an internal seek. */
    setCurrentTime: (nb: number) => void;
    startTime: number | (() => number);
}): IInitialSeekAndPlayObject;
