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
import Manifest, { Period } from "../../manifest";
import { PlaybackObserver } from "../api";
import { IBufferType } from "../segment_buffers";
import { IStalledEvent, IUnstalledEvent, IWarningEvent } from "./types";
export interface ILockedStreamEvent {
    /** Buffer type for which no segment will currently load. */
    bufferType: IBufferType;
    /** Period for which no segment will currently load. */
    period: Period;
}
/**
 * Event indicating that a discontinuity has been found.
 * Each event for a `bufferType` and `period` combination replaces the previous
 * one.
 */
export interface IDiscontinuityEvent {
    /** Buffer type concerned by the discontinuity. */
    bufferType: IBufferType;
    /** Period concerned by the discontinuity. */
    period: Period;
    /**
     * Close discontinuity time information.
     * `null` if no discontinuity has been detected currently for that buffer
     * type and Period.
     */
    discontinuity: IDiscontinuityTimeInfo | null;
    /**
     * Position at which the discontinuity was found.
     * Can be important for when a current discontinuity's start is unknown.
     */
    position: number;
}
/** Information on a found discontinuity. */
export interface IDiscontinuityTimeInfo {
    /**
     * Start time of the discontinuity.
     * `undefined` for when the start is unknown but the discontinuity was
     * currently encountered at the position we were in when this event was
     * created.
     */
    start: number | undefined;
    /**
     * End time of the discontinuity, in seconds.
     * If `null`, no further segment can be loaded for the corresponding Period.
     */
    end: number | null;
}
/**
 * Monitor situations where playback is stalled and try to get out of those.
 * Emit "stalled" then "unstalled" respectively when an unavoidable stall is
 * encountered and exited.
 * @param {object} playbackObserver - emit the current playback conditions.
 * @param {Object} manifest - The Manifest of the currently-played content.
 * @param {Observable} discontinuityUpdate$ - Observable emitting encountered
 * discontinuities for loaded Period and buffer types.
 * @param {Observable} lockedStream$
 * @param {Observable} discontinuityUpdate$
 * @returns {Observable}
 */
export default function StallAvoider(playbackObserver: PlaybackObserver, manifest: Manifest | null, lockedStream$: Observable<ILockedStreamEvent>, discontinuityUpdate$: Observable<IDiscontinuityEvent>): Observable<IStalledEvent | IUnstalledEvent | IWarningEvent>;
