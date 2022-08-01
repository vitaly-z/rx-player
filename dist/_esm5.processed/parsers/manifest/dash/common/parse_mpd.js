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
import config from "../../../../config";
import log from "../../../../log";
import arrayFind from "../../../../utils/array_find";
import { normalizeBaseURL } from "../../../../utils/resolve_url";
// eslint-disable-next-line max-len
import getClockOffset from "./get_clock_offset";
import getHTTPUTCTimingURL from "./get_http_utc-timing_url";
import getMinimumAndMaximumPositions from "./get_minimum_and_maximum_positions";
import parseAvailabilityStartTime from "./parse_availability_start_time";
import parsePeriods from "./parse_periods";
import resolveBaseURLs from "./resolve_base_urls";
/**
 * Checks if xlinks needs to be loaded before actually parsing the manifest.
 * @param {Object} mpdIR
 * @param {Object} args
 * @param {boolean} hasLoadedClock
 * @param {Array.<Object>} warnings
 * @returns {Object}
 */
export default function parseMpdIr(mpdIR, args, warnings, hasLoadedClock, xlinkInfos) {
    if (xlinkInfos === void 0) { xlinkInfos = new WeakMap(); }
    var rootChildren = mpdIR.children, rootAttributes = mpdIR.attributes;
    if (args.externalClockOffset == null) {
        var isDynamic = rootAttributes.type === "dynamic";
        var directTiming = arrayFind(rootChildren.utcTimings, function (utcTiming) {
            return utcTiming.schemeIdUri === "urn:mpeg:dash:utc:direct:2014" &&
                utcTiming.value != null;
        });
        var clockOffsetFromDirectUTCTiming = directTiming != null &&
            directTiming.value != null ? getClockOffset(directTiming.value) :
            undefined;
        var clockOffset = clockOffsetFromDirectUTCTiming != null &&
            !isNaN(clockOffsetFromDirectUTCTiming) ?
            clockOffsetFromDirectUTCTiming :
            undefined;
        if (clockOffset != null && hasLoadedClock !== true) {
            args.externalClockOffset = clockOffset;
        }
        else if (isDynamic && hasLoadedClock !== true) {
            var UTCTimingHTTPURL = getHTTPUTCTimingURL(mpdIR);
            if (UTCTimingHTTPURL != null && UTCTimingHTTPURL.length > 0) {
                // TODO fetch UTCTiming and XLinks at the same time
                return {
                    type: "needs-clock",
                    value: {
                        url: UTCTimingHTTPURL,
                        continue: function continueParsingMPD(responseDataClock) {
                            if (!responseDataClock.success) {
                                warnings.push(responseDataClock.error);
                                log.warn("DASH Parser: Error on fetching the clock ressource", responseDataClock.error);
                                return parseMpdIr(mpdIR, args, warnings, true);
                            }
                            args.externalClockOffset = getClockOffset(responseDataClock.data);
                            return parseMpdIr(mpdIR, args, warnings, true);
                        },
                    },
                };
            }
        }
    }
    var xlinksToLoad = [];
    for (var i = 0; i < rootChildren.periods.length; i++) {
        var _a = rootChildren.periods[i].attributes, xlinkHref = _a.xlinkHref, xlinkActuate = _a.xlinkActuate;
        if (xlinkHref != null && xlinkActuate === "onLoad") {
            xlinksToLoad.push({ index: i, ressource: xlinkHref });
        }
    }
    if (xlinksToLoad.length === 0) {
        return parseCompleteIntermediateRepresentation(mpdIR, args, warnings, xlinkInfos);
    }
    return {
        type: "needs-xlinks",
        value: {
            xlinksUrls: xlinksToLoad.map(function (_a) {
                var ressource = _a.ressource;
                return ressource;
            }),
            continue: function continueParsingMPD(loadedRessources) {
                var _a;
                if (loadedRessources.length !== xlinksToLoad.length) {
                    throw new Error("DASH parser: wrong number of loaded ressources.");
                }
                // Note: It is important to go from the last index to the first index in
                // the resulting array, as we will potentially add elements to the array
                for (var i = loadedRessources.length - 1; i >= 0; i--) {
                    var index = xlinksToLoad[i].index;
                    var _b = loadedRessources[i], periodsIR = _b.parsed, parsingWarnings = _b.warnings, receivedTime = _b.receivedTime, sendingTime = _b.sendingTime, url = _b.url;
                    if (parsingWarnings.length > 0) {
                        warnings.push.apply(warnings, parsingWarnings);
                    }
                    for (var _i = 0, periodsIR_1 = periodsIR; _i < periodsIR_1.length; _i++) {
                        var periodIR = periodsIR_1[_i];
                        xlinkInfos.set(periodIR, { receivedTime: receivedTime, sendingTime: sendingTime, url: url });
                    }
                    // replace original "xlinked" periods by the real deal
                    (_a = rootChildren.periods).splice.apply(_a, __spreadArray([index, 1], periodsIR, false));
                }
                return parseMpdIr(mpdIR, args, warnings, hasLoadedClock, xlinkInfos);
            },
        },
    };
}
/**
 * Parse the MPD intermediate representation into a regular Manifest.
 * @param {Object} mpdIR
 * @param {Object} args
 * @param {Array.<Object>} warnings
 * @param {Object} xlinkInfos
 * @returns {Object}
 */
