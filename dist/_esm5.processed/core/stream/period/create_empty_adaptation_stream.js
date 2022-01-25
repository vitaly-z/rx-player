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
import { combineLatest as observableCombineLatest, mergeMap, of as observableOf, } from "rxjs";
import log from "../../../log";
/**
 * Create empty AdaptationStream Observable, linked to a Period.
 *
 * This observable will never download any segment and just emit a "full"
 * event when reaching the end.
 * @param {Observable} playbackObserver
 * @param {Object} wantedBufferAhead
 * @param {string} bufferType
 * @param {Object} content
 * @returns {Observable}
 */
export default function createEmptyAdaptationStream(playbackObserver, wantedBufferAhead, bufferType, content) {
    var period = content.period;
    var hasFinishedLoading = false;
    var wantedBufferAhead$ = wantedBufferAhead.asObservable();
    var observation$ = playbackObserver.observe(true);
    return observableCombineLatest([observation$, wantedBufferAhead$]).pipe(mergeMap(function (_a) {
        var observation = _a[0], wba = _a[1];
        var position = observation.position;
        if (period.end !== undefined && position + wba >= period.end) {
            log.debug("Stream: full \"empty\" AdaptationStream", bufferType);
            hasFinishedLoading = true;
        }
        return observableOf({ type: "stream-status",
            value: { period: period, bufferType: bufferType, position: observation.position,
                imminentDiscontinuity: null, hasFinishedLoading: hasFinishedLoading, neededSegments: [],
                shouldRefreshManifest: false } });
    }));
}
