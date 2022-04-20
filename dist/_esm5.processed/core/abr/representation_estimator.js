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
import { combineLatest as observableCombineLatest, defer as observableDefer, filter, ignoreElements, map, merge as observableMerge, of as observableOf, startWith, switchMap, tap, withLatestFrom, } from "rxjs";
import log from "../../log";
import { getLeftSizeOfRange } from "../../utils/ranges";
import BufferBasedChooser from "./buffer_based_chooser";
import GuessBasedChooser from "./guess_based_chooser";
import LastEstimateStorage from "./last_estimate_storage";
import NetworkAnalyzer from "./network_analyzer";
import PendingRequestsStore from "./pending_requests_store";
import RepresentationScoreCalculator from "./representation_score_calculator";
import filterByBitrate from "./utils/filter_by_bitrate";
import filterByWidth from "./utils/filter_by_width";
import selectOptimalRepresentation from "./utils/select_optimal_representation";
/**
 * Filter representations given through filters options.
 * @param {Array.<Representation>} representations
 * @param {Object} filters - Filter Object.
 * @returns {Array.<Representation>}
 */
function getFilteredRepresentations(representations, filters) {
    var filteredReps = representations;
    if (filters.bitrate != null) {
        filteredReps = filterByBitrate(filteredReps, filters.bitrate);
    }
    if (filters.width != null) {
        filteredReps = filterByWidth(filteredReps, filters.width);
    }
    return filteredReps;
}
/**
 * Estimate regularly the current network bandwidth and the best Representation
 * that can be played according to the current network and playback conditions.
 *
 * A `RepresentationEstimator` only does estimations for a given type (e.g.
 * "audio", "video" etc.) and Period.
 *
 * If estimates for multiple types and/or Periods are needed, you should
 * create as many `RepresentationEstimator`.
 * @param {Object} args
 * @returns {Observable}
 */
