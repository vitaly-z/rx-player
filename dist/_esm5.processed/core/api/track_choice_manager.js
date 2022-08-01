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
import arrayFind from "../../utils/array_find";
import arrayIncludes from "../../utils/array_includes";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import normalizeLanguage from "../../utils/languages";
import SortedList from "../../utils/sorted_list";
import takeFirstSet from "../../utils/take_first_set";
/**
 * Transform an array of IAudioTrackPreference into an array of
 * INormalizedPreferredAudioTrack to be exploited by the TrackChoiceManager.
 * @param {Array.<Object|null>} tracks
 * @returns {Array.<Object|null>}
 */
function normalizeAudioTracks(tracks) {
    return tracks.map(function (t) { return t === null ?
        t :
        { normalized: t.language === undefined ? undefined :
                normalizeLanguage(t.language),
            audioDescription: t.audioDescription,
            codec: t.codec }; });
}
/**
 * Transform an array of ITextTrackPreference into an array of
 * INormalizedPreferredTextTrack to be exploited by the TrackChoiceManager.
 * @param {Array.<Object|null>} tracks
 * @returns {Array.<Object|null>}
 */
function normalizeTextTracks(tracks) {
    return tracks.map(function (t) { return t === null ?
        t :
        { normalized: normalizeLanguage(t.language),
            closedCaption: t.closedCaption }; });
}
/**
 * Manage audio and text tracks for all active periods.
 * Choose the audio and text tracks for each period and record this choice.
 * @class TrackChoiceManager
 */