function parseCompleteIntermediateRepresentation(mpdIR, args, warnings, xlinkInfos) {
    var _a, _b, _c;
    var rootChildren = mpdIR.children, rootAttributes = mpdIR.attributes;
    var isDynamic = rootAttributes.type === "dynamic";
    var initialBaseUrl = args.url !== undefined ?
        [{ url: normalizeBaseURL(args.url),
                availabilityTimeOffset: 0,
                availabilityTimeComplete: true }] :
        [];
    var mpdBaseUrls = resolveBaseURLs(initialBaseUrl, rootChildren.baseURLs);
    var availabilityStartTime = parseAvailabilityStartTime(rootAttributes, args.referenceDateTime);
    var timeShiftBufferDepth = rootAttributes.timeShiftBufferDepth;
    var clockOffset = args.externalClockOffset, unsafelyBaseOnPreviousManifest = args.unsafelyBaseOnPreviousManifest;
    var manifestInfos = { aggressiveMode: args.aggressiveMode, availabilityStartTime: availabilityStartTime, baseURLs: mpdBaseUrls, clockOffset: clockOffset, duration: rootAttributes.duration, isDynamic: isDynamic, manifestProfiles: mpdIR.attributes.profiles,
        receivedTime: args.manifestReceivedTime, timeShiftBufferDepth: timeShiftBufferDepth, unsafelyBaseOnPreviousManifest: unsafelyBaseOnPreviousManifest, xlinkInfos: xlinkInfos, xmlNamespaces: mpdIR.attributes.namespaces };
    var parsedPeriods = parsePeriods(rootChildren.periods, manifestInfos);
    var mediaPresentationDuration = rootAttributes.duration;
    var lifetime;
    var minimumTime;
    var timeshiftDepth = null;
    var maximumTimeData;
    if (rootAttributes.minimumUpdatePeriod !== undefined &&
        rootAttributes.minimumUpdatePeriod >= 0) {
        lifetime = rootAttributes.minimumUpdatePeriod === 0 ?
            config.getCurrent().DASH_FALLBACK_LIFETIME_WHEN_MINIMUM_UPDATE_PERIOD_EQUAL_0 :
            rootAttributes.minimumUpdatePeriod;
    }
    var _d = getMinimumAndMaximumPositions(parsedPeriods), minimumSafePosition = _d.minimumSafePosition, maximumSafePosition = _d.maximumSafePosition, maximumUnsafePosition = _d.maximumUnsafePosition;
    var now = performance.now();
    if (!isDynamic) {
        minimumTime = minimumSafePosition !== undefined ? minimumSafePosition :
            ((_a = parsedPeriods[0]) === null || _a === void 0 ? void 0 : _a.start) !== undefined ? parsedPeriods[0].start :
                0;
        var finalMaximumSafePosition = mediaPresentationDuration !== null && mediaPresentationDuration !== void 0 ? mediaPresentationDuration : Infinity;
        if (parsedPeriods[parsedPeriods.length - 1] !== undefined) {
            var lastPeriod = parsedPeriods[parsedPeriods.length - 1];
            var lastPeriodEnd = (_b = lastPeriod.end) !== null && _b !== void 0 ? _b : (lastPeriod.duration !== undefined ?
                lastPeriod.start + lastPeriod.duration :
                undefined);
            if (lastPeriodEnd !== undefined && lastPeriodEnd < finalMaximumSafePosition) {
                finalMaximumSafePosition = lastPeriodEnd;
            }
        }
        if (maximumSafePosition !== undefined &&
            maximumSafePosition < finalMaximumSafePosition) {
            finalMaximumSafePosition = maximumSafePosition;
        }
        maximumTimeData = { isLinear: false,
            maximumSafePosition: finalMaximumSafePosition,
            livePosition: undefined,
            time: now };
    }
    else {
        minimumTime = minimumSafePosition;
        timeshiftDepth = timeShiftBufferDepth !== null && timeShiftBufferDepth !== void 0 ? timeShiftBufferDepth : null;
        var finalMaximumSafePosition = void 0;
        var livePosition = void 0;
        if (maximumUnsafePosition !== undefined) {
            livePosition = maximumUnsafePosition;
        }
        if (maximumSafePosition !== undefined) {
            finalMaximumSafePosition = maximumSafePosition;
        }
        else {
            var ast = availabilityStartTime !== null && availabilityStartTime !== void 0 ? availabilityStartTime : 0;
            var externalClockOffset = args.externalClockOffset;
            if (externalClockOffset === undefined) {
                log.warn("DASH Parser: use system clock to define maximum position");
                finalMaximumSafePosition = (Date.now() / 1000) - ast;
            }
            else {
                var serverTime = performance.now() + externalClockOffset;
                finalMaximumSafePosition = (serverTime / 1000) - ast;
            }
        }
        if (livePosition === undefined) {
            livePosition = finalMaximumSafePosition;
        }
        maximumTimeData = { isLinear: true,
            maximumSafePosition: finalMaximumSafePosition, livePosition: livePosition, time: now };
        // if the minimum calculated time is even below the buffer depth, perhaps we
        // can go even lower in terms of depth
        if (timeshiftDepth !== null && minimumTime !== undefined &&
            finalMaximumSafePosition - minimumTime > timeshiftDepth) {
            timeshiftDepth = finalMaximumSafePosition - minimumTime;
        }
    }
    // `isLastPeriodKnown` should be `true` in two cases for DASH contents:
    //   1. When the content is static, because we know that no supplementary
    //      Period will be added.
    //   2. If the content is dynamic, only when both the duration is known and
    //      the `minimumUpdatePeriod` is not set. This corresponds to the case
    //      explained in "4.6.4. Transition Phase between Live and On-Demand" of
    //      the DASH-IF IOP v4.3 for live contents transitionning to on-demand.
    var isLastPeriodKnown = !isDynamic ||
        (mpdIR.attributes.minimumUpdatePeriod === undefined &&
            (((_c = parsedPeriods[parsedPeriods.length - 1]) === null || _c === void 0 ? void 0 : _c.end) !== undefined ||
                mpdIR.attributes.duration !== undefined));
    var parsedMPD = {
        availabilityStartTime: availabilityStartTime,
        clockOffset: args.externalClockOffset,
        isDynamic: isDynamic,
        isLive: isDynamic,
        isLastPeriodKnown: isLastPeriodKnown,
        periods: parsedPeriods,
        publishTime: rootAttributes.publishTime,
        suggestedPresentationDelay: rootAttributes.suggestedPresentationDelay,
        transportType: "dash",
        timeBounds: { minimumSafePosition: minimumTime, timeshiftDepth: timeshiftDepth, maximumTimeData: maximumTimeData },
        lifetime: lifetime,
        uris: args.url == null ?
            rootChildren.locations : __spreadArray([args.url], rootChildren.locations, true),
    };
    return { type: "done", value: { parsed: parsedMPD, warnings: warnings } };
}