export default function RepresentationEstimator(_a) {
    var bandwidthEstimator = _a.bandwidthEstimator, observation$ = _a.observation$, filters$ = _a.filters$, initialBitrate = _a.initialBitrate, lowLatencyMode = _a.lowLatencyMode, manualBitrate$ = _a.manualBitrate$, minAutoBitrate$ = _a.minAutoBitrate$, maxAutoBitrate$ = _a.maxAutoBitrate$, representations = _a.representations, streamEvents$ = _a.streamEvents$;
    var scoreCalculator = new RepresentationScoreCalculator();
    var networkAnalyzer = new NetworkAnalyzer(initialBitrate == null ? 0 :
        initialBitrate, lowLatencyMode);
    var requestsStore = new PendingRequestsStore();
    /**
     * Callback to call when new metrics are available
     * @param {Object} value
     */
    function onMetric(value) {
        var requestDuration = value.requestDuration, segmentDuration = value.segmentDuration, size = value.size, content = value.content;
        // calculate bandwidth
        bandwidthEstimator.addSample(requestDuration, size);
        if (!content.segment.isInit) {
            // calculate "maintainability score"
            var segment = content.segment, representation = content.representation;
            if (segmentDuration === undefined && !segment.complete) {
                // We cannot know the real duration of the segment
                return;
            }
            var segDur = segmentDuration !== null && segmentDuration !== void 0 ? segmentDuration : segment.duration;
            scoreCalculator.addSample(representation, requestDuration / 1000, segDur);
        }
    }
    var metrics$ = streamEvents$.pipe(filter(function (e) { return e.type === "metrics"; }), tap(function (_a) {
        var value = _a.value;
        return onMetric(value);
    }), ignoreElements());
    var requests$ = streamEvents$.pipe(tap(function (evt) {
        switch (evt.type) {
            case "requestBegin":
                requestsStore.add(evt.value);
                break;
            case "requestEnd":
                requestsStore.remove(evt.value.id);
                break;
            case "progress":
                requestsStore.addProgress(evt.value);
                break;
        }
    }), ignoreElements());
    var currentRepresentation$ = streamEvents$.pipe(filter(function (e) { return e.type === "representationChange"; }), map(function (e) { return e.value.representation; }), startWith(null));
    var estimate$ = observableDefer(function () {
        if (representations.length === 0) {
            throw new Error("ABRManager: no representation choice given");
        }
        if (representations.length === 1) {
            return observableOf({ bitrate: undefined,
                representation: representations[0],
                manual: false,
                urgent: true,
                knownStableBitrate: undefined });
        }
        return manualBitrate$.pipe(switchMap(function (manualBitrate) {
            if (manualBitrate >= 0) {
                // -- MANUAL mode --
                var manualRepresentation = selectOptimalRepresentation(representations, manualBitrate, 0, Infinity);
                return observableOf({
                    representation: manualRepresentation,
                    bitrate: undefined,
                    knownStableBitrate: undefined,
                    manual: true,
                    urgent: true, // a manual bitrate switch should happen immediately
                });
            }
            // -- AUTO mode --
            /** Store the previous estimate made here. */
            var prevEstimate = new LastEstimateStorage();
            var allowBufferBasedEstimates = false;
            var guessBasedChooser = new GuessBasedChooser(scoreCalculator, prevEstimate);
            // Emit each time a buffer-based estimation should be actualized (each
            // time a segment is added).
            var bufferBasedobservation$ = streamEvents$.pipe(filter(function (e) { return e.type === "added-segment"; }), withLatestFrom(observation$), map(function (_a) {
                var evtValue = _a[0].value, _b = _a[1], speed = _b.speed, position = _b.position;
                var timeRanges = evtValue.buffered;
                var bufferGap = getLeftSizeOfRange(timeRanges, position);
                var representation = evtValue.content.representation;
                var scoreData = scoreCalculator.getEstimate(representation);
                var currentScore = scoreData === null || scoreData === void 0 ? void 0 : scoreData[0];
                var currentBitrate = representation.bitrate;
                return { bufferGap: bufferGap, currentBitrate: currentBitrate, currentScore: currentScore, speed: speed };
            }));
            var bitrates = representations.map(function (r) { return r.bitrate; });
            var bufferBasedChooser = new BufferBasedChooser(bitrates);
            var bufferBasedEstimation$ = bufferBasedobservation$.pipe(map(function (bbo) { return bufferBasedChooser.getEstimate(bbo); }), startWith(undefined));
            return observableCombineLatest([observation$,
                minAutoBitrate$,
                maxAutoBitrate$,
                filters$,
                bufferBasedEstimation$]).pipe(withLatestFrom(currentRepresentation$), map(function (_a) {
                var _b = _a[0], observation = _b[0], minAutoBitrate = _b[1], maxAutoBitrate = _b[2], filters = _b[3], bufferBasedBitrate = _b[4], currentRepresentation = _a[1];
                var bufferGap = observation.bufferGap, liveGap = observation.liveGap;
                var filteredReps = getFilteredRepresentations(representations, filters);
                var requests = requestsStore.getRequests();
                var _c = networkAnalyzer
                    .getBandwidthEstimate(observation, bandwidthEstimator, currentRepresentation, requests, prevEstimate.bandwidth), bandwidthEstimate = _c.bandwidthEstimate, bitrateChosen = _c.bitrateChosen;
                var stableRepresentation = scoreCalculator.getLastStableRepresentation();
                var knownStableBitrate = stableRepresentation === null ?
                    undefined :
                    stableRepresentation.bitrate / (observation.speed > 0 ? observation.speed :
                        1);
                if (allowBufferBasedEstimates && bufferGap <= 5) {
                    allowBufferBasedEstimates = false;
                }
                else if (!allowBufferBasedEstimates &&
                    isFinite(bufferGap) &&
                    bufferGap > 10) {
                    allowBufferBasedEstimates = true;
                }
                /**
                 * Representation chosen when considering only [pessimist] bandwidth
                 * calculation.
                 * This is a safe enough choice but might be lower than what the user
                 * could actually profit from.
                 */
                var chosenRepFromBandwidth = selectOptimalRepresentation(filteredReps, bitrateChosen, minAutoBitrate, maxAutoBitrate);
                var currentBestBitrate = chosenRepFromBandwidth.bitrate;
                /**
                 * Representation chosen when considering the current buffer size.
                 * If defined, takes precedence over `chosenRepFromBandwidth`.
                 *
                 * This is a very safe choice, yet it is very slow and might not be
                 * adapted to cases where a buffer cannot be build, such as live contents.
                 *
                 * `null` if this buffer size mode is not enabled or if we don't have a
                 * choice from it yet.
                 */
                var chosenRepFromBufferSize = null;
                if (allowBufferBasedEstimates &&
                    bufferBasedBitrate !== undefined &&
                    bufferBasedBitrate > currentBestBitrate) {
                    chosenRepFromBufferSize = selectOptimalRepresentation(filteredReps, bufferBasedBitrate, minAutoBitrate, maxAutoBitrate);
                    currentBestBitrate = chosenRepFromBufferSize.bitrate;
                }
                /**
                 * Representation chosen by the more adventurous `GuessBasedChooser`,
                 * which iterates through Representations one by one until finding one
                 * that cannot be "maintained".
                 *
                 * If defined, takes precedence over both `chosenRepFromBandwidth` and
                 * `chosenRepFromBufferSize`.
                 *
                 * This is the riskiest choice (in terms of rebuffering chances) but is
                 * only enabled when no other solution is adapted (for now, this just
                 * applies for low-latency contents when playing close to the live
                 * edge).
                 *
                 * `null` if not enabled or if there's currently no guess.
                 */
                var chosenRepFromGuessMode = null;
                if (lowLatencyMode &&
                    currentRepresentation !== null &&
                    liveGap !== undefined &&
                    liveGap < 40) {
                    chosenRepFromGuessMode = guessBasedChooser.getGuess(representations, observation, currentRepresentation, currentBestBitrate, requests);
                }
                if (chosenRepFromGuessMode !== null &&
                    chosenRepFromGuessMode.bitrate > currentBestBitrate) {
                    log.debug("ABR: Choosing representation with guess-based estimation.", chosenRepFromGuessMode.bitrate, chosenRepFromGuessMode.id);
                    prevEstimate.update(chosenRepFromGuessMode, bandwidthEstimate, 2 /* GuessBased */);
                    return { bitrate: bandwidthEstimate,
                        representation: chosenRepFromGuessMode,
                        urgent: currentRepresentation === null ||
                            chosenRepFromGuessMode.bitrate < currentRepresentation.bitrate,
                        manual: false, knownStableBitrate: knownStableBitrate };
                }
                else if (chosenRepFromBufferSize !== null) {
                    log.debug("ABR: Choosing representation with buffer-based estimation.", chosenRepFromBufferSize.bitrate, chosenRepFromBufferSize.id);
                    prevEstimate.update(chosenRepFromBufferSize, bandwidthEstimate, 0 /* BufferBased */);
                    return { bitrate: bandwidthEstimate,
                        representation: chosenRepFromBufferSize,
                        urgent: networkAnalyzer.isUrgent(chosenRepFromBufferSize.bitrate, currentRepresentation, requests, observation),
                        manual: false, knownStableBitrate: knownStableBitrate };
                }
                else {
                    log.debug("ABR: Choosing representation with bandwidth estimation.", chosenRepFromBandwidth.bitrate, chosenRepFromBandwidth.id);
                    prevEstimate.update(chosenRepFromBandwidth, bandwidthEstimate, 1 /* BandwidthBased */);
                    return { bitrate: bandwidthEstimate,
                        representation: chosenRepFromBandwidth,
                        urgent: networkAnalyzer.isUrgent(chosenRepFromBandwidth.bitrate, currentRepresentation, requests, observation),
                        manual: false, knownStableBitrate: knownStableBitrate };
                }
            }));
        }));
    });
    return observableMerge(metrics$, requests$, estimate$);
}