var TrackChoiceManager = /** @class */ (function () {
    function TrackChoiceManager(args) {
        this._periods = new SortedList(function (a, b) { return a.period.start - b.period.start; });
        this._audioChoiceMemory = new WeakMap();
        this._textChoiceMemory = new WeakMap();
        this._videoChoiceMemory = new WeakMap();
        this._preferredAudioTracks = [];
        this._preferredTextTracks = [];
        this._preferredVideoTracks = [];
        this.trickModeTrackEnabled = args.preferTrickModeTracks;
    }
    /**
     * Set the list of preferred audio tracks, in preference order.
     * @param {Array.<Object>} preferredAudioTracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Period. `false` if it should only
     * be applied to new content.
     */
    TrackChoiceManager.prototype.setPreferredAudioTracks = function (preferredAudioTracks, shouldApply) {
        this._preferredAudioTracks = preferredAudioTracks;
        if (shouldApply) {
            this._applyAudioPreferences();
        }
    };
    /**
     * Set the list of preferred text tracks, in preference order.
     * @param {Array.<Object>} preferredTextTracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Periods. `false` if it should only
     * be applied to new content.
     */
    TrackChoiceManager.prototype.setPreferredTextTracks = function (preferredTextTracks, shouldApply) {
        this._preferredTextTracks = preferredTextTracks;
        if (shouldApply) {
            this._applyTextPreferences();
        }
    };
    /**
     * Set the list of preferred text tracks, in preference order.
     * @param {Array.<Object>} preferredVideoTracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Period. `false` if it should only
     * be applied to new content.
     */
    TrackChoiceManager.prototype.setPreferredVideoTracks = function (preferredVideoTracks, shouldApply) {
        this._preferredVideoTracks = preferredVideoTracks;
        if (shouldApply) {
            this._applyVideoPreferences();
        }
    };
    /**
     * Add Subject to choose Adaptation for new "audio" or "text" Period.
     * @param {string} bufferType - The concerned buffer type
     * @param {Period} period - The concerned Period.
     * @param {Subject.<Object|null>} adaptation$ - A subject through which the
     * choice will be given
     */
    TrackChoiceManager.prototype.addPeriod = function (bufferType, period, adaptation$) {
        var _a;
        var periodItem = getPeriodItem(this._periods, period);
        var adaptations = period.getSupportedAdaptations(bufferType);
        if (periodItem !== undefined) {
            if (periodItem[bufferType] !== undefined) {
                log.warn("TrackChoiceManager: ".concat(bufferType, " already added for period"), period.start);
                return;
            }
            else {
                periodItem[bufferType] = { adaptations: adaptations, adaptation$: adaptation$ };
            }
        }
        else {
            this._periods.add((_a = { period: period }, _a[bufferType] = { adaptations: adaptations, adaptation$: adaptation$ }, _a));
        }
    };
    /**
     * Remove Subject to choose an "audio", "video" or "text" Adaptation for a
     * Period.
     * @param {string} bufferType - The concerned buffer type
     * @param {Period} period - The concerned Period.
     */
    TrackChoiceManager.prototype.removePeriod = function (bufferType, period) {
        var periodIndex = findPeriodIndex(this._periods, period);
        if (periodIndex === undefined) {
            log.warn("TrackChoiceManager: ".concat(bufferType, " not found for period"), period.start);
            return;
        }
        var periodItem = this._periods.get(periodIndex);
        if (periodItem[bufferType] === undefined) {
            log.warn("TrackChoiceManager: ".concat(bufferType, " already removed for period"), period.start);
            return;
        }
        delete periodItem[bufferType];
        if (periodItem.audio === undefined &&
            periodItem.text === undefined &&
            periodItem.video === undefined) {
            this._periods.removeElement(periodItem);
        }
    };
    TrackChoiceManager.prototype.resetPeriods = function () {
        while (this._periods.length() > 0) {
            this._periods.pop();
        }
    };
    /**
     * Update the choice of all added Periods based on:
     *   1. What was the last chosen adaptation
     *   2. If not found, the preferences
     */
    TrackChoiceManager.prototype.update = function () {
        this._resetChosenAudioTracks();
        this._resetChosenTextTracks();
        this._resetChosenVideoTracks();
    };
    /**
     * Emit initial audio Adaptation through the given Subject based on:
     *   - the preferred audio tracks
     *   - the last choice for this period, if one
     * @param {Period} period - The concerned Period.
     */
    TrackChoiceManager.prototype.setInitialAudioTrack = function (period) {
        var periodItem = getPeriodItem(this._periods, period);
        var audioInfos = periodItem !== undefined ? periodItem.audio :
            null;
        if (isNullOrUndefined(audioInfos) || periodItem === undefined) {
            throw new Error("TrackChoiceManager: Given Period not found.");
        }
        var audioAdaptations = period.getSupportedAdaptations("audio");
        var chosenAudioAdaptation = this._audioChoiceMemory.get(period);
        if (chosenAudioAdaptation === null) {
            // If the Period was previously without audio, keep it that way
            audioInfos.adaptation$.next(null);
        }
        else if (chosenAudioAdaptation === undefined ||
            !arrayIncludes(audioAdaptations, chosenAudioAdaptation)) {
            // Find the optimal audio Adaptation
            var preferredAudioTracks = this._preferredAudioTracks;
            var normalizedPref = normalizeAudioTracks(preferredAudioTracks);
            var optimalAdaptation = findFirstOptimalAudioAdaptation(audioAdaptations, normalizedPref);
            this._audioChoiceMemory.set(period, optimalAdaptation);
            audioInfos.adaptation$.next(optimalAdaptation);
        }
        else {
            audioInfos.adaptation$.next(chosenAudioAdaptation); // set last one
        }
    };
    /**
     * Emit initial text Adaptation through the given Subject based on:
     *   - the preferred text tracks
     *   - the last choice for this period, if one
     * @param {Period} period - The concerned Period.
     */
    TrackChoiceManager.prototype.setInitialTextTrack = function (period) {
        var periodItem = getPeriodItem(this._periods, period);
        var textInfos = periodItem !== undefined ? periodItem.text :
            null;
        if (isNullOrUndefined(textInfos) || periodItem === undefined) {
            throw new Error("TrackChoiceManager: Given Period not found.");
        }
        var textAdaptations = period.getSupportedAdaptations("text");
        var chosenTextAdaptation = this._textChoiceMemory.get(period);
        if (chosenTextAdaptation === null) {
            // If the Period was previously without text, keep it that way
            textInfos.adaptation$.next(null);
        }
        else if (chosenTextAdaptation === undefined ||
            !arrayIncludes(textAdaptations, chosenTextAdaptation)) {
            // Find the optimal text Adaptation
            var preferredTextTracks = this._preferredTextTracks;
            var normalizedPref = normalizeTextTracks(preferredTextTracks);
            var optimalAdaptation = findFirstOptimalTextAdaptation(textAdaptations, normalizedPref);
            this._textChoiceMemory.set(period, optimalAdaptation);
            textInfos.adaptation$.next(optimalAdaptation);
        }
        else {
            textInfos.adaptation$.next(chosenTextAdaptation); // set last one
        }
    };
    /**
     * Emit initial video Adaptation through the given Subject based on:
     *   - the preferred video tracks
     *   - the last choice for this period, if one
     * @param {Period} period - The concerned Period.
     */
    TrackChoiceManager.prototype.setInitialVideoTrack = function (period) {
        var periodItem = getPeriodItem(this._periods, period);
        var videoInfos = periodItem !== undefined ? periodItem.video :
            null;
        if (isNullOrUndefined(videoInfos) || periodItem === undefined) {
            throw new Error("TrackChoiceManager: Given Period not found.");
        }
        var videoAdaptations = period.getSupportedAdaptations("video");
        var prevVideoAdaptation = this._videoChoiceMemory.get(period);
        var newBaseAdaptation;
        if (prevVideoAdaptation === null) {
            newBaseAdaptation = null;
        }
        else if (prevVideoAdaptation !== undefined &&
            arrayIncludes(videoAdaptations, prevVideoAdaptation.baseAdaptation)) {
            // still exists, re-select it
            newBaseAdaptation = prevVideoAdaptation.baseAdaptation;
        }
        else {
            // If that Adaptation does not exist (e.g. no choice has been made or it
            // is not in the Manifest anymore), look at preferences
            var preferredVideoTracks = this._preferredVideoTracks;
            newBaseAdaptation = findFirstOptimalVideoAdaptation(videoAdaptations, preferredVideoTracks);
        }
        if (newBaseAdaptation === null) {
            this._videoChoiceMemory.set(period, null);
            videoInfos.adaptation$.next(null);
            return;
        }
        var newVideoAdaptation = getRightVideoTrack(newBaseAdaptation, this.trickModeTrackEnabled);
        this._videoChoiceMemory.set(period, { baseAdaptation: newBaseAdaptation,
            adaptation: newVideoAdaptation });
        videoInfos.adaptation$.next(newVideoAdaptation);
    };
    /**
     * Set audio track based on the ID of its adaptation for a given added Period.
     * @param {Period} period - The concerned Period.
     * @param {string} wantedId - adaptation id of the wanted track
     */
    TrackChoiceManager.prototype.setAudioTrackByID = function (period, wantedId) {
        var periodItem = getPeriodItem(this._periods, period);
        var audioInfos = periodItem !== undefined ? periodItem.audio :
            null;
        if (isNullOrUndefined(audioInfos)) {
            throw new Error("TrackChoiceManager: Given Period not found.");
        }
        var wantedAdaptation = arrayFind(audioInfos.adaptations, function (_a) {
            var id = _a.id;
            return id === wantedId;
        });
        if (wantedAdaptation === undefined) {
            throw new Error("Audio Track not found.");
        }
        var chosenAudioAdaptation = this._audioChoiceMemory.get(period);
        if (chosenAudioAdaptation === wantedAdaptation) {
            return;
        }
        this._audioChoiceMemory.set(period, wantedAdaptation);
        audioInfos.adaptation$.next(wantedAdaptation);
    };
    /**
     * Set text track based on the ID of its adaptation for a given added Period.
     * @param {Period} period - The concerned Period.
     * @param {string} wantedId - adaptation id of the wanted track
     */
    TrackChoiceManager.prototype.setTextTrackByID = function (period, wantedId) {
        var periodItem = getPeriodItem(this._periods, period);
        var textInfos = periodItem !== undefined ? periodItem.text :
            null;
        if (isNullOrUndefined(textInfos)) {
            throw new Error("TrackChoiceManager: Given Period not found.");
        }
        var wantedAdaptation = arrayFind(textInfos.adaptations, function (_a) {
            var id = _a.id;
            return id === wantedId;
        });
        if (wantedAdaptation === undefined) {
            throw new Error("Text Track not found.");
        }
        var chosenTextAdaptation = this._textChoiceMemory.get(period);
        if (chosenTextAdaptation === wantedAdaptation) {
            return;
        }
        this._textChoiceMemory.set(period, wantedAdaptation);
        textInfos.adaptation$.next(wantedAdaptation);
    };
    /**
     * Set video track based on the ID of its adaptation for a given added Period.
     * @param {Period} period - The concerned Period.
     * @param {string} wantedId - adaptation id of the wanted track
     *
     * @throws Error - Throws if the period given has not been added
     * @throws Error - Throws if the given id is not found in any video adaptation
     * of the given Period.
     */
    TrackChoiceManager.prototype.setVideoTrackByID = function (period, wantedId) {
        var periodItem = getPeriodItem(this._periods, period);
        var videoInfos = periodItem !== undefined ? periodItem.video :
            null;
        if (isNullOrUndefined(videoInfos)) {
            throw new Error("LanguageManager: Given Period not found.");
        }
        var wantedBaseAdaptation = arrayFind(videoInfos.adaptations, function (_a) {
            var id = _a.id;
            return id === wantedId;
        });
        if (wantedBaseAdaptation === undefined) {
            throw new Error("Video Track not found.");
        }
        var newVideoAdaptation = getRightVideoTrack(wantedBaseAdaptation, this.trickModeTrackEnabled);
        this._videoChoiceMemory.set(period, { baseAdaptation: wantedBaseAdaptation,
            adaptation: newVideoAdaptation });
        videoInfos.adaptation$.next(newVideoAdaptation);
    };
    /**
     * Disable the current text track for a given period.
     *
     * @param {Period} period - The concerned Period.
     *
     * @throws Error - Throws if the period given has not been added
     */
    TrackChoiceManager.prototype.disableTextTrack = function (period) {
        var periodItem = getPeriodItem(this._periods, period);
        var textInfos = periodItem !== undefined ? periodItem.text :
            null;
        if (isNullOrUndefined(textInfos)) {
            throw new Error("TrackChoiceManager: Given Period not found.");
        }
        var chosenTextAdaptation = this._textChoiceMemory.get(period);
        if (chosenTextAdaptation === null) {
            return;
        }
        this._textChoiceMemory.set(period, null);
        textInfos.adaptation$.next(null);
    };
    /**
     * Disable the current video track for a given period.
     * @param {Object} period
     * @throws Error - Throws if the period given has not been added
     */
    TrackChoiceManager.prototype.disableVideoTrack = function (period) {
        var periodItem = getPeriodItem(this._periods, period);
        var videoInfos = periodItem === null || periodItem === void 0 ? void 0 : periodItem.video;
        if (videoInfos === undefined) {
            throw new Error("TrackManager: Given Period not found.");
        }
        var chosenVideoAdaptation = this._videoChoiceMemory.get(period);
        if (chosenVideoAdaptation === null) {
            return;
        }
        this._videoChoiceMemory.set(period, null);
        videoInfos.adaptation$.next(null);
    };
    TrackChoiceManager.prototype.disableVideoTrickModeTracks = function () {
        this.trickModeTrackEnabled = false;
        this._resetChosenVideoTracks();
    };
    TrackChoiceManager.prototype.enableVideoTrickModeTracks = function () {
        this.trickModeTrackEnabled = true;
        this._resetChosenVideoTracks();
    };
    /**
     * @returns {boolean}
     */
    TrackChoiceManager.prototype.isTrickModeEnabled = function () {
        return this.trickModeTrackEnabled;
    };
    /**
     * Returns an object describing the chosen audio track for the given audio
     * Period.
     *
     * Returns null is the the current audio track is disabled or not
     * set yet.
     *
     * @param {Period} period - The concerned Period.
     * @returns {Object|null} - The audio track chosen for this Period
     */
    TrackChoiceManager.prototype.getChosenAudioTrack = function (period) {
        var periodItem = getPeriodItem(this._periods, period);
        var audioInfos = periodItem !== undefined ? periodItem.audio :
            null;
        if (isNullOrUndefined(audioInfos)) {
            return null;
        }
        var chosenTrack = this._audioChoiceMemory.get(period);
        if (isNullOrUndefined(chosenTrack)) {
            return null;
        }
        var audioTrack = {
            language: takeFirstSet(chosenTrack.language, ""),
            normalized: takeFirstSet(chosenTrack.normalizedLanguage, ""),
            audioDescription: chosenTrack.isAudioDescription === true,
            id: chosenTrack.id,
            representations: chosenTrack.representations.map(parseAudioRepresentation),
            label: chosenTrack.label,
        };
        if (chosenTrack.isDub === true) {
            audioTrack.dub = true;
        }
        return audioTrack;
    };
    /**
     * Returns an object describing the chosen text track for the given text
     * Period.
     *
     * Returns null is the the current text track is disabled or not
     * set yet.
     *
     * @param {Period} period - The concerned Period.
     * @returns {Object|null} - The text track chosen for this Period
     */
    TrackChoiceManager.prototype.getChosenTextTrack = function (period) {
        var periodItem = getPeriodItem(this._periods, period);
        var textInfos = periodItem !== undefined ? periodItem.text :
            null;
        if (isNullOrUndefined(textInfos)) {
            return null;
        }
        var chosenTextAdaptation = this._textChoiceMemory.get(period);
        if (isNullOrUndefined(chosenTextAdaptation)) {
            return null;
        }
        return {
            language: takeFirstSet(chosenTextAdaptation.language, ""),
            normalized: takeFirstSet(chosenTextAdaptation.normalizedLanguage, ""),
            closedCaption: chosenTextAdaptation.isClosedCaption === true,
            id: chosenTextAdaptation.id,
            label: chosenTextAdaptation.label,
        };
    };
    /**
     * Returns an object describing the chosen video track for the given video
     * Period.
     *
     * Returns null is the the current video track is disabled or not
     * set yet.
     *
     * @param {Period} period - The concerned Period.
     * @returns {Object|null} - The video track chosen for this Period
     */
    TrackChoiceManager.prototype.getChosenVideoTrack = function (period) {
        var periodItem = getPeriodItem(this._periods, period);
        var videoInfos = periodItem !== undefined ? periodItem.video :
            null;
        if (isNullOrUndefined(videoInfos)) {
            return null;
        }
        var chosenVideoAdaptation = this._videoChoiceMemory.get(period);
        if (isNullOrUndefined(chosenVideoAdaptation)) {
            return null;
        }
        var currAdaptation = chosenVideoAdaptation.adaptation;
        var trickModeTracks = currAdaptation.trickModeTracks !== undefined ?
            currAdaptation.trickModeTracks.map(function (trickModeAdaptation) {
                var representations = trickModeAdaptation.representations
                    .map(parseVideoRepresentation);
                var trickMode = { id: trickModeAdaptation.id, representations: representations, isTrickModeTrack: true };
                if (trickModeAdaptation.isSignInterpreted === true) {
                    trickMode.signInterpreted = true;
                }
                return trickMode;
            }) :
            undefined;
        var videoTrack = {
            id: currAdaptation.id,
            representations: currAdaptation.representations.map(parseVideoRepresentation),
            label: currAdaptation.label,
        };
        if (currAdaptation.isSignInterpreted === true) {
            videoTrack.signInterpreted = true;
        }
        if (currAdaptation.isTrickModeTrack === true) {
            videoTrack.isTrickModeTrack = true;
        }
        if (trickModeTracks !== undefined) {
            videoTrack.trickModeTracks = trickModeTracks;
        }
        return videoTrack;
    };
    /**
     * Returns all available audio tracks for a given Period, as an array of
     * objects.
     *
     * @returns {Array.<Object>}
     */
    TrackChoiceManager.prototype.getAvailableAudioTracks = function (period) {
        var periodItem = getPeriodItem(this._periods, period);
        var audioInfos = periodItem !== undefined ? periodItem.audio :
            null;
        if (isNullOrUndefined(audioInfos)) {
            return [];
        }
        var chosenAudioAdaptation = this._audioChoiceMemory.get(period);
        var currentId = !isNullOrUndefined(chosenAudioAdaptation) ?
            chosenAudioAdaptation.id :
            null;
        return audioInfos.adaptations
            .map(function (adaptation) {
            var formatted = {
                language: takeFirstSet(adaptation.language, ""),
                normalized: takeFirstSet(adaptation.normalizedLanguage, ""),
                audioDescription: adaptation.isAudioDescription === true,
                id: adaptation.id,
                active: currentId === null ? false :
                    currentId === adaptation.id,
                representations: adaptation.representations.map(parseAudioRepresentation),
                label: adaptation.label,
            };
            if (adaptation.isDub === true) {
                formatted.dub = true;
            }
            return formatted;
        });
    };
    /**
     * Returns all available text tracks for a given Period, as an array of
     * objects.
     *
     * @param {Period} period
     * @returns {Array.<Object>}
     */
    TrackChoiceManager.prototype.getAvailableTextTracks = function (period) {
        var periodItem = getPeriodItem(this._periods, period);
        var textInfos = periodItem !== undefined ? periodItem.text :
            null;
        if (isNullOrUndefined(textInfos)) {
            return [];
        }
        var chosenTextAdaptation = this._textChoiceMemory.get(period);
        var currentId = !isNullOrUndefined(chosenTextAdaptation) ?
            chosenTextAdaptation.id :
            null;
        return textInfos.adaptations
            .map(function (adaptation) { return ({
            language: takeFirstSet(adaptation.language, ""),
            normalized: takeFirstSet(adaptation.normalizedLanguage, ""),
            closedCaption: adaptation.isClosedCaption === true,
            id: adaptation.id,
            active: currentId === null ? false :
                currentId === adaptation.id,
            label: adaptation.label,
        }); });
    };
    /**
     * Returns all available video tracks for a given Period, as an array of
     * objects.
     *
     * @returns {Array.<Object>}
     */
    TrackChoiceManager.prototype.getAvailableVideoTracks = function (period) {
        var _a;
        var periodItem = getPeriodItem(this._periods, period);
        var videoInfos = periodItem !== undefined ? periodItem.video :
            null;
        if (isNullOrUndefined(videoInfos)) {
            return [];
        }
        var chosenVideoAdaptation = this._videoChoiceMemory.get(period);
        var currentId = chosenVideoAdaptation === undefined ?
            undefined :
            (_a = chosenVideoAdaptation === null || chosenVideoAdaptation === void 0 ? void 0 : chosenVideoAdaptation.adaptation.id) !== null && _a !== void 0 ? _a : undefined;
        return videoInfos.adaptations
            .map(function (adaptation) {
            var trickModeTracks = adaptation.trickModeTracks !== undefined ?
                adaptation.trickModeTracks.map(function (trickModeAdaptation) {
                    var isActive = currentId === null ? false :
                        currentId === trickModeAdaptation.id;
                    var representations = trickModeAdaptation.representations
                        .map(parseVideoRepresentation);
                    var trickMode = { id: trickModeAdaptation.id, representations: representations, isTrickModeTrack: true,
                        active: isActive };
                    if (trickModeAdaptation.isSignInterpreted === true) {
                        trickMode.signInterpreted = true;
                    }
                    return trickMode;
                }) :
                undefined;
            var formatted = {
                id: adaptation.id,
                active: currentId === null ? false :
                    currentId === adaptation.id,
                representations: adaptation.representations.map(parseVideoRepresentation),
                label: adaptation.label,
            };
            if (adaptation.isSignInterpreted === true) {
                formatted.signInterpreted = true;
            }
            if (trickModeTracks !== undefined) {
                formatted.trickModeTracks = trickModeTracks;
            }
            return formatted;
        });
    };
    /**
     * Reset all audio tracks choices to corresponds to the current preferences.
     */
    TrackChoiceManager.prototype._applyAudioPreferences = function () {
        // Remove all memorized choices and start over
        this._audioChoiceMemory = new WeakMap();
        this._resetChosenAudioTracks();
    };
    /**
     * Reset all text tracks choices to corresponds to the current preferences.
     */
    TrackChoiceManager.prototype._applyTextPreferences = function () {
        // Remove all memorized choices and start over
        this._textChoiceMemory = new WeakMap();
        this._resetChosenTextTracks();
    };
    /**
     * Reset all video tracks choices to corresponds to the current preferences.
     */
    TrackChoiceManager.prototype._applyVideoPreferences = function () {
        // Remove all memorized choices and start over
        this._videoChoiceMemory = new WeakMap();
        this._resetChosenVideoTracks();
    };
    /**
     * Choose again the best audio tracks for all current Periods.
     * This is based on two things:
     *   1. what was the track previously chosen for that Period (by checking
     *      `this._audioChoiceMemory`).
     *   2. If no track were previously chosen or if it is not available anymore
     *      we check the audio preferences.
     */
    TrackChoiceManager.prototype._resetChosenAudioTracks = function () {
        var _this = this;
        var preferredAudioTracks = this._preferredAudioTracks;
        var normalizedPref = normalizeAudioTracks(preferredAudioTracks);
        var recursiveUpdateAudioTrack = function (index) {
            if (index >= _this._periods.length()) {
                // we did all audio Periods, exit
                return;
            }
            var periodItem = _this._periods.get(index);
            if (isNullOrUndefined(periodItem.audio)) {
                // No audio choice for this period, check next one
                recursiveUpdateAudioTrack(index + 1);
                return;
            }
            var period = periodItem.period, audioItem = periodItem.audio;
            var audioAdaptations = period.getSupportedAdaptations("audio");
            var chosenAudioAdaptation = _this._audioChoiceMemory.get(period);
            if (chosenAudioAdaptation === null ||
                (chosenAudioAdaptation !== undefined &&
                    arrayIncludes(audioAdaptations, chosenAudioAdaptation))) {
                // Already best audio for this Period, check next one
                recursiveUpdateAudioTrack(index + 1);
                return;
            }
            var optimalAdaptation = findFirstOptimalAudioAdaptation(audioAdaptations, normalizedPref);
            _this._audioChoiceMemory.set(period, optimalAdaptation);
            audioItem.adaptation$.next(optimalAdaptation);
            // previous "next" call could have changed everything, start over
            recursiveUpdateAudioTrack(0);
        };
        recursiveUpdateAudioTrack(0);
    };
    /**
     * Choose again the best text tracks for all current Periods.
     * This is based on two things:
     *   1. what was the track previously chosen for that Period (by checking
     *      `this._textChoiceMemory`).
     *   2. If no track were previously chosen or if it is not available anymore
     *      we check the text preferences.
     */
    TrackChoiceManager.prototype._resetChosenTextTracks = function () {
        var _this = this;
        var preferredTextTracks = this._preferredTextTracks;
        var normalizedPref = normalizeTextTracks(preferredTextTracks);
        var recursiveUpdateTextTrack = function (index) {
            if (index >= _this._periods.length()) {
                // we did all text Periods, exit
                return;
            }
            var periodItem = _this._periods.get(index);
            if (isNullOrUndefined(periodItem.text)) {
                // No text choice for this period, check next one
                recursiveUpdateTextTrack(index + 1);
                return;
            }
            var period = periodItem.period, textItem = periodItem.text;
            var textAdaptations = period.getSupportedAdaptations("text");
            var chosenTextAdaptation = _this._textChoiceMemory.get(period);
            if (chosenTextAdaptation === null ||
                (chosenTextAdaptation !== undefined &&
                    arrayIncludes(textAdaptations, chosenTextAdaptation))) {
                // Already best text for this Period, check next one
                recursiveUpdateTextTrack(index + 1);
                return;
            }
            var optimalAdaptation = findFirstOptimalTextAdaptation(textAdaptations, normalizedPref);
            _this._textChoiceMemory.set(period, optimalAdaptation);
            textItem.adaptation$.next(optimalAdaptation);
            // previous "next" call could have changed everything, start over
            recursiveUpdateTextTrack(0);
        };
        recursiveUpdateTextTrack(0);
    };
    /**
     * Choose again the best video tracks for all current Periods.
     * This is based on two things:
     *   1. what was the track previously chosen for that Period (by checking
     *      `this._videoChoiceMemory`).
     *   2. If no track were previously chosen or if it is not available anymore
     *      we check the video preferences.
     */
    TrackChoiceManager.prototype._resetChosenVideoTracks = function () {
        var _this = this;
        var preferredVideoTracks = this._preferredVideoTracks;
        var recursiveUpdateVideoTrack = function (index) {
            if (index >= _this._periods.length()) {
                // we did all video Periods, exit
                return;
            }
            var periodItem = _this._periods.get(index);
            if (isNullOrUndefined(periodItem.video)) {
                // No video choice for this period, check next one
                recursiveUpdateVideoTrack(index + 1);
                return;
            }
            var period = periodItem.period, videoItem = periodItem.video;
            var videoAdaptations = period.getSupportedAdaptations("video");
            var chosenVideoAdaptation = _this._videoChoiceMemory.get(period);
            if (chosenVideoAdaptation === null) {
                // No video track for that one, so nothing to change.
                recursiveUpdateVideoTrack(index + 1);
                return;
            }
            else if (chosenVideoAdaptation !== undefined &&
                arrayIncludes(videoAdaptations, chosenVideoAdaptation.baseAdaptation)) {
                // The right Base Adaptation is selected and is still available.
                // Check if the selected Adaptation is still right
                var wantedVideoAdaptation = getRightVideoTrack(chosenVideoAdaptation.baseAdaptation, _this.trickModeTrackEnabled);
                if (wantedVideoAdaptation.id === chosenVideoAdaptation.adaptation.id) {
                    // We're good, continue.
                    recursiveUpdateVideoTrack(index + 1);
                    return;
                }
                else {
                    // select the right track
                    _this._videoChoiceMemory.set(period, {
                        baseAdaptation: chosenVideoAdaptation.baseAdaptation,
                        adaptation: wantedVideoAdaptation,
                    });
                    videoItem.adaptation$.next(wantedVideoAdaptation);
                    // previous "next" call could have changed everything, start over
                    return recursiveUpdateVideoTrack(0);
                }
            }
            var optimalAdaptation = findFirstOptimalVideoAdaptation(videoAdaptations, preferredVideoTracks);
            if (optimalAdaptation === null) {
                _this._videoChoiceMemory.set(period, null);
                videoItem.adaptation$.next(null);
                // previous "next" call could have changed everything, start over
                return recursiveUpdateVideoTrack(0);
            }
            var newVideoAdaptation = getRightVideoTrack(optimalAdaptation, _this.trickModeTrackEnabled);
            _this._videoChoiceMemory.set(period, { baseAdaptation: optimalAdaptation,
                adaptation: newVideoAdaptation });
            videoItem.adaptation$.next(newVideoAdaptation);
            // previous "next" call could have changed everything, start over
            return recursiveUpdateVideoTrack(0);
        };
        recursiveUpdateVideoTrack(0);
    };
    return TrackChoiceManager;
}());
export default TrackChoiceManager;
/**
 * Create a function allowing to compare audio Adaptations with a given
 * `preferredAudioTrack` preference to see if they match.
 *
 * This function is curried to be easily and optimally used in a loop context.
 *
 * @param {Object} preferredAudioTrack - The audio track preference you want to
 * compare audio Adaptations to.
 * @returns {Function} - Function taking in argument an audio Adaptation and
 * returning `true` if it matches the `preferredAudioTrack` preference (and
 * `false` otherwise.
 */
