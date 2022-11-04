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
import { defer as observableDefer, EMPTY, filter, map, merge as observableMerge, startWith, switchMap, take, } from "rxjs";
import config from "../../config";
/**
 * Returns Observable which will emit:
 *   - `"seeking"` when we are seeking in the given mediaElement
 *   - `"seeked"` when a seek is considered as finished by the given observation$
 *     Observable.
 * @param {HTMLMediaElement} mediaElement
 * @param {Observable} observation$
 * @returns {Observable}
 */
export function emitSeekEvents(mediaElement, observation$) {
    return observableDefer(function () {
        if (mediaElement === null) {
            return EMPTY;
        }
        var isSeeking$ = observation$.pipe(filter(function (observation) { return observation.event === "seeking"; }), map(function () { return "seeking"; }));
        if (mediaElement.seeking) {
            isSeeking$ = isSeeking$.pipe(startWith("seeking"));
        }
        var hasSeeked$ = isSeeking$.pipe(switchMap(function () {
            return observation$.pipe(filter(function (observation) { return observation.event === "seeked"; }), map(function () { return "seeked"; }), take(1));
        }));
        return observableMerge(isSeeking$, hasSeeked$);
    });
}
/**
 * Get state string for a _loaded_ content.
 * @param {HTMLMediaElement} mediaElement
 * @param {Object} stalledStatus - Current stalled state:
 *   - null when not stalled
 *   - a description of the situation if stalled.
 * @returns {string}
 */
export function getLoadedContentState(mediaElement, stalledStatus) {
    var FORCED_ENDED_THRESHOLD = config.getCurrent().FORCED_ENDED_THRESHOLD;
    if (mediaElement.ended) {
        return "ENDED" /* PLAYER_STATES.ENDED */;
    }
    if (stalledStatus !== null) {
        // On some old browsers (e.g. Chrome 54), the browser does not
        // emit an 'ended' event in some conditions. Detect if we
        // reached the end by comparing the current position and the
        // duration instead.
        var gapBetweenDurationAndCurrentTime = Math.abs(mediaElement.duration -
            mediaElement.currentTime);
        if (FORCED_ENDED_THRESHOLD != null &&
            gapBetweenDurationAndCurrentTime < FORCED_ENDED_THRESHOLD) {
            return "ENDED" /* PLAYER_STATES.ENDED */;
        }
        return stalledStatus === "seeking" ? "SEEKING" /* PLAYER_STATES.SEEKING */ :
            "BUFFERING" /* PLAYER_STATES.BUFFERING */;
    }
    return mediaElement.paused ? "PAUSED" /* PLAYER_STATES.PAUSED */ :
        "PLAYING" /* PLAYER_STATES.PLAYING */;
}
