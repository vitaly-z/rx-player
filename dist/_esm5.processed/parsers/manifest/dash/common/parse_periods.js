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
import log from "../../../../log";
import flatMap from "../../../../utils/flat_map";
import idGenerator from "../../../../utils/id_generator";
import objectValues from "../../../../utils/object_values";
import { utf8ToStr } from "../../../../utils/string_parsing";
// eslint-disable-next-line max-len
import flattenOverlappingPeriods from "./flatten_overlapping_periods";
import getPeriodsTimeInformation from "./get_periods_time_infos";
import ManifestBoundsCalculator from "./manifest_bounds_calculator";
import parseAdaptationSets from "./parse_adaptation_sets";
import resolveBaseURLs from "./resolve_base_urls";
var generatePeriodID = idGenerator();
/**
 * Process intermediate periods to create final parsed periods.
 * @param {Array.<Object>} periodsIR
 * @param {Object} context
 * @returns {Array.<Object>}
 */
export default function parsePeriods(periodsIR, context) {
    var _a, _b, _c, _d, _e, _f;
    var parsedPeriods = [];
    var periodsTimeInformation = getPeriodsTimeInformation(periodsIR, context);
    if (periodsTimeInformation.length !== periodsIR.length) {
        throw new Error("MPD parsing error: the time information are incoherent.");
    }
    var isDynamic = context.isDynamic, timeShiftBufferDepth = context.timeShiftBufferDepth;
    var manifestBoundsCalculator = new ManifestBoundsCalculator({ isDynamic: isDynamic, timeShiftBufferDepth: timeShiftBufferDepth });
    if (!isDynamic && context.duration != null) {
        manifestBoundsCalculator.setLastPosition(context.duration);
    }
    var _loop_1 = function (i) {
        var isLastPeriod = i === periodsIR.length - 1;
        var periodIR = periodsIR[i];
        var xlinkInfos = context.xlinkInfos.get(periodIR);
        var periodBaseURLs = resolveBaseURLs(context.baseURLs, periodIR.children.baseURLs);
        var _g = periodsTimeInformation[i], periodStart = _g.periodStart, periodDuration = _g.periodDuration, periodEnd = _g.periodEnd;
        var periodID;
        if (periodIR.attributes.id == null) {
            log.warn("DASH: No usable id found in the Period. Generating one.");
            periodID = "gen-dash-period-" + generatePeriodID();
        }
        else {
            periodID = periodIR.attributes.id;
        }
        // Avoid duplicate IDs
        while (parsedPeriods.some(function (p) { return p.id === periodID; })) {
            periodID += "-dup";
        }
        var receivedTime = xlinkInfos !== undefined ? xlinkInfos.receivedTime :
            context.receivedTime;
        var unsafelyBaseOnPreviousPeriod = (_b = (_a = context
            .unsafelyBaseOnPreviousManifest) === null || _a === void 0 ? void 0 : _a.getPeriod(periodID)) !== null && _b !== void 0 ? _b : null;
        var availabilityTimeComplete = (_c = periodIR.attributes.availabilityTimeComplete) !== null && _c !== void 0 ? _c : true;
        var availabilityTimeOffset = (_d = periodIR.attributes.availabilityTimeOffset) !== null && _d !== void 0 ? _d : 0;
        var aggressiveMode = context.aggressiveMode, manifestProfiles = context.manifestProfiles;
        var segmentTemplate = periodIR.children.segmentTemplate;
        var adapCtxt = { aggressiveMode: aggressiveMode, availabilityTimeComplete: availabilityTimeComplete, availabilityTimeOffset: availabilityTimeOffset, baseURLs: periodBaseURLs, manifestBoundsCalculator: manifestBoundsCalculator, end: periodEnd, isDynamic: isDynamic, isLastPeriod: isLastPeriod, manifestProfiles: manifestProfiles, receivedTime: receivedTime, segmentTemplate: segmentTemplate, start: periodStart, timeShiftBufferDepth: timeShiftBufferDepth, unsafelyBaseOnPreviousPeriod: unsafelyBaseOnPreviousPeriod };
        var adaptations = parseAdaptationSets(periodIR.children.adaptations, adapCtxt);
        var namespaces = ((_e = context.xmlNamespaces) !== null && _e !== void 0 ? _e : [])
            .concat((_f = periodIR.attributes.namespaces) !== null && _f !== void 0 ? _f : []);
        var streamEvents = generateStreamEvents(periodIR.children.eventStreams, periodStart, namespaces);
        var parsedPeriod = { id: periodID,
            start: periodStart,
            end: periodEnd,
            duration: periodDuration, adaptations: adaptations, streamEvents: streamEvents };
        parsedPeriods.unshift(parsedPeriod);
        if (!manifestBoundsCalculator.lastPositionIsKnown()) {
            var lastPosition = getMaximumLastPosition(adaptations);
            if (!isDynamic) {
                if (typeof lastPosition === "number") {
                    manifestBoundsCalculator.setLastPosition(lastPosition);
                }
            }
            else {
                if (typeof lastPosition === "number") {
                    var positionTime = performance.now() / 1000;
                    manifestBoundsCalculator.setLastPosition(lastPosition, positionTime);
                }
                else {
                    var guessedLastPositionFromClock = guessLastPositionFromClock(context, periodStart);
                    if (guessedLastPositionFromClock !== undefined) {
                        var guessedLastPosition = guessedLastPositionFromClock[0], guessedPositionTime = guessedLastPositionFromClock[1];
                        manifestBoundsCalculator.setLastPosition(guessedLastPosition, guessedPositionTime);
                    }
                }
            }
        }
    };
    // We parse it in reverse because we might need to deduce the buffer depth from
    // the last Periods' indexes
    for (var i = periodsIR.length - 1; i >= 0; i--) {
        _loop_1(i);
    }
    if (context.isDynamic && !manifestBoundsCalculator.lastPositionIsKnown()) {
        // Guess a last time the last position
        var guessedLastPositionFromClock = guessLastPositionFromClock(context, 0);
        if (guessedLastPositionFromClock !== undefined) {
            var lastPosition = guessedLastPositionFromClock[0], positionTime = guessedLastPositionFromClock[1];
            manifestBoundsCalculator.setLastPosition(lastPosition, positionTime);
        }
    }
    return flattenOverlappingPeriods(parsedPeriods);
}
/**
 * Try to guess the "last position", which is the last position
 * available in the manifest in seconds, and the "position time", the time
 * (`performance.now()`) in which the last position was collected.
 *
 * These values allows to retrieve at any time in the future the new last
 * position, by substracting the position time to the last position, and
 * adding to it the new value returned by `performance.now`.
 *
 * The last position and position time are returned by this function if and only if
 * it would indicate a last position superior to the `minimumTime` given.
 *
 * This last part allows for example to detect which Period is likely to be the
 * "current" one in multi-periods contents. By giving the Period's start as a
 * `minimumTime`, you ensure that you will get a value only if the current time
 * is in that period.
 *
 * This is useful as guessing the live time from the clock can be seen as a last
 * resort. By detecting that the current time is before the currently considered
 * Period, we can just parse and look at the previous Period. If we can guess
 * the live time more directly from that previous one, we might be better off
 * than just using the clock.
 *
 * @param {Object} context
 * @param {number} minimumTime
 * @returns {Array.<number|undefined>}
 */