function createAudioPreferenceMatcher(preferredAudioTrack) {
    /**
     * Compares an audio Adaptation to the given `preferredAudioTrack` preference.
     * Returns `true` if it matches, false otherwise.
     * @param {Object} audioAdaptation
     * @returns {boolean}
     */
    return function matchAudioPreference(audioAdaptation) {
        var _a;
        if (preferredAudioTrack.normalized !== undefined) {
            var language = (_a = audioAdaptation.normalizedLanguage) !== null && _a !== void 0 ? _a : "";
            if (language !== preferredAudioTrack.normalized) {
                return false;
            }
        }
        if (preferredAudioTrack.audioDescription !== undefined) {
            if (preferredAudioTrack.audioDescription) {
                if (audioAdaptation.isAudioDescription !== true) {
                    return false;
                }
            }
            else if (audioAdaptation.isAudioDescription === true) {
                return false;
            }
        }
        if (preferredAudioTrack.codec === undefined) {
            return true;
        }
        var regxp = preferredAudioTrack.codec.test;
        var codecTestingFn = function (rep) {
            return rep.codec !== undefined && regxp.test(rep.codec);
        };
        if (preferredAudioTrack.codec.all) {
            return audioAdaptation.representations.every(codecTestingFn);
        }
        return audioAdaptation.representations.some(codecTestingFn);
    };
}
/**
 * Find an optimal audio adaptation given their list and the array of preferred
 * audio tracks sorted from the most preferred to the least preferred.
 *
 * `null` if the most optimal audio adaptation is no audio adaptation.
 * @param {Array.<Adaptation>} audioAdaptations
 * @param {Array.<Object|null>} preferredAudioTracks
 * @returns {Adaptation|null}
 */
