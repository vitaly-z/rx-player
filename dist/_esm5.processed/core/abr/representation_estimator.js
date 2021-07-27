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
import { combineLatest as observableCombineLatest, defer as observableDefer, merge as observableMerge, of as observableOf, } from "rxjs";
import { filter, ignoreElements, map, startWith, switchMap, tap, withLatestFrom, } from "rxjs/operators";
import log from "../../log";
import arrayFindIndex from "../../utils/array_find_index";
import { getLeftSizeOfRange } from "../../utils/ranges";
import BufferBasedChooser from "./buffer_based_chooser";
import generateCachedSegmentDetector from "./cached_segment_detector";
import filterByBitrate from "./filter_by_bitrate";
import filterByWidth from "./filter_by_width";
import NetworkAnalyzer, { estimateRequestBandwidth, } from "./network_analyzer";
import PendingRequestsStore from "./pending_requests_store";
import RepresentationScoreCalculator from "./representation_score_calculator";
import selectOptimalRepresentation from "./select_optimal_representation";
/**
 * Filter representations given through filters options.
 * @param {Array.<Representation>} representations
 * @param {Object} filters - Filter Object.
 * @returns {Array.<Representation>}
 */
function getFilteredRepresentations(representations, filters) {
    var _representations = representations;
    if (filters.bitrate != null) {
        _representations = filterByBitrate(_representations, filters.bitrate);
    }
    if (filters.width != null) {
        _representations = filterByWidth(_representations, filters.width);
    }
    return _representations;
}
function getSuperiorRepresentation(representations, currentRepresentation) {
    var len = representations.length;
    var index = arrayFindIndex(representations, function (_a) {
        var id = _a.id;
        return id === currentRepresentation.id;
    });
    if (index < 0) {
        // XXX TODO log.error?
        return null;
    }
    else if (index === len - 1) {
        return null;
    }
    else {
        return representations[index + 1];
    }
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
    var bandwidthEstimator = _a.bandwidthEstimator, clock$ = _a.clock$, filters$ = _a.filters$, initialBitrate = _a.initialBitrate, lowLatencyMode = _a.lowLatencyMode, manualBitrate$ = _a.manualBitrate$, minAutoBitrate$ = _a.minAutoBitrate$, maxAutoBitrate$ = _a.maxAutoBitrate$, representations = _a.representations, streamEvents$ = _a.streamEvents$;
    var scoreCalculator = new RepresentationScoreCalculator();
    var networkAnalyzer = new NetworkAnalyzer(initialBitrate == null ? 0 :
        initialBitrate, lowLatencyMode);
    var requestsStore = new PendingRequestsStore();
    var shouldIgnoreMetrics = generateCachedSegmentDetector();
    /**
     * Callback to call when new metrics are available
     * @param {Object} value
     */
    function onMetric(value) {
        var duration = value.duration, size = value.size, content = value.content;
        if (shouldIgnoreMetrics(content, duration)) {
            // We already loaded not cached segments.
            // Do not consider cached segments anymore.
            return;
        }
        // calculate bandwidth
        bandwidthEstimator.addSample(duration, size);
        var segment = content.segment;
        if (!segment.isInit) {
            // calculate "maintainability score"
            var requestDuration = duration / 1000;
            var segmentDuration = segment.duration;
            var representation = content.representation;
            scoreCalculator.addSample(representation, requestDuration, segmentDuration);
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
            var prevEstimate = new EstimateStorage();
            var allowBufferBasedEstimates = false;
            var blockGuessingModeUntil = 0;
            var consecutiveWrongGuesses = 0;
            // Emit each time a buffer-based estimation should be actualized (each
            // time a segment is added).
            var bufferBasedClock$ = streamEvents$.pipe(filter(function (e) { return e.type === "added-segment"; }), withLatestFrom(clock$), map(function (_a) {
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
            var bufferBasedEstimation$ = BufferBasedChooser(bufferBasedClock$, bitrates)
                .pipe(startWith(undefined));
            return observableCombineLatest([clock$,
                minAutoBitrate$,
                maxAutoBitrate$,
                filters$,
                bufferBasedEstimation$]).pipe(withLatestFrom(currentRepresentation$), map(function (_a) {
                var _b = _a[0], clock = _b[0], minAutoBitrate = _b[1], maxAutoBitrate = _b[2], filters = _b[3], bufferBasedBitrate = _b[4], currentRepresentation = _a[1];
                var bufferGap = clock.bufferGap, speed = clock.speed;
                var _representations = getFilteredRepresentations(representations, filters);
                var requests = requestsStore.getRequests();
                var _c = networkAnalyzer
                    .getBandwidthEstimate(clock, bandwidthEstimator, currentRepresentation, requests, prevEstimate.bandwidth), bandwidthEstimate = _c.bandwidthEstimate, bitrateChosen = _c.bitrateChosen;
                var stableRepresentation = scoreCalculator.getLastStableRepresentation();
                var knownStableBitrate = stableRepresentation === null ?
                    undefined :
                    stableRepresentation.bitrate / (clock.speed > 0 ? clock.speed : 1);
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
                var chosenRepFromBandwidth = selectOptimalRepresentation(_representations, bitrateChosen, minAutoBitrate, maxAutoBitrate);
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
                var chosenRepFromBufferSize = allowBufferBasedEstimates &&
                    bufferBasedBitrate !== undefined &&
                    chosenRepFromBandwidth.bitrate < bufferBasedBitrate ?
                    selectOptimalRepresentation(_representations, bufferBasedBitrate, minAutoBitrate, maxAutoBitrate) :
                    null;
                /**
                 * Representation chosen by the more adventurous "guessing mode", which
                 * iterate through Representations one by one until finding one that
                 * cannot be "maintained".
                 * If defined, takes precedence over both `chosenRepFromBandwidth` and
                 * `chosenRepFromBufferSize`.
                 *
                 * This is the riskiest choice (in terms of rebuffering chances) but is
                 * only enabled when the real risk is low and the reward is high!
                 *
                 * `null` if guessing mode is not enabled or if we're already
                 * considering the best Representation.
                 */
                var chosenRepFromGuessMode = null;
                var prevRep = prevEstimate.representation;
                if (clock.liveGap === undefined || clock.liveGap > 50) {
                    // We're not live or far from the live edge, no need to take any risk
                    chosenRepFromGuessMode = null;
                }
                else if (currentRepresentation === null || prevRep === null) {
                    // There's nothing to base our guess on
                    chosenRepFromGuessMode = null;
                }
                else if (chosenRepFromBufferSize !== null &&
                    chosenRepFromBufferSize.bitrate > prevRep.bitrate) {
                    // Buffer-based estimates are already superior or equal to the guess
                    // we'll be doing here, so no need to guess
                    chosenRepFromGuessMode = null;
                }
                else if (prevEstimate.wasGuessed) {
                    // We're currently in guessing mode
                    // First check if the other estimates validate the guess
                    if ((chosenRepFromBufferSize === null || chosenRepFromBufferSize === void 0 ? void 0 : chosenRepFromBufferSize.bitrate) === prevRep.bitrate) {
                        log.debug("ABR: Guessed Representation validated by buffer-based logic", prevRep.bitrate);
                        consecutiveWrongGuesses = 0;
                    }
                    else if (chosenRepFromBandwidth.bitrate >= prevRep.bitrate) {
                        log.debug("ABR: Guessed Representation validated by bandwidth-based logic", prevRep.bitrate);
                        consecutiveWrongGuesses = 0;
                    }
                    else if (currentRepresentation.id === prevRep.id) {
                        var stayInGuessMode = true;
                        var guessedRepresentationRequests = requests.filter(function (req) {
                            return req.content.representation.id === currentRepresentation.id;
                        });
                        var now = performance.now();
                        for (var i = 0; i < guessedRepresentationRequests.length; i++) {
                            var req = guessedRepresentationRequests[i];
                            var requestElapsedTime = now - req.requestTimestamp;
                            if (req.content.segment.isInit) {
                                if (requestElapsedTime > 1000) {
                                    stayInGuessMode = false;
                                    break;
                                }
                            }
                            else if (requestElapsedTime > req.duration * 1000) {
                                stayInGuessMode = false;
                                break;
                            }
                            else {
                                var fastBw = estimateRequestBandwidth(req);
                                if (fastBw !== undefined && fastBw < currentRepresentation.bitrate) {
                                    stayInGuessMode = false;
                                    break;
                                }
                            }
                        }
                        var scoreData = scoreCalculator.getEstimate(currentRepresentation);
                        if (stayInGuessMode && (scoreData === undefined || scoreData[0] > 1.2)) {
                            // continue with the guess
                            // console.error("Continuing", scoreData?.[0]);
                            chosenRepFromGuessMode = currentRepresentation;
                        }
                        else {
                            // console.error("BLOCKING!!!!!!!!!!!!!!",
                            //               scoreData?.[0],
                            //               stayInGuessMode);
                            // Block guesses for 2 minutes
                            consecutiveWrongGuesses++;
                            blockGuessingModeUntil = performance.now() +
                                Math.min(consecutiveWrongGuesses * 120000, 360000);
                        }
                    }
                    else {
                        var scoreData = scoreCalculator.getEstimate(currentRepresentation);
                        if (scoreData !== undefined) {
                            var representationScore = scoreData[0], confidenceLevel = scoreData[1];
                            var enableGuessingMode = isFinite(bufferGap) && bufferGap >= 6 &&
                                performance.now() > blockGuessingModeUntil &&
                                confidenceLevel === 1 /* HIGH */ &&
                                representationScore / speed >= 1.4;
                            if (enableGuessingMode) {
                                var nextRepresentation = getSuperiorRepresentation(_representations, currentRepresentation);
                                if (nextRepresentation !== null) {
                                    chosenRepFromGuessMode = nextRepresentation;
                                }
                            }
                        }
                    }
                }
                else if (currentRepresentation !== null) {
                    var scoreData = scoreCalculator.getEstimate(currentRepresentation);
                    if (scoreData !== undefined) {
                        var representationScore = scoreData[0], confidenceLevel = scoreData[1];
                        var enableGuessingMode = isFinite(bufferGap) && bufferGap >= 6 &&
                            performance.now() > blockGuessingModeUntil &&
                            confidenceLevel === 1 /* HIGH */ &&
                            representationScore / speed >= 1.4;
                        if (enableGuessingMode) {
                            var nextRepresentation = getSuperiorRepresentation(_representations, currentRepresentation);
                            if (nextRepresentation !== null) {
                                // console.error("GUESSING!!!!!!!!!!!!!!");
                                chosenRepFromGuessMode = nextRepresentation;
                            }
                        }
                    }
                }
                if (chosenRepFromGuessMode !== null) {
                    log.debug("ABR: Choosing representation with guess-based estimation.", chosenRepFromGuessMode);
                    prevEstimate.store(chosenRepFromGuessMode, bandwidthEstimate, true);
                    return { bitrate: bandwidthEstimate,
                        representation: chosenRepFromGuessMode,
                        urgent: false,
                        manual: false,
                        knownStableBitrate: knownStableBitrate };
                }
                else if (chosenRepFromBufferSize !== null) {
                    log.debug("ABR: Choosing representation with buffer-based estimation.", chosenRepFromBufferSize);
                    prevEstimate.store(chosenRepFromBufferSize, bandwidthEstimate, false);
                    return { bitrate: bandwidthEstimate,
                        representation: chosenRepFromBufferSize,
                        urgent: networkAnalyzer.isUrgent(chosenRepFromBufferSize.bitrate, currentRepresentation, requests, clock),
                        manual: false,
                        knownStableBitrate: knownStableBitrate };
                }
                else {
                    log.debug("ABR: Choosing representation with bandwidth estimation.", chosenRepFromBandwidth);
                    prevEstimate.store(chosenRepFromBandwidth, bandwidthEstimate, false);
                    return { bitrate: bandwidthEstimate,
                        representation: chosenRepFromBandwidth,
                        urgent: networkAnalyzer.isUrgent(chosenRepFromBandwidth.bitrate, currentRepresentation, requests, clock),
                        manual: false,
                        knownStableBitrate: knownStableBitrate };
                }
            }));
        }));
    });
    return observableMerge(metrics$, requests$, estimate$);
}
/** Stores the last estimate made by the estimator */
var EstimateStorage = /** @class */ (function () {
    // public estimateMode : "none" | /* no estimate have been made yet. */
    //                       "bandwidth" | /* bandwidth-based estimate */
    //                       "buffer" | /* buffer-based estimate */
    //                       "guess"; /* guess-based estimate */
    function EstimateStorage() {
        this.bandwidth = undefined;
        this.representation = null;
        this.wasGuessed = false;
    }
    EstimateStorage.prototype.store = function (representation, bandwidth, wasGuessed) {
        this.representation = representation;
        this.bandwidth = bandwidth;
        this.wasGuessed = wasGuessed;
    };
    return EstimateStorage;
}());
