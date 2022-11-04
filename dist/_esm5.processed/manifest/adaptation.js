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
import arrayFind from "../utils/array_find";
import isNullOrUndefined from "../utils/is_null_or_undefined";
import normalizeLanguage from "../utils/languages";
import uniq from "../utils/uniq";
import Representation from "./representation";
/** List in an array every possible value for the Adaptation's `type` property. */
export var SUPPORTED_ADAPTATIONS_TYPE = ["audio",
    "video",
    "text",
    "image"];
/**
 * Normalized Adaptation structure.
 * An Adaptation describes a single `Track`. For example a specific audio
 * track (in a given language) or a specific video track.
 * It istelf can be represented in different qualities, which we call here
 * `Representation`.
 * @class Adaptation
 */
var Adaptation = /** @class */ (function () {
    /**
     * @constructor
     * @param {Object} parsedAdaptation
     * @param {Object|undefined} [options]
     */
    function Adaptation(parsedAdaptation, options) {
        if (options === void 0) { options = {}; }
        var trickModeTracks = parsedAdaptation.trickModeTracks;
        var representationFilter = options.representationFilter, isManuallyAdded = options.isManuallyAdded;
        this.id = parsedAdaptation.id;
        this.type = parsedAdaptation.type;
        if (parsedAdaptation.isTrickModeTrack !== undefined) {
            this.isTrickModeTrack = parsedAdaptation.isTrickModeTrack;
        }
        if (parsedAdaptation.language !== undefined) {
            this.language = parsedAdaptation.language;
            this.normalizedLanguage = normalizeLanguage(parsedAdaptation.language);
        }
        if (parsedAdaptation.closedCaption !== undefined) {
            this.isClosedCaption = parsedAdaptation.closedCaption;
        }
        if (parsedAdaptation.audioDescription !== undefined) {
            this.isAudioDescription = parsedAdaptation.audioDescription;
        }
        if (parsedAdaptation.isDub !== undefined) {
            this.isDub = parsedAdaptation.isDub;
        }
        if (parsedAdaptation.isSignInterpreted !== undefined) {
            this.isSignInterpreted = parsedAdaptation.isSignInterpreted;
        }
        if (parsedAdaptation.label !== undefined) {
            this.label = parsedAdaptation.label;
        }
        if (trickModeTracks !== undefined &&
            trickModeTracks.length > 0) {
            this.trickModeTracks = trickModeTracks.map(function (track) { return new Adaptation(track); });
        }
        var argsRepresentations = parsedAdaptation.representations;
        var representations = [];
        var isSupported = false;
        for (var i = 0; i < argsRepresentations.length; i++) {
            var representation = new Representation(argsRepresentations[i], { type: this.type });
            var shouldAdd = isNullOrUndefined(representationFilter) ||
                representationFilter(representation, { bufferType: this.type,
                    language: this.language,
                    normalizedLanguage: this.normalizedLanguage,
                    isClosedCaption: this.isClosedCaption,
                    isDub: this.isDub,
                    isAudioDescription: this.isAudioDescription,
                    isSignInterpreted: this.isSignInterpreted });
            if (shouldAdd) {
                representations.push(representation);
                if (!isSupported && representation.isSupported) {
                    isSupported = true;
                }
            }
        }
        representations.sort(function (a, b) { return a.bitrate - b.bitrate; });
        this.representations = representations;
        this.isSupported = isSupported;
        // for manuallyAdded adaptations (not in the manifest)
        this.manuallyAdded = isManuallyAdded === true;
    }
    /**
     * Returns unique bitrate for every Representation in this Adaptation.
     * @returns {Array.<Number>}
     */
    Adaptation.prototype.getAvailableBitrates = function () {
        var bitrates = [];
        for (var i = 0; i < this.representations.length; i++) {
            var representation = this.representations[i];
            if (representation.decipherable !== false) {
                bitrates.push(representation.bitrate);
            }
        }
        return uniq(bitrates);
    };
    /**
     * Returns all Representation in this Adaptation that can be played (that is:
     * not undecipherable and with a supported codec).
     * @returns {Array.<Representation>}
     */
    Adaptation.prototype.getPlayableRepresentations = function () {
        return this.representations.filter(function (rep) {
            return rep.isSupported && rep.decipherable !== false;
        });
    };
    /**
     * Returns the Representation linked to the given ID.
     * @param {number|string} wantedId
     * @returns {Object|undefined}
     */
    Adaptation.prototype.getRepresentation = function (wantedId) {
        return arrayFind(this.representations, function (_a) {
            var id = _a.id;
            return wantedId === id;
        });
    };
    return Adaptation;
}());
export default Adaptation;