function findFirstOptimalAudioAdaptation(audioAdaptations, preferredAudioTracks) {
    if (audioAdaptations.length === 0) {
        return null;
    }
    for (var i = 0; i < preferredAudioTracks.length; i++) {
        var preferredAudioTrack = preferredAudioTracks[i];
        if (preferredAudioTrack === null) {
            return null;
        }
        var matchPreferredAudio = createAudioPreferenceMatcher(preferredAudioTrack);
        var foundAdaptation = arrayFind(audioAdaptations, matchPreferredAudio);
        if (foundAdaptation !== undefined) {
            return foundAdaptation;
        }
    }
    // no optimal adaptation, just return the first one
    return audioAdaptations[0];
}
/**
 * Create a function allowing to compare text Adaptations with a given
 * `preferredTextTrack` preference to see if they match.
 *
 * This function is curried to be easily and optimally used in a loop context.
 *
 * @param {Object} preferredTextTrack - The text track preference you want to
 * compare text Adaptations to.
 * @returns {Function} - Function taking in argument a text Adaptation and
 * returning `true` if it matches the `preferredTextTrack` preference (and
 * `false` otherwise.
 */
function createTextPreferenceMatcher(preferredTextTrack) {
    /**
     * Compares a text Adaptation to the given `preferredTextTrack` preference.
     * Returns `true` if it matches, false otherwise.
     * @param {Object} textAdaptation
     * @returns {boolean}
     */
    return function matchTextPreference(textAdaptation) {
        return takeFirstSet(textAdaptation.normalizedLanguage, "") === preferredTextTrack.normalized &&
            (preferredTextTrack.closedCaption ? textAdaptation.isClosedCaption === true :
                textAdaptation.isClosedCaption !== true);
    };
}
/**
 * Find an optimal text adaptation given their list and the array of preferred
 * text tracks sorted from the most preferred to the least preferred.
 *
 * `null` if the most optimal text adaptation is no text adaptation.
 * @param {Array.<Object>} textAdaptations
 * @param {Array.<Object|null>} preferredTextTracks
 * @returns {Adaptation|null}
 */
