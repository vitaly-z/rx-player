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
import { distinctUntilChanged, ignoreElements, map, merge as observableMerge, skipWhile, startWith, tap, } from "rxjs";
import { MediaError } from "../../errors";
import { fromEvent } from "../../utils/event_emitter";
import filterMap from "../../utils/filter_map";
import createSharedReference from "../../utils/reference";
import EVENTS from "./events_generators";
// NOTE As of now (RxJS 7.4.0), RxJS defines `ignoreElements` default
// first type parameter as `any` instead of the perfectly fine `unknown`,
// leading to linter issues, as it forbids the usage of `any`.
// This is why we're disabling the eslint rule.
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Observes the position and Adaptations being played and deduce various events
 * related to the available time boundaries:
 *  - Emit when the theoretical duration of the content becomes known or when it
 *    changes.
 *  - Emit warnings when the duration goes out of what is currently
 *    theoretically playable.
 *
 * @param {Object} manifest
 * @param {Observable} streams
 * @param {Object} playbackObserver
 * @returns {Observable}
 */
export default function ContentTimeBoundariesObserver(manifest, streams, playbackObserver) {
    /**
     * Allows to calculate the minimum and maximum playable position on the
     * whole content.
     */
    var maximumPositionCalculator = new MaximumPositionCalculator(manifest);
    // trigger warnings when the wanted time is before or after the manifest's
    // segments
    var outOfManifest$ = playbackObserver.getReference().asObservable().pipe(filterMap(function (_a) {
        var _b;
        var position = _a.position;
        var wantedPosition = (_b = position.pending) !== null && _b !== void 0 ? _b : position.last;
        if (wantedPosition < manifest.getMinimumSafePosition()) {
            var warning = new MediaError("MEDIA_TIME_BEFORE_MANIFEST", "The current position is behind the " +
                "earliest time announced in the Manifest.");
            return EVENTS.warning(warning);
        }
        else if (wantedPosition > maximumPositionCalculator.getCurrentMaximumPosition()) {
            var warning = new MediaError("MEDIA_TIME_AFTER_MANIFEST", "The current position is after the latest " +
                "time announced in the Manifest.");
            return EVENTS.warning(warning);
        }
        return null;
    }, null));
    /**
     * Contains the content duration according to the last audio and video
     * Adaptation chosen for the last Period.
     * `undefined` if unknown yet.
     */
    var contentDuration = createSharedReference(undefined);
    var updateDurationOnManifestUpdate$ = fromEvent(manifest, "manifestUpdate").pipe(startWith(null), tap(function () {
        if (!manifest.isDynamic) {
            var maxPos = maximumPositionCalculator.getCurrentMaximumPosition();
            contentDuration.setValue(maxPos);
        }
        else {
            // TODO handle finished dynamic contents?
            contentDuration.setValue(undefined);
        }
    }), ignoreElements());
    var updateDurationAndTimeBoundsOnTrackChange$ = streams.pipe(tap(function (message) {
        if (message.type === "adaptationChange") {
            var lastPeriod = manifest.periods[manifest.periods.length - 1];
            if (message.value.period.id === (lastPeriod === null || lastPeriod === void 0 ? void 0 : lastPeriod.id)) {
                if (message.value.type === "audio") {
                    maximumPositionCalculator
                        .updateLastAudioAdaptation(message.value.adaptation);
                    if (!manifest.isDynamic) {
                        contentDuration.setValue(maximumPositionCalculator.getCurrentMaximumPosition());
                    }
                }
                else if (message.value.type === "video") {
                    maximumPositionCalculator
                        .updateLastVideoAdaptation(message.value.adaptation);
                    if (!manifest.isDynamic) {
                        contentDuration.setValue(maximumPositionCalculator.getCurrentMaximumPosition());
                    }
                }
            }
        }
    }), ignoreElements());
    return observableMerge(updateDurationOnManifestUpdate$, updateDurationAndTimeBoundsOnTrackChange$, outOfManifest$, contentDuration.asObservable().pipe(skipWhile(function (val) { return val === undefined; }), distinctUntilChanged(), map(function (value) { return ({ type: "contentDurationUpdate", value: value }); })));
}
/**
 * Calculate the last position from the last chosen audio and video Adaptations
 * for the last Period (or a default one, if no Adaptations has been chosen).
 * @class MaximumPositionCalculator
 */