function guessLastPositionFromClock(context, minimumTime) {
    if (context.clockOffset != null) {
        var lastPosition = context.clockOffset / 1000 -
            context.availabilityStartTime;
        var positionTime = performance.now() / 1000;
        var timeInSec = positionTime + lastPosition;
        if (timeInSec >= minimumTime) {
            return [timeInSec, positionTime];
        }
    }
    else {
        var now = Date.now() / 1000;
        if (now >= minimumTime) {
            log.warn("DASH Parser: no clock synchronization mechanism found." +
                " Using the system clock instead.");
            var lastPosition = now - context.availabilityStartTime;
            var positionTime = performance.now() / 1000;
            return [lastPosition, positionTime];
        }
    }
    return undefined;
}
/**
 * Try to extract the last position declared for any segments in a Period:
 *   - If at least a single index' last position is defined, take the maximum
 *     among them.
 *   - If segments are available but we cannot define the last position
 *     return undefined.
 *   - If no segment are available in that period, return null
 * @param {Object} adaptationsPerType
 * @returns {number|null|undefined}
 */
function getMaximumLastPosition(adaptationsPerType) {
    var maxEncounteredPosition = null;
    var allIndexAreEmpty = true;
    var adaptationsVal = objectValues(adaptationsPerType)
        .filter(function (ada) { return ada != null; });
    var allAdaptations = flatMap(adaptationsVal, function (adaptationsForType) { return adaptationsForType; });
    for (var _i = 0, allAdaptations_1 = allAdaptations; _i < allAdaptations_1.length; _i++) {
        var adaptation = allAdaptations_1[_i];
        var representations = adaptation.representations;
        for (var _a = 0, representations_1 = representations; _a < representations_1.length; _a++) {
            var representation = representations_1[_a];
            var position = representation.index.getLastAvailablePosition();
            if (position !== null) {
                allIndexAreEmpty = false;
                if (typeof position === "number") {
                    maxEncounteredPosition =
                        maxEncounteredPosition == null ? position :
                            Math.max(maxEncounteredPosition, position);
                }
            }
        }
    }
    if (maxEncounteredPosition != null) {
        return maxEncounteredPosition;
    }
    else if (allIndexAreEmpty) {
        return null;
    }
    return undefined;
}
/**
 * Generate parsed "eventStream" objects from a `StreamEvent` node's
 * intermediate Representation.
 * @param {Array.<Object>} baseIr - The array of every encountered StreamEvent's
 * intermediate representations for a given Period.
 * @param {number} periodStart - The time in seconds at which this corresponding
 * Period starts.
 * @returns {Array.<Object>} - The parsed objects.
 */