function findFirstOptimalTextAdaptation(textAdaptations, preferredTextTracks) {
    if (textAdaptations.length === 0) {
        return null;
    }
    for (var i = 0; i < preferredTextTracks.length; i++) {
        var preferredTextTrack = preferredTextTracks[i];
        if (preferredTextTrack === null) {
            return null;
        }
        var matchPreferredText = createTextPreferenceMatcher(preferredTextTrack);
        var foundAdaptation = arrayFind(textAdaptations, matchPreferredText);
        if (foundAdaptation !== undefined) {
            return foundAdaptation;
        }
    }
    // no optimal adaptation
    return null;
}
/**
 * Create a function allowing to compare video Adaptations with a given
 * `preferredVideoTrack` preference to see if they match.
 *
 * This function is curried to be easily and optimally used in a loop context.
 *
 * @param {Object} preferredVideoTrack - The video track preference you want to
 * compare video Adaptations to.
 * @returns {Function} - Function taking in argument a video Adaptation and
 * returning `true` if it matches the `preferredVideoTrack` preference (and
 * `false` otherwise.
 */
function createVideoPreferenceMatcher(preferredVideoTrack) {
    /**
     * Compares a video Adaptation to the given `preferredVideoTrack` preference.
     * Returns `true` if it matches, false otherwise.
     * @param {Object} videoAdaptation
     * @returns {boolean}
     */
    return function matchVideoPreference(videoAdaptation) {
        if (preferredVideoTrack.signInterpreted !== undefined &&
            preferredVideoTrack.signInterpreted !== videoAdaptation.isSignInterpreted) {
            return false;
        }
        if (preferredVideoTrack.codec === undefined) {
            return true;
        }
        var regxp = preferredVideoTrack.codec.test;
        var codecTestingFn = function (rep) {
            return rep.codec !== undefined && regxp.test(rep.codec);
        };
        if (preferredVideoTrack.codec.all) {
            return videoAdaptation.representations.every(codecTestingFn);
        }
        return videoAdaptation.representations.some(codecTestingFn);
    };
}
/**
 * Find an optimal video adaptation given their list and the array of preferred
 * video tracks sorted from the most preferred to the least preferred.
 *
 * `null` if the most optimal video adaptation is no video adaptation.
 * @param {Array.<Adaptation>} videoAdaptations
 * @param {Array.<Object|null>} preferredVideoTracks
 * @returns {Adaptation|null}
 */
