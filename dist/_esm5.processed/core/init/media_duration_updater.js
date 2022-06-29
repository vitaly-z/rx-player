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
import { combineLatest as observableCombineLatest, distinctUntilChanged, EMPTY, fromEvent as observableFromEvent, interval as observableInterval, map, merge as observableMerge, mergeMap, of as observableOf, startWith, switchMap, timer, } from "rxjs";
import { onSourceOpen$, onSourceClose$, onSourceEnded$, } from "../../compat/event_listeners";
import log from "../../log";
import { fromEvent } from "../../utils/event_emitter";
import createSharedReference from "../../utils/reference";
/** Number of seconds in a regular year. */
var YEAR_IN_SECONDS = 365 * 24 * 3600;
/**
 * Keep the MediaSource's duration up-to-date with what is being played.
 * @class MediaDurationUpdater
 */
var MediaDurationUpdater = /** @class */ (function () {
    /**
     * Create a new `MediaDurationUpdater` that will keep the given MediaSource's
     * duration as soon as possible.
     * This duration will be updated until the `stop` method is called.
     * @param {Object} manifest - The Manifest currently played.
     * For another content, you will have to create another `MediaDurationUpdater`.
     * @param {MediaSource} mediaSource - The MediaSource on which the content is
     * pushed.
     */
    function MediaDurationUpdater(manifest, mediaSource) {
        var _this = this;
        this._lastKnownDuration = createSharedReference(undefined);
        this._subscription = isMediaSourceOpened$(mediaSource).pipe(switchMap(function (canUpdate) {
            return canUpdate ? observableCombineLatest([_this._lastKnownDuration.asObservable(),
                fromEvent(manifest, "manifestUpdate")
                    .pipe(startWith(null))]) :
                EMPTY;
        }), switchMap(function (_a) {
            var lastKnownDuration = _a[0];
            return areSourceBuffersUpdating$(mediaSource.sourceBuffers).pipe(switchMap(function (areSBUpdating) {
                return areSBUpdating ? EMPTY :
                    recursivelyTryUpdatingDuration();
                function recursivelyTryUpdatingDuration() {
                    var res = setMediaSourceDuration(mediaSource, manifest, lastKnownDuration);
                    if (res === "success" /* MediaSourceDurationUpdateStatus.Success */) {
                        return EMPTY;
                    }
                    return timer(2000)
                        .pipe(mergeMap(function () { return recursivelyTryUpdatingDuration(); }));
                }
            }));
        })).subscribe();
    }
    /**
     * By default, the `MediaDurationUpdater` only set a safe estimate for the
     * MediaSource's duration.
     * A more precize duration can be set by communicating to it a more precize
     * media duration through `updateKnownDuration`.
     * If the duration becomes unknown, `undefined` can be given to it so the
     * `MediaDurationUpdater` goes back to a safe estimate.
     * @param {number | undefined} newDuration
     */
    MediaDurationUpdater.prototype.updateKnownDuration = function (newDuration) {
        this._lastKnownDuration.setValue(newDuration);
    };
    /**
     * Stop the `MediaDurationUpdater` from updating and free its resources.
     * Once stopped, it is not possible to start it again, beside creating another
     * `MediaDurationUpdater`.
     */
    MediaDurationUpdater.prototype.stop = function () {
        this._subscription.unsubscribe();
    };
    return MediaDurationUpdater;
}());
export default MediaDurationUpdater;
/**
 * Checks that duration can be updated on the MediaSource, and then
 * sets it.
 *
 * Returns either:
 *   - the new duration it has been updated to if it has
 *   - `null` if it hasn'nt been updated
 *
 * @param {MediaSource} mediaSource
 * @param {Object} manifest
 * @returns {string}
 */
