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
import log from "../../log";
import noop from "../../utils/noop";
import { getLeftSizeOfRange } from "../../utils/ranges";
import createSharedReference from "../../utils/reference";
import takeFirstSet from "../../utils/take_first_set";
import TaskCanceller from "../../utils/task_canceller";
import BufferBasedChooser from "./buffer_based_chooser";
import GuessBasedChooser from "./guess_based_chooser";
import NetworkAnalyzer from "./network_analyzer";
import BandwidthEstimator from "./utils/bandwidth_estimator";
import filterByBitrate from "./utils/filter_by_bitrate";
import filterByWidth from "./utils/filter_by_width";
import LastEstimateStorage from "./utils/last_estimate_storage";
import PendingRequestsStore from "./utils/pending_requests_store";
import RepresentationScoreCalculator from "./utils/representation_score_calculator";
import selectOptimalRepresentation from "./utils/select_optimal_representation";
/**
 * Select the most adapted Representation according to the network and buffer
 * metrics it receives.
 *
 * @param {Object} options - Initial configuration (see type definition)
 * @returns {Object} - Interface allowing to select a Representation.
 * @see IRepresentationEstimator
 */
export default function createAdaptiveRepresentationSelector(options) {
    /**
     * Allows to estimate the current network bandwidth.
     * One per active media type.
     */
    var bandwidthEstimators = {};
    var manualBitrates = options.manualBitrates, minAutoBitrates = options.minAutoBitrates, maxAutoBitrates = options.maxAutoBitrates, initialBitrates = options.initialBitrates, throttlers = options.throttlers, lowLatencyMode = options.lowLatencyMode;
    /**
     * Returns Object emitting Representation estimates as well as callbacks
     * allowing to helping it produce them.
     *
     * @see IRepresentationEstimator
     * @param {Object} context
     * @param {Object} currentRepresentation
     * @param {Object} representations
     * @param {Object} playbackObserver
     * @param {Object} stopAllEstimates
     * @returns {Array.<Object>}
     */
    return function getEstimates(context, currentRepresentation, representations, playbackObserver, stopAllEstimates) {
        var type = context.adaptation.type;
        var bandwidthEstimator = _getBandwidthEstimator(type);
        var manualBitrate = takeFirstSet(manualBitrates[type], createSharedReference(-1));
        var minAutoBitrate = takeFirstSet(minAutoBitrates[type], createSharedReference(0));
        var maxAutoBitrate = takeFirstSet(maxAutoBitrates[type], createSharedReference(Infinity));
        var initialBitrate = takeFirstSet(initialBitrates[type], 0);
        var filters = {
            limitWidth: takeFirstSet(throttlers.limitWidth[type], createSharedReference(undefined)),
            throttleBitrate: takeFirstSet(throttlers.throttleBitrate[type], throttlers.throttle[type], createSharedReference(Infinity)),
        };
        return getEstimateReference({ bandwidthEstimator: bandwidthEstimator, context: context, currentRepresentation: currentRepresentation, filters: filters, initialBitrate: initialBitrate, manualBitrate: manualBitrate, minAutoBitrate: minAutoBitrate, maxAutoBitrate: maxAutoBitrate, playbackObserver: playbackObserver, representations: representations, lowLatencyMode: lowLatencyMode }, stopAllEstimates);
    };
    /**
     * Returns interface allowing to estimate network throughtput for a given type.
     * @param {string} bufferType
     * @returns {Object}
     */
    function _getBandwidthEstimator(bufferType) {
        var originalBandwidthEstimator = bandwidthEstimators[bufferType];
        if (originalBandwidthEstimator == null) {
            log.debug("ABR: Creating new BandwidthEstimator for ", bufferType);
            var bandwidthEstimator = new BandwidthEstimator();
            bandwidthEstimators[bufferType] = bandwidthEstimator;
            return bandwidthEstimator;
        }
        return originalBandwidthEstimator;
    }
}
/**
 * Estimate regularly the current network bandwidth and the best Representation
 * that can be played according to the current network and playback conditions.
 *
 * `getEstimateReference` only does estimations for a given type (e.g.
 * "audio", "video" etc.) and Period.
 *
 * If estimates for multiple types and/or Periods are needed, you should
 * call `getEstimateReference` as many times.
 *
 * This function returns a tuple:
 *   - the first element being the object through which estimates will be produced
 *   - the second element being callbacks that have to be triggered at various
 *     events to help it doing those estimates.
 *
 * @param {Object} args
 * @param {Object} stopAllEstimates
 * @returns {Array.<Object>}
 */