function findFirstOptimalVideoAdaptation(videoAdaptations, preferredVideoTracks) {
    if (videoAdaptations.length === 0) {
        return null;
    }
    for (var i = 0; i < preferredVideoTracks.length; i++) {
        var preferredVideoTrack = preferredVideoTracks[i];
        if (preferredVideoTrack === null) {
            return null;
        }
        var matchPreferredVideo = createVideoPreferenceMatcher(preferredVideoTrack);
        var foundAdaptation = arrayFind(videoAdaptations, matchPreferredVideo);
        if (foundAdaptation !== undefined) {
            return foundAdaptation;
        }
    }
    // no optimal adaptation, just return the first one
    return videoAdaptations[0];
}
/**
 * Returns the index of the given `period` in the given `periods`
 * SortedList.
 * Returns `undefined` if that `period` is not found.
 * @param {Object} periods
 * @param {Object} period
 * @returns {number|undefined}
 */
function findPeriodIndex(periods, period) {
    for (var i = 0; i < periods.length(); i++) {
        var periodI = periods.get(i);
        if (periodI.period.id === period.id) {
            return i;
        }
    }
}
/**
 * Returns element in the given `periods` SortedList that corresponds to the
 * `period` given.
 * Returns `undefined` if that `period` is not found.
 * @param {Object} periods
 * @param {Object} period
 * @returns {Object|undefined}
 */
