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
import config from "../../config";
import log from "../../log";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
/**
 * Returns the calculated initial time for the content described by the given
 * Manifest:
 *   1. if a start time is defined by user, calculate starting time from the
 *      manifest information
 *   2. else if the media is live, use the live edge and suggested delays from
 *      it
 *   3. else returns the minimum time announced in the manifest
 * @param {Manifest} manifest
 * @param {boolean} lowLatencyMode
 * @param {Object} startAt
 * @returns {Number}
 */
export default function getInitialTime(manifest, lowLatencyMode, startAt) {
    if (!isNullOrUndefined(startAt)) {
        var min = manifest.getMinimumSafePosition();
        var max = void 0;
        if (manifest.isLive) {
            max = manifest.getLivePosition();
        }
        if (max === undefined) {
            max = manifest.getMaximumSafePosition();
        }
        if (!isNullOrUndefined(startAt.position)) {
            log.debug("Init: using startAt.minimumPosition");
            return Math.max(Math.min(startAt.position, max), min);
        }
        else if (!isNullOrUndefined(startAt.wallClockTime)) {
            log.debug("Init: using startAt.wallClockTime");
            var ast = manifest.availabilityStartTime === undefined ?
                0 :
                manifest.availabilityStartTime;
            var position = startAt.wallClockTime - ast;
            return Math.max(Math.min(position, max), min);
        }
        else if (!isNullOrUndefined(startAt.fromFirstPosition)) {
            log.debug("Init: using startAt.fromFirstPosition");
            var fromFirstPosition = startAt.fromFirstPosition;
            return fromFirstPosition <= 0 ? min :
                Math.min(max, min + fromFirstPosition);
        }
        else if (!isNullOrUndefined(startAt.fromLastPosition)) {
            log.debug("Init: using startAt.fromLastPosition");
            var fromLastPosition = startAt.fromLastPosition;
            return fromLastPosition >= 0 ? max :
                Math.max(min, max + fromLastPosition);
        }
        else if (!isNullOrUndefined(startAt.percentage)) {
            log.debug("Init: using startAt.percentage");
            var percentage = startAt.percentage;
            if (percentage > 100) {
                return max;
            }
            else if (percentage < 0) {
                return min;
            }
            var ratio = +percentage / 100;
            var extent = max - min;
            return min + extent * ratio;
        }
    }
    var minimumPosition = manifest.getMinimumSafePosition();
    if (manifest.isLive) {
        var suggestedPresentationDelay = manifest.suggestedPresentationDelay, clockOffset = manifest.clockOffset;
        var maximumPosition = manifest.getMaximumSafePosition();
        var liveTime = void 0;
        var DEFAULT_LIVE_GAP = config.getCurrent().DEFAULT_LIVE_GAP;
        if (clockOffset === undefined) {
            log.info("Init: no clock offset found for a live content, " +
                "starting close to maximum available position");
            liveTime = maximumPosition;
        }
        else {
            log.info("Init: clock offset found for a live content, " +
                "checking if we can start close to it");
            var ast = manifest.availabilityStartTime === undefined ?
                0 :
                manifest.availabilityStartTime;
            var clockRelativeLiveTime = (performance.now() + clockOffset) / 1000 - ast;
            liveTime = Math.min(maximumPosition, clockRelativeLiveTime);
        }
        var diffFromLiveTime = suggestedPresentationDelay !== undefined ? suggestedPresentationDelay :
            lowLatencyMode ? DEFAULT_LIVE_GAP.LOW_LATENCY :
                DEFAULT_LIVE_GAP.DEFAULT;
        log.debug("Init: ".concat(liveTime, " defined as the live time, applying a live gap") +
            " of ".concat(diffFromLiveTime));
        return Math.max(liveTime - diffFromLiveTime, minimumPosition);
    }
    log.info("Init: starting at the minimum available position:", minimumPosition);
    return minimumPosition;
}