function setMediaSourceDuration(mediaSource, manifest, knownDuration) {
    var _a;
    var newDuration = knownDuration;
    if (newDuration === undefined) {
        if (manifest.isDynamic) {
            var maxPotentialPos = (_a = manifest.getLivePosition()) !== null && _a !== void 0 ? _a : manifest.getMaximumSafePosition();
            // Some targets poorly support setting a very high number for durations.
            // Yet, in dynamic contents, we would prefer setting a value as high as possible
            // to still be able to seek anywhere we want to (even ahead of the Manifest if
            // we want to). As such, we put it at a safe default value of 2^32 excepted
            // when the maximum position is already relatively close to that value, where
            // we authorize exceptionally going over it.
            newDuration = Math.max(Math.pow(2, 32), maxPotentialPos + YEAR_IN_SECONDS);
        }
        else {
            newDuration = manifest.getMaximumSafePosition();
        }
    }
    var maxBufferedEnd = 0;
    for (var i = 0; i < mediaSource.sourceBuffers.length; i++) {
        var sourceBuffer = mediaSource.sourceBuffers[i];
        var sbBufferedLen = sourceBuffer.buffered.length;
        if (sbBufferedLen > 0) {
            maxBufferedEnd = Math.max(sourceBuffer.buffered.end(sbBufferedLen - 1));
        }
    }
    if (newDuration === mediaSource.duration) {
        return "success" /* MediaSourceDurationUpdateStatus.Success */;
    }
    else if (maxBufferedEnd > newDuration) {
        // We already buffered further than the duration we want to set.
        // Keep the duration that was set at that time as a security.
        if (maxBufferedEnd < mediaSource.duration) {
            try {
                log.info("Init: Updating duration to what is currently buffered", maxBufferedEnd);
                mediaSource.duration = newDuration;
            }
            catch (err) {
                log.warn("Duration Updater: Can't update duration on the MediaSource.", err instanceof Error ? err : "");
                return "failed" /* MediaSourceDurationUpdateStatus.Failed */;
            }
        }
        return "partial" /* MediaSourceDurationUpdateStatus.Partial */;
    }
    else {
        var oldDuration = mediaSource.duration;
        try {
            log.info("Init: Updating duration", newDuration);
            mediaSource.duration = newDuration;
        }
        catch (err) {
            log.warn("Duration Updater: Can't update duration on the MediaSource.", err instanceof Error ? err : "");
            return "failed" /* MediaSourceDurationUpdateStatus.Failed */;
        }
        var deltaToExpected = Math.abs(mediaSource.duration - newDuration);
        if (deltaToExpected >= 0.1) {
            var deltaToBefore = Math.abs(mediaSource.duration - oldDuration);
            return deltaToExpected < deltaToBefore ? "partial" /* MediaSourceDurationUpdateStatus.Partial */ :
                "failed" /* MediaSourceDurationUpdateStatus.Failed */;
        }
        return "success" /* MediaSourceDurationUpdateStatus.Success */;
    }
}
/**
 * Returns an Observable which will emit only when all the SourceBuffers ended
 * all pending updates.
 * @param {SourceBufferList} sourceBuffers
 * @returns {Observable}
 */
function areSourceBuffersUpdating$(sourceBuffers) {
    if (sourceBuffers.length === 0) {
        return observableOf(false);
    }
    var sourceBufferUpdatingStatuses = [];
    var _loop_1 = function (i) {
        var sourceBuffer = sourceBuffers[i];
        sourceBufferUpdatingStatuses.push(observableMerge(observableFromEvent(sourceBuffer, "updatestart").pipe(map(function () { return true; })), observableFromEvent(sourceBuffer, "update").pipe(map(function () { return false; })), observableInterval(500).pipe(map(function () { return sourceBuffer.updating; }))).pipe(startWith(sourceBuffer.updating), distinctUntilChanged()));
    };
    for (var i = 0; i < sourceBuffers.length; i++) {
        _loop_1(i);
    }
    return observableCombineLatest(sourceBufferUpdatingStatuses).pipe(map(function (areUpdating) {
        return areUpdating.some(function (isUpdating) { return isUpdating; });
    }), distinctUntilChanged());
}
/**
 * Emit a boolean that tells if the media source is opened or not.
 * @param {MediaSource} mediaSource
 * @returns {Object}
 */
function isMediaSourceOpened$(mediaSource) {
    return observableMerge(onSourceOpen$(mediaSource).pipe(map(function () { return true; })), onSourceEnded$(mediaSource).pipe(map(function () { return false; })), onSourceClose$(mediaSource).pipe(map(function () { return false; }))).pipe(startWith(mediaSource.readyState === "open"), distinctUntilChanged());
}
