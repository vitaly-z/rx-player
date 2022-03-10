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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { combineLatest as observableCombineLatest, map, of as observableOf, } from "rxjs";
import log from "../../log";
import objectAssign from "../../utils/object_assign";
import takeFirstSet from "../../utils/take_first_set";
import BandwidthEstimator from "./bandwidth_estimator";
import RepresentationEstimator from "./representation_estimator";
/**
 * Adaptive BitRate Manager.
 *
 * Select the right Representation from the network and buffer infos it
 * receives.
 * @class ABRManager
 */
var ABRManager = /** @class */ (function () {
    /**
     * @param {Object} options
     */
    function ABRManager(options) {
        this._manualBitrates = options.manualBitrates;
        this._minAutoBitrates = options.minAutoBitrates;
        this._maxAutoBitrates = options.maxAutoBitrates;
        this._initialBitrates = options.initialBitrates;
        this._throttlers = options.throttlers;
        this._bandwidthEstimators = {};
        this._lowLatencyMode = options.lowLatencyMode;
    }
    /**
     * Take type and an array of the available representations, spit out an
     * observable emitting the best representation (given the network/buffer
     * state).
     * @param {string} type
     * @param {Array.<Object>} representations
     * @param {Observable<Object>} observation$
     * @param {Observable<Object>} streamEvents$
     * @returns {Observable}
     */
    ABRManager.prototype.get$ = function (type, representations, observation$, streamEvents$) {
        var _a, _b, _c;
        var bandwidthEstimator = this._getBandwidthEstimator(type);
        var manualBitrate$ = takeFirstSet((_a = this._manualBitrates[type]) === null || _a === void 0 ? void 0 : _a.asObservable(), observableOf(-1));
        var minAutoBitrate$ = takeFirstSet((_b = this._minAutoBitrates[type]) === null || _b === void 0 ? void 0 : _b.asObservable(), observableOf(0));
        var maxAutoBitrate$ = takeFirstSet((_c = this._maxAutoBitrates[type]) === null || _c === void 0 ? void 0 : _c.asObservable(), observableOf(Infinity));
        var initialBitrate = takeFirstSet(this._initialBitrates[type], 0);
        var filters$ = createFilters(this._throttlers.limitWidth[type], this._throttlers.throttleBitrate[type], this._throttlers.throttle[type]);
        return RepresentationEstimator({ bandwidthEstimator: bandwidthEstimator, streamEvents$: streamEvents$, observation$: observation$, filters$: filters$, initialBitrate: initialBitrate, manualBitrate$: manualBitrate$, minAutoBitrate$: minAutoBitrate$, maxAutoBitrate$: maxAutoBitrate$, representations: representations, lowLatencyMode: this._lowLatencyMode });
    };
    /**
     * @param {string} bufferType
     * @returns {Object}
     */
    ABRManager.prototype._getBandwidthEstimator = function (bufferType) {
        var originalBandwidthEstimator = this._bandwidthEstimators[bufferType];
        if (originalBandwidthEstimator == null) {
            log.debug("ABR: Creating new BandwidthEstimator for ", bufferType);
            var bandwidthEstimator = new BandwidthEstimator();
            this._bandwidthEstimators[bufferType] = bandwidthEstimator;
            return bandwidthEstimator;
        }
        return originalBandwidthEstimator;
    };
    return ABRManager;
}());
export default ABRManager;
/**
 * Create Observable that merge several throttling Observables into one.
 * @param {Observable} limitWidth$ - Emit the width at which the chosen
 * Representation should be limited.
 * @param {Observable} throttleBitrate$ - Emit the maximum bitrate authorized.
 * @param {Observable} throttle$ - Also emit the maximum bitrate authorized.
 * Here for legacy reasons.
 * @returns {Observable}
 */
function createFilters(limitWidth$, throttleBitrate$, throttle$) {
    var deviceEventsArray = [];
    if (limitWidth$ != null) {
        deviceEventsArray.push(limitWidth$.pipe(map(function (width) { return ({ width: width }); })));
    }
    if (throttle$ != null) {
        deviceEventsArray.push(throttle$.pipe(map(function (bitrate) { return ({ bitrate: bitrate }); })));
    }
    if (throttleBitrate$ != null) {
        deviceEventsArray.push(throttleBitrate$.pipe(map(function (bitrate) { return ({ bitrate: bitrate }); })));
    }
    // Emit restrictions on the pools of available representations to choose
    // from.
    return deviceEventsArray.length > 0 ?
        observableCombineLatest(deviceEventsArray)
            .pipe(map(function (args) {
            return objectAssign.apply(void 0, __spreadArray([{}], args, false));
        })) :
        observableOf({});
}