function getPeriodItem(periods, period) {
    for (var i = 0; i < periods.length(); i++) {
        var periodI = periods.get(i);
        if (periodI.period.id === period.id) {
            return periodI;
        }
    }
}
/**
 * Parse video Representation into a IVideoRepresentation.
 * @param {Object} representation
 * @returns {Object}
 */
function parseVideoRepresentation(_a) {
    var id = _a.id, bitrate = _a.bitrate, frameRate = _a.frameRate, width = _a.width, height = _a.height, codec = _a.codec, hdrInfo = _a.hdrInfo;
    return { id: id, bitrate: bitrate, frameRate: frameRate, width: width, height: height, codec: codec, hdrInfo: hdrInfo };
}
/**
 * Parse audio Representation into a ITMAudioRepresentation.
 * @param {Object} representation
 * @returns {Object}
 */
function parseAudioRepresentation(_a) {
    var id = _a.id, bitrate = _a.bitrate, codec = _a.codec;
    return { id: id, bitrate: bitrate, codec: codec };
}
function getRightVideoTrack(adaptation, isTrickModeEnabled) {
    var _a;
    if (isTrickModeEnabled &&
        ((_a = adaptation.trickModeTracks) === null || _a === void 0 ? void 0 : _a[0]) !== undefined) {
        return adaptation.trickModeTracks[0];
    }
    return adaptation;
}
