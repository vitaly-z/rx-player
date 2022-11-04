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
import { map, mergeMap, } from "rxjs";
import nextTickObs from "../../utils/rx-next-tick";
import EVENTS from "./events_generators";
/**
 * Regularly ask to reload the MediaSource on each playback observation
 * performed by the playback observer.
 *
 * If and only if the Period currently played corresponds to `Period`, applies
 * an offset to the reloaded position corresponding to `deltaPos`.
 * This can be useful for example when switching the audio/video track, where
 * you might want to give back some context if that was the currently played
 * track.
 *
 * @param {Object} period - The Period linked to the Adaptation or
 * Representation that you want to switch to.
 * @param {Observable} playbackObserver - emit playback conditions.
 * Has to emit last playback conditions immediately on subscribe.
 * @param {number} deltaPos - If the concerned Period is playing at the time
 * this function is called, we will add this value, in seconds, to the current
 * position to indicate the position we should reload at.
 * This value allows to give back context (by replaying some media data) after
 * a switch.
 * @returns {Observable}
 */
export default function reloadAfterSwitch(period, bufferType, playbackObserver, deltaPos) {
    // We begin by scheduling a micro-task to reduce the possibility of race
    // conditions where `reloadAfterSwitch` would be called synchronously before
    // the next observation (which may reflect very different playback conditions)
    // is actually received.
    // It can happen when `reloadAfterSwitch` is called as a side-effect of the
    // same event that triggers the playback observation to be emitted.
    return nextTickObs().pipe(mergeMap(function () { return playbackObserver.getReference().asObservable(); }), map(function (observation) {
        var _a, _b;
        var currentTime = playbackObserver.getCurrentTime();
        var pos = currentTime + deltaPos;
        // Bind to Period start and end
        var reloadAt = Math.min(Math.max(period.start, pos), (_a = period.end) !== null && _a !== void 0 ? _a : Infinity);
        var autoPlay = !((_b = observation.paused.pending) !== null && _b !== void 0 ? _b : playbackObserver.getIsPaused());
        return EVENTS.waitingMediaSourceReload(bufferType, period, reloadAt, autoPlay);
    }));
}
