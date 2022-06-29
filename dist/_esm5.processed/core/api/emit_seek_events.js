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
/**
 * Returns Observable which will emit:
 *   - `"seeking"` when we are seeking in the given mediaElement
 *   - `"seeked"` when a seek is considered as finished by the given observation$
 *     Observable.
 * @param {HTMLMediaElement} mediaElement
 * @param {Observable} observation$
 * @returns {Observable}
 */
export default function emitSeekEvents(mediaElement, observation$) {
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