var MaximumPositionCalculator = /** @class */ (function () {
    /**
     * @param {Object} manifest
     */
    function MaximumPositionCalculator(manifest) {
        this._manifest = manifest;
        this._lastAudioAdaptation = undefined;
        this._lastVideoAdaptation = undefined;
    }
    /**
     * Update the last known audio Adaptation for the last Period.
     * If no Adaptation has been set, it should be set to `null`.
     *
     * Allows to calculate the maximum position more precizely in
     * `getCurrentMaximumPosition`.
     * @param {Object|null} adaptation
     */
    MaximumPositionCalculator.prototype.updateLastAudioAdaptation = function (adaptation) {
        this._lastAudioAdaptation = adaptation;
    };
    /**
     * Update the last known video Adaptation for the last Period.
     * If no Adaptation has been set, it should be set to `null`.
     *
     * Allows to calculate the maximum position more precizely in
     * `getCurrentMaximumPosition`.
     * @param {Object|null} adaptation
     */
    MaximumPositionCalculator.prototype.updateLastVideoAdaptation = function (adaptation) {
        this._lastVideoAdaptation = adaptation;
    };
    /**
     * Returns an estimate of the maximum position reachable under the current
     * circumstances.
     * @returns {number}
     */
    MaximumPositionCalculator.prototype.getCurrentMaximumPosition = function () {
        var _a;
        if (this._manifest.isDynamic) {
            return (_a = this._manifest.getLivePosition()) !== null && _a !== void 0 ? _a : this._manifest.getMaximumSafePosition();
        }
        if (this._lastVideoAdaptation === undefined ||
            this._lastAudioAdaptation === undefined) {
            return this._manifest.getMaximumSafePosition();
        }
        else if (this._lastAudioAdaptation === null) {
            if (this._lastVideoAdaptation === null) {
                return this._manifest.getMaximumSafePosition();
            }
            else {
                var lastVideoPosition = getLastPositionFromAdaptation(this._lastVideoAdaptation);
                if (typeof lastVideoPosition !== "number") {
                    return this._manifest.getMaximumSafePosition();
                }
                return lastVideoPosition;
            }
        }
        else if (this._lastVideoAdaptation === null) {
            var lastAudioPosition = getLastPositionFromAdaptation(this._lastAudioAdaptation);
            if (typeof lastAudioPosition !== "number") {
                return this._manifest.getMaximumSafePosition();
            }
            return lastAudioPosition;
        }
        else {
            var lastAudioPosition = getLastPositionFromAdaptation(this._lastAudioAdaptation);
            var lastVideoPosition = getLastPositionFromAdaptation(this._lastVideoAdaptation);
            if (typeof lastAudioPosition !== "number" ||
                typeof lastVideoPosition !== "number") {
                return this._manifest.getMaximumSafePosition();
            }
            else {
                return Math.min(lastAudioPosition, lastVideoPosition);
            }
        }
    };
    return MaximumPositionCalculator;
}());
/**
 * Returns "last time of reference" from the adaptation given.
 * `undefined` if a time could not be found.
 * Null if the Adaptation has no segments (it could be that it didn't started or
 * that it already finished for example).
 *
 * We consider the earliest last time from every representations in the given
 * adaptation.
 * @param {Object} adaptation
 * @returns {Number|undefined|null}
 */
function getLastPositionFromAdaptation(adaptation) {
    var representations = adaptation.representations;
    var min = null;
    /**
     * Some Manifest parsers use the exact same `IRepresentationIndex` reference
     * for each Representation of a given Adaptation, because in the actual source
     * Manifest file, indexing data is often defined at Adaptation-level.
     * This variable allows to optimize the logic here when this is the case.
     */
    var lastIndex;
    for (var i = 0; i < representations.length; i++) {
        if (representations[i].index !== lastIndex) {
            lastIndex = representations[i].index;
            var lastPosition = representations[i].index.getLastPosition();
            if (lastPosition === undefined) { // we cannot tell
                return undefined;
            }
            if (lastPosition !== null) {
                min = min == null ? lastPosition :
                    Math.min(min, lastPosition);
            }
        }
    }
    if (min === null) { // It means that all positions were null === no segments (yet?)
        return null;
    }
    return min;
}