function generateStreamEvents(baseIr, periodStart, xmlNamespaces) {
    var _a, _b;
    var res = [];
    for (var _i = 0, baseIr_1 = baseIr; _i < baseIr_1.length; _i++) {
        var eventStreamIr = baseIr_1[_i];
        var _c = eventStreamIr.attributes, _d = _c.schemeIdUri, schemeIdUri = _d === void 0 ? "" : _d, _e = _c.timescale, timescale = _e === void 0 ? 1 : _e;
        var allNamespaces = xmlNamespaces
            .concat((_a = eventStreamIr.attributes.namespaces) !== null && _a !== void 0 ? _a : []);
        for (var _f = 0, _g = eventStreamIr.children.events; _f < _g.length; _f++) {
            var eventIr = _g[_f];
            if (eventIr.eventStreamData !== undefined) {
                var start = (((_b = eventIr.presentationTime) !== null && _b !== void 0 ? _b : 0) / timescale) + periodStart;
                var end = eventIr.duration === undefined ?
                    undefined :
                    start + (eventIr.duration / timescale);
                var element = void 0;
                if (eventIr.eventStreamData instanceof Element) {
                    element = eventIr.eventStreamData;
                }
                else {
                    // First, we will create a parent Element defining all namespaces that
                    // should have been encountered until know.
                    // This is needed because the DOMParser API might throw when
                    // encountering unknown namespaced attributes or elements in the given
                    // `<Event>` xml subset.
                    var parentNode = allNamespaces.reduce(function (acc, ns) {
                        return acc + "xmlns:" + ns.key + "=\"" + ns.value + "\" ";
                    }, "<toremove ");
                    parentNode += ">";
                    var elementToString = utf8ToStr(new Uint8Array(eventIr.eventStreamData));
                    element = new DOMParser()
                        .parseFromString(parentNode + elementToString + "</toremove>", "application/xml")
                        .documentElement
                        .childNodes[0]; // unwrap from the `<toremove>` element
                }
                res.push({ start: start, end: end, id: eventIr.id,
                    data: { type: "dash-event-stream",
                        value: { schemeIdUri: schemeIdUri, timescale: timescale, element: element } } });
            }
        }
    }
    return res;
}