function getEstimateReference(_a, stopAllEstimates) {
    var bandwidthEstimator = _a.bandwidthEstimator, context = _a.context, currentRepresentation = _a.currentRepresentation, filters = _a.filters, initialBitrate = _a.initialBitrate, lowLatencyMode = _a.lowLatencyMode, manualBitrate = _a.manualBitrate, maxAutoBitrate = _a.maxAutoBitrate, minAutoBitrate = _a.minAutoBitrate, playbackObserver = _a.playbackObserver, representationsRef = _a.representations;
    var scoreCalculator = new RepresentationScoreCalculator();
    var networkAnalyzer = new NetworkAnalyzer(initialBitrate !== null && initialBitrate !== void 0 ? initialBitrate : 0, lowLatencyMode);
    var requestsStore = new PendingRequestsStore();
    var onAddedSegment = noop;
    var callbacks = {
        metrics: onMetric,
        requestBegin: onRequestBegin,
        requestProgress: onRequestProgress,
        requestEnd: onRequestEnd,
        addedSegment: function (val) { onAddedSegment(val); },
    };
    /**
     * `TaskCanceller` allowing to stop producing estimate.
     * This TaskCanceller is used both for restarting estimates with a new
     * configuration and to cancel them altogether.
     */
    var currentEstimatesCanceller = new TaskCanceller({ cancelOn: stopAllEstimates });
    // Create `ISharedReference` on which estimates will be emitted.
    var estimateRef = createEstimateReference(manualBitrate.getValue(), representationsRef.getValue(), currentEstimatesCanceller.signal);
    manualBitrate.onUpdate(restartEstimatesProductionFromCurrentConditions, { clearSignal: stopAllEstimates });
    representationsRef.onUpdate(restartEstimatesProductionFromCurrentConditions, { clearSignal: stopAllEstimates });
    return { estimates: estimateRef, callbacks: callbacks };
    function createEstimateReference(manualBitrateVal, representations, innerCancellationSignal) {
        if (manualBitrateVal >= 0) {
            // A manual bitrate has been set. Just choose Representation according to it.
            var manualRepresentation = selectOptimalRepresentation(representations, manualBitrateVal, 0, Infinity);
            return createSharedReference({
                representation: manualRepresentation,
                bitrate: undefined,
                knownStableBitrate: undefined,
                manual: true,
                urgent: true, // a manual bitrate switch should happen immediately
            });
        }
        if (representations.length === 1) {
            // There's only a single Representation. Just choose it.
            return createSharedReference({ bitrate: undefined,
                representation: representations[0],
                manual: false,
                urgent: true,
                knownStableBitrate: undefined });
        }
        /** If true, Representation estimates based on the buffer health might be used. */
        var allowBufferBasedEstimates = false;
        /**
         * Current optimal Representation's bandwidth choosen by a buffer-based
         * adaptive algorithm.
         */
        var currentBufferBasedEstimate;
        var bitrates = representations.map(function (r) { return r.bitrate; });
        /**
         * Module calculating the optimal Representation based on the current
         * buffer's health (i.e. whether enough data is buffered, history of
         * buffer size etc.).
         */
        var bufferBasedChooser = new BufferBasedChooser(bitrates);
        /** Store the previous estimate made here. */
        var prevEstimate = new LastEstimateStorage();
        /**
         * Module calculating the optimal Representation by "guessing it" with a
         * step-by-step algorithm.
         * Only used in very specific scenarios.
         */
        var guessBasedChooser = new GuessBasedChooser(scoreCalculator, prevEstimate);
        // get initial observation for initial estimate
        var lastPlaybackObservation = playbackObserver.getReference().getValue();
        /** Reference through which estimates are emitted. */
        var innerEstimateRef = createSharedReference(getCurrentEstimate());
        // subscribe to subsequent playback observations
        playbackObserver.listen(function (obs) {
            lastPlaybackObservation = obs;
            updateEstimate();
        }, { includeLastObservation: false, clearSignal: innerCancellationSignal });
        onAddedSegment = function (val) {
            if (lastPlaybackObservation === null) {
                return;
            }
            var position = lastPlaybackObservation.position, speed = lastPlaybackObservation.speed;
            var timeRanges = val.buffered;
            var bufferGap = getLeftSizeOfRange(timeRanges, position.last);
            var representation = val.content.representation;
            var scoreData = scoreCalculator.getEstimate(representation);
            var currentScore = scoreData === null || scoreData === void 0 ? void 0 : scoreData[0];
            var currentBitrate = representation.bitrate;
            var observation = { bufferGap: bufferGap, currentBitrate: currentBitrate, currentScore: currentScore, speed: speed };
            currentBufferBasedEstimate = bufferBasedChooser.getEstimate(observation);
            updateEstimate();
        };
        minAutoBitrate.onUpdate(updateEstimate, { clearSignal: innerCancellationSignal });
        maxAutoBitrate.onUpdate(updateEstimate, { clearSignal: innerCancellationSignal });
        filters.limitWidth.onUpdate(updateEstimate, { clearSignal: innerCancellationSignal });
        filters.limitWidth.onUpdate(updateEstimate, { clearSignal: innerCancellationSignal });
        return innerEstimateRef;
        function updateEstimate() {
            innerEstimateRef.setValue(getCurrentEstimate());
        }
        /** Returns the actual estimate based on all methods and algorithm available. */
        function getCurrentEstimate() {
            var bufferGap = lastPlaybackObservation.bufferGap, position = lastPlaybackObservation.position, maximumPosition = lastPlaybackObservation.maximumPosition;
            var widthLimit = filters.limitWidth.getValue();
            var bitrateThrottle = filters.throttleBitrate.getValue();
            var currentRepresentationVal = currentRepresentation.getValue();
            var minAutoBitrateVal = minAutoBitrate.getValue();
            var maxAutoBitrateVal = maxAutoBitrate.getValue();
            var filteredReps = getFilteredRepresentations(representations, widthLimit, bitrateThrottle);
            var requests = requestsStore.getRequests();
            var _a = networkAnalyzer
                .getBandwidthEstimate(lastPlaybackObservation, bandwidthEstimator, currentRepresentationVal, requests, prevEstimate.bandwidth), bandwidthEstimate = _a.bandwidthEstimate, bitrateChosen = _a.bitrateChosen;
            var stableRepresentation = scoreCalculator.getLastStableRepresentation();
            var knownStableBitrate = stableRepresentation === null ?
                undefined :
                stableRepresentation.bitrate / (lastPlaybackObservation.speed > 0 ?
                    lastPlaybackObservation.speed :
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
            var chosenRepFromBandwidth = selectOptimalRepresentation(filteredReps, bitrateChosen, minAutoBitrateVal, maxAutoBitrateVal);
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
                currentBufferBasedEstimate !== undefined &&
                currentBufferBasedEstimate > currentBestBitrate) {
                chosenRepFromBufferSize = selectOptimalRepresentation(filteredReps, currentBufferBasedEstimate, minAutoBitrateVal, maxAutoBitrateVal);
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
                currentRepresentationVal !== null &&
                context.manifest.isDynamic &&
                maximumPosition - position.last < 40) {
                chosenRepFromGuessMode = guessBasedChooser
                    .getGuess(representations, lastPlaybackObservation, currentRepresentationVal, currentBestBitrate, requests);
            }
            if (chosenRepFromGuessMode !== null &&
                chosenRepFromGuessMode.bitrate > currentBestBitrate) {
                log.debug("ABR: Choosing representation with guess-based estimation.", chosenRepFromGuessMode.bitrate, chosenRepFromGuessMode.id);
                prevEstimate.update(chosenRepFromGuessMode, bandwidthEstimate, 2 /* ABRAlgorithmType.GuessBased */);
                return { bitrate: bandwidthEstimate,
                    representation: chosenRepFromGuessMode,
                    urgent: currentRepresentationVal === null ||
                        chosenRepFromGuessMode.bitrate < currentRepresentationVal.bitrate,
                    manual: false, knownStableBitrate: knownStableBitrate };
            }
            else if (chosenRepFromBufferSize !== null) {
                log.debug("ABR: Choosing representation with buffer-based estimation.", chosenRepFromBufferSize.bitrate, chosenRepFromBufferSize.id);
                prevEstimate.update(chosenRepFromBufferSize, bandwidthEstimate, 0 /* ABRAlgorithmType.BufferBased */);
                return { bitrate: bandwidthEstimate,
                    representation: chosenRepFromBufferSize,
                    urgent: networkAnalyzer.isUrgent(chosenRepFromBufferSize.bitrate, currentRepresentationVal, requests, lastPlaybackObservation),
                    manual: false, knownStableBitrate: knownStableBitrate };
            }
            else {
                log.debug("ABR: Choosing representation with bandwidth estimation.", chosenRepFromBandwidth.bitrate, chosenRepFromBandwidth.id);
                prevEstimate.update(chosenRepFromBandwidth, bandwidthEstimate, 1 /* ABRAlgorithmType.BandwidthBased */);
                return { bitrate: bandwidthEstimate,
                    representation: chosenRepFromBandwidth,
                    urgent: networkAnalyzer.isUrgent(chosenRepFromBandwidth.bitrate, currentRepresentationVal, requests, lastPlaybackObservation),
                    manual: false, knownStableBitrate: knownStableBitrate };
            }
        }
    }
    /**
     * Stop previous estimate production (if one) and restart it considering new
     * conditions (such as a manual bitrate and/or a new list of Representations).
     */
    function restartEstimatesProductionFromCurrentConditions() {
        var manualBitrateVal = manualBitrate.getValue();
        var representations = representationsRef.getValue();
        currentEstimatesCanceller.cancel();
        currentEstimatesCanceller = new TaskCanceller({ cancelOn: stopAllEstimates });
        var newRef = createEstimateReference(manualBitrateVal, representations, currentEstimatesCanceller.signal);
        newRef.onUpdate(function onNewEstimate(newEstimate) {
            estimateRef.setValue(newEstimate);
        }, { clearSignal: currentEstimatesCanceller.signal,
            emitCurrentValue: true });
    }
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
    /** Callback called when a new request begins. */
    function onRequestBegin(val) {
        requestsStore.add(val);
    }
    /** Callback called when progress information is known on a pending request. */
    function onRequestProgress(val) {
        requestsStore.addProgress(val);
    }
    /** Callback called when a pending request ends. */
    function onRequestEnd(val) {
        requestsStore.remove(val.id);
    }
}
/**
 * Filter representations given through filters options.
 * @param {Array.<Representation>} representations
 * @param {number | undefined} widthLimit - Filter Object.
 * @returns {Array.<Representation>}
 */
function getFilteredRepresentations(representations, widthLimit, bitrateThrottle) {
    var filteredReps = representations;
    if (bitrateThrottle < Infinity) {
        filteredReps = filterByBitrate(filteredReps, bitrateThrottle);
    }
    if (widthLimit !== undefined) {
        filteredReps = filterByWidth(filteredReps, widthLimit);
    }
    return filteredReps;
}
