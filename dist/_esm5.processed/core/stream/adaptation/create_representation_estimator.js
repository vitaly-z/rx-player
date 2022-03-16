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
import { merge as observableMerge, of as observableOf, Subject, } from "rxjs";
import { distinctUntilChanged, map, switchMap, } from "rxjs/operators";
import { MediaError } from "../../../errors";
import { fromEvent } from "../../../utils/event_emitter";
/**
 * Create an "estimator$" Observable which will emit which Representation (from
 * the given `Adaptation`) is the best fit (see `IABREstimate` type definition)
 * corresponding to the current network and playback conditions.
 *
 * This function also returns two subjects that should be used to add feedback
 * helping the estimator to make its choices:
 *
 *   - `requestFeedback$`: Subject through which information about new requests
 *     and network metrics should be emitted.
 *
 *   - `streamFeedback$`: Subject through which stream-related events should be
 *      emitted.
 *
 * You can look at the types defined for both of those Subjects to have more
 * information on what data is expected. The idea is to provide as much data as
 * possible so the estimation is as adapted as possible.
 *
 * @param {Object} content
 * @param {Object} abrManager
 * @param {Observable} clock$
 * @returns {Object}
 */
export default function createRepresentationEstimator(_a, abrManager, clock$) {
    var manifest = _a.manifest, adaptation = _a.adaptation;
    var streamFeedback$ = new Subject();
    var requestFeedback$ = new Subject();
    var abrEvents$ = observableMerge(streamFeedback$, requestFeedback$);
    var estimator$ = observableMerge(
    // subscribe "first" (hack as it is a merge here) to event
    fromEvent(manifest, "decipherabilityUpdate"), 
    // Emit directly a first time on subscription (after subscribing to event)
    observableOf(null)).pipe(map(function () {
        /** Representations for which a `RepresentationStream` can be created. */
        var playableRepresentations = adaptation.getPlayableRepresentations();
        if (playableRepresentations.length <= 0) {
            var noRepErr = new MediaError("NO_PLAYABLE_REPRESENTATION", "No Representation in the chosen " +
                adaptation.type + " Adaptation can be played");
            throw noRepErr;
        }
        return playableRepresentations;
    }), distinctUntilChanged(function (prevRepr, newRepr) {
        if (prevRepr.length !== newRepr.length) {
            return false;
        }
        for (var i = 0; i < newRepr.length; i++) {
            if (prevRepr[i].id !== newRepr[i].id) {
                return false;
            }
        }
        return true;
    }), switchMap(function (playableRepresentations) {
        return abrManager.get$(adaptation.type, playableRepresentations, clock$, abrEvents$);
    }));
    return { estimator$: estimator$,
        streamFeedback$: streamFeedback$,
        requestFeedback$: requestFeedback$ };
}
