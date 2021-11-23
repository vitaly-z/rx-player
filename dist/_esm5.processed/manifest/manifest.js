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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { MediaError, } from "../errors";
import areArraysOfNumbersEqual from "../utils/are_arrays_of_numbers_equal";
import arrayFind from "../utils/array_find";
import EventEmitter from "../utils/event_emitter";
import idGenerator from "../utils/id_generator";
import warnOnce from "../utils/warn_once";
import Adaptation from "./adaptation";
import Period from "./period";
import { StaticRepresentationIndex } from "./representation_index";
import { MANIFEST_UPDATE_TYPE, } from "./types";
import { replacePeriods, updatePeriods, } from "./update_periods";
var generateSupplementaryTrackID = idGenerator();
var generateNewManifestId = idGenerator();
/**
 * Normalized Manifest structure.
 *
 * Details the current content being played:
 *   - the duration of the content
 *   - the available tracks
 *   - the available qualities
 *   - the segments defined in those qualities
 *   - ...
 * while staying agnostic of the transport protocol used (Smooth, DASH etc.).
 *
 * The Manifest and its contained information can evolve over time (like when
 * updating a dynamic manifest or when right management forbid some tracks from
 * being played).
 * To perform actions on those changes, any module using this Manifest can
 * listen to its sent events and react accordingly.
 *
 * @class Manifest
 */
var Manifest = /** @class */ (function (_super) {
    __extends(Manifest, _super);
    /**
     * Construct a Manifest instance from a parsed Manifest object (as returned by
     * Manifest parsers) and options.
     *
     * Some minor errors can arise during that construction. `this.contentWarnings`
     * will contain all such errors, in the order they have been encountered.
     * @param {Object} parsedManifest
     * @param {Object} options
     */
    function Manifest(parsedManifest, options) {
        var _a;
        var _this = _super.call(this) || this;
        var _b = options.supplementaryTextTracks, supplementaryTextTracks = _b === void 0 ? [] : _b, _c = options.supplementaryImageTracks, supplementaryImageTracks = _c === void 0 ? [] : _c, representationFilter = options.representationFilter, manifestUpdateUrl = options.manifestUpdateUrl;
        _this.contentWarnings = [];
        _this.id = generateNewManifestId();
        _this.expired = (_a = parsedManifest.expired) !== null && _a !== void 0 ? _a : null;
        _this.transport = parsedManifest.transportType;
        _this.clockOffset = parsedManifest.clockOffset;
        _this.periods = parsedManifest.periods.map(function (parsedPeriod) {
            var _a;
            var period = new Period(parsedPeriod, representationFilter);
            (_a = _this.contentWarnings).push.apply(_a, period.contentWarnings);
            return period;
        }).sort(function (a, b) { return a.start - b.start; });
        /**
         * @deprecated It is here to ensure compatibility with the way the
         * v3.x.x manages adaptations at the Manifest level
         */
        /* eslint-disable import/no-deprecated */
        _this.adaptations = _this.periods[0] === undefined ? {} :
            _this.periods[0].adaptations;
        /* eslint-enable import/no-deprecated */
        _this._timeBounds = parsedManifest.timeBounds;
        _this.isDynamic = parsedManifest.isDynamic;
        _this.isLive = parsedManifest.isLive;
        _this.isLastPeriodKnown = parsedManifest.isLastPeriodKnown;
        _this.uris = parsedManifest.uris === undefined ? [] :
            parsedManifest.uris;
        _this.updateUrl = manifestUpdateUrl;
        _this.lifetime = parsedManifest.lifetime;
        _this.suggestedPresentationDelay = parsedManifest.suggestedPresentationDelay;
        _this.availabilityStartTime = parsedManifest.availabilityStartTime;
        _this.publishTime = parsedManifest.publishTime;
        if (supplementaryImageTracks.length > 0) {
            _this._addSupplementaryImageAdaptations(supplementaryImageTracks);
        }
        if (supplementaryTextTracks.length > 0) {
            _this._addSupplementaryTextAdaptations(supplementaryTextTracks);
        }
        return _this;
    }
    /**
     * Returns the Period corresponding to the given `id`.
     * Returns `undefined` if there is none.
     * @param {string} id
     * @returns {Object|undefined}
     */
    Manifest.prototype.getPeriod = function (id) {
        return arrayFind(this.periods, function (period) {
            return id === period.id;
        });
    };
    /**
     * Returns the Period encountered at the given time.
     * Returns `undefined` if there is no Period exactly at the given time.
     * @param {number} time
     * @returns {Object|undefined}
     */
    Manifest.prototype.getPeriodForTime = function (time) {
        return arrayFind(this.periods, function (period) {
            return time >= period.start &&
                (period.end === undefined || period.end > time);
        });
    };
    /**
     * Returns the first Period starting strictly after the given time.
     * Returns `undefined` if there is no Period starting after that time.
     * @param {number} time
     * @returns {Object|undefined}
     */
    Manifest.prototype.getNextPeriod = function (time) {
        return arrayFind(this.periods, function (period) {
            return period.start > time;
        });
    };
    /**
     * Returns the Period coming chronologically just after another given Period.
     * Returns `undefined` if not found.
     * @param {Object} period
     * @returns {Object|null}
     */
    Manifest.prototype.getPeriodAfter = function (period) {
        var endOfPeriod = period.end;
        if (endOfPeriod === undefined) {
            return null;
        }
        var nextPeriod = arrayFind(this.periods, function (_period) {
            return _period.end === undefined || endOfPeriod < _period.end;
        });
        return nextPeriod === undefined ? null :
            nextPeriod;
    };
    /**
     * Returns the most important URL from which the Manifest can be refreshed.
     * `undefined` if no URL is found.
     * @returns {string|undefined}
     */
    Manifest.prototype.getUrl = function () {
        return this.uris[0];
    };
    /**
     * Update the current Manifest properties by giving a new updated version.
     * This instance will be updated with the new information coming from it.
     * @param {Object} newManifest
     */
    Manifest.prototype.replace = function (newManifest) {
        this._performUpdate(newManifest, MANIFEST_UPDATE_TYPE.Full);
    };
    /**
     * Update the current Manifest properties by giving a new but shorter version
     * of it.
     * This instance will add the new information coming from it and will
     * automatically clean old Periods that shouldn't be available anymore.
     *
     * /!\ Throws if the given Manifest cannot be used or is not sufficient to
     * update the Manifest.
     * @param {Object} newManifest
     */
    Manifest.prototype.update = function (newManifest) {
        this._performUpdate(newManifest, MANIFEST_UPDATE_TYPE.Partial);
    };
    /**
     * Get the minimum position currently defined by the Manifest, in seconds.
     * @returns {number}
     */
    Manifest.prototype.getMinimumPosition = function () {
        var _a, _b;
        var windowData = this._timeBounds;
        if (windowData.timeshiftDepth === null) {
            return (_a = windowData.absoluteMinimumTime) !== null && _a !== void 0 ? _a : 0;
        }
        var maximumTimeData = windowData.maximumTimeData;
        var maximumTime;
        if (!windowData.maximumTimeData.isLinear) {
            maximumTime = maximumTimeData.value;
        }
        else {
            var timeDiff = performance.now() - maximumTimeData.time;
            maximumTime = maximumTimeData.value + timeDiff / 1000;
        }
        var theoricalMinimum = maximumTime - windowData.timeshiftDepth;
        return Math.max((_b = windowData.absoluteMinimumTime) !== null && _b !== void 0 ? _b : 0, theoricalMinimum);
    };
    /**
     * Get the maximum position currently defined by the Manifest, in seconds.
     * @returns {number}
     */
    Manifest.prototype.getMaximumPosition = function () {
        var maximumTimeData = this._timeBounds.maximumTimeData;
        if (!maximumTimeData.isLinear) {
            return maximumTimeData.value;
        }
        var timeDiff = performance.now() - maximumTimeData.time;
        return maximumTimeData.value + timeDiff / 1000;
    };
    /**
     * Look in the Manifest for Representations linked to the given key ID,
     * and mark them as being impossible to decrypt.
     * Then trigger a "decipherabilityUpdate" event to notify everyone of the
     * changes performed.
     * @param {Object} keyUpdates
     */
    Manifest.prototype.updateDeciperabilitiesBasedOnKeyIds = function (_a) {
        var whitelistedKeyIds = _a.whitelistedKeyIds, blacklistedKeyIDs = _a.blacklistedKeyIDs;
        var updates = updateDeciperability(this, function (representation) {
            if (representation.decipherable === false ||
                representation.contentProtections === undefined) {
                return representation.decipherable;
            }
            var contentKIDs = representation.contentProtections.keyIds;
            for (var i = 0; i < contentKIDs.length; i++) {
                var elt = contentKIDs[i];
                for (var j = 0; j < blacklistedKeyIDs.length; j++) {
                    if (areArraysOfNumbersEqual(blacklistedKeyIDs[j], elt.keyId)) {
                        return false;
                    }
                }
                for (var j = 0; j < whitelistedKeyIds.length; j++) {
                    if (areArraysOfNumbersEqual(whitelistedKeyIds[j], elt.keyId)) {
                        return true;
                    }
                }
            }
            return representation.decipherable;
        });
        if (updates.length > 0) {
            this.trigger("decipherabilityUpdate", updates);
        }
    };
    /**
     * Look in the Manifest for Representations linked to the given content
     * protection initialization data and mark them as being impossible to
     * decrypt.
     * Then trigger a "decipherabilityUpdate" event to notify everyone of the
     * changes performed.
     * @param {Object} initData
     */
    Manifest.prototype.addUndecipherableProtectionData = function (initData) {
        var updates = updateDeciperability(this, function (representation) {
            var _a, _b;
            if (representation.decipherable === false) {
                return false;
            }
            var segmentProtections = (_b = (_a = representation.contentProtections) === null || _a === void 0 ? void 0 : _a.initData) !== null && _b !== void 0 ? _b : [];
            var _loop_1 = function (i) {
                if (initData.type === undefined ||
                    segmentProtections[i].type === initData.type) {
                    var containedInitData = initData.values.every(function (undecipherableVal) {
                        return segmentProtections[i].values.some(function (currVal) {
                            return (undecipherableVal.systemId === undefined ||
                                currVal.systemId === undecipherableVal.systemId) &&
                                areArraysOfNumbersEqual(currVal.data, undecipherableVal.data);
                        });
                    });
                    if (containedInitData) {
                        return { value: false };
                    }
                }
            };
            for (var i = 0; i < segmentProtections.length; i++) {
                var state_1 = _loop_1(i);
                if (typeof state_1 === "object")
                    return state_1.value;
            }
            return representation.decipherable;
        });
        if (updates.length > 0) {
            this.trigger("decipherabilityUpdate", updates);
        }
    };
    /**
     * @deprecated only returns adaptations for the first period
     * @returns {Array.<Object>}
     */
    Manifest.prototype.getAdaptations = function () {
        warnOnce("manifest.getAdaptations() is deprecated." +
            " Please use manifest.period[].getAdaptations() instead");
        var firstPeriod = this.periods[0];
        if (firstPeriod === undefined) {
            return [];
        }
        var adaptationsByType = firstPeriod.adaptations;
        var adaptationsList = [];
        for (var adaptationType in adaptationsByType) {
            if (adaptationsByType.hasOwnProperty(adaptationType)) {
                var adaptations = adaptationsByType[adaptationType];
                adaptationsList.push.apply(adaptationsList, adaptations);
            }
        }
        return adaptationsList;
    };
    /**
     * @deprecated only returns adaptations for the first period
     * @returns {Array.<Object>}
     */
    Manifest.prototype.getAdaptationsForType = function (adaptationType) {
        warnOnce("manifest.getAdaptationsForType(type) is deprecated." +
            " Please use manifest.period[].getAdaptationsForType(type) instead");
        var firstPeriod = this.periods[0];
        if (firstPeriod === undefined) {
            return [];
        }
        var adaptationsForType = firstPeriod.adaptations[adaptationType];
        return adaptationsForType === undefined ? [] :
            adaptationsForType;
    };
    /**
     * @deprecated only returns adaptations for the first period
     * @returns {Array.<Object>}
     */
    Manifest.prototype.getAdaptation = function (wantedId) {
        warnOnce("manifest.getAdaptation(id) is deprecated." +
            " Please use manifest.period[].getAdaptation(id) instead");
        /* eslint-disable import/no-deprecated */
        return arrayFind(this.getAdaptations(), function (_a) {
            var id = _a.id;
            return wantedId === id;
        });
        /* eslint-enable import/no-deprecated */
    };
    /**
     * Add supplementary image Adaptation(s) to the manifest.
     * @private
     * @param {Object|Array.<Object>} imageTracks
     */
    Manifest.prototype._addSupplementaryImageAdaptations = function (
    /* eslint-disable import/no-deprecated */
    imageTracks) {
        var _this = this;
        var _imageTracks = Array.isArray(imageTracks) ? imageTracks : [imageTracks];
        var newImageTracks = _imageTracks.map(function (_a) {
            var mimeType = _a.mimeType, url = _a.url;
            var adaptationID = "gen-image-ada-" + generateSupplementaryTrackID();
            var representationID = "gen-image-rep-" + generateSupplementaryTrackID();
            var newAdaptation = new Adaptation({ id: adaptationID,
                type: "image",
                representations: [{
                        bitrate: 0,
                        id: representationID,
                        mimeType: mimeType,
                        index: new StaticRepresentationIndex({
                            media: url,
                        })
                    }] }, { isManuallyAdded: true });
            if (newAdaptation.representations.length > 0 && !newAdaptation.isSupported) {
                var error = new MediaError("MANIFEST_INCOMPATIBLE_CODECS_ERROR", "An Adaptation contains only incompatible codecs.");
                _this.contentWarnings.push(error);
            }
            return newAdaptation;
        });
        if (newImageTracks.length > 0 && this.periods.length > 0) {
            var adaptations = this.periods[0].adaptations;
            adaptations.image =
                adaptations.image != null ? adaptations.image.concat(newImageTracks) :
                    newImageTracks;
        }
    };
    /**
     * Add supplementary text Adaptation(s) to the manifest.
     * @private
     * @param {Object|Array.<Object>} textTracks
     */
    Manifest.prototype._addSupplementaryTextAdaptations = function (
    /* eslint-disable import/no-deprecated */
    textTracks
    /* eslint-enable import/no-deprecated */
    ) {
        var _this = this;
        var _textTracks = Array.isArray(textTracks) ? textTracks : [textTracks];
        var newTextAdaptations = _textTracks.reduce(function (allSubs, _a) {
            var mimeType = _a.mimeType, codecs = _a.codecs, url = _a.url, language = _a.language, 
            /* eslint-disable import/no-deprecated */
            languages = _a.languages, 
            /* eslint-enable import/no-deprecated */
            closedCaption = _a.closedCaption;
            var langsToMapOn = language != null ? [language] :
                languages != null ? languages :
                    [];
            return allSubs.concat(langsToMapOn.map(function (_language) {
                var adaptationID = "gen-text-ada-" + generateSupplementaryTrackID();
                var representationID = "gen-text-rep-" + generateSupplementaryTrackID();
                var newAdaptation = new Adaptation({ id: adaptationID,
                    type: "text",
                    language: _language,
                    closedCaption: closedCaption,
                    representations: [{
                            bitrate: 0,
                            id: representationID,
                            mimeType: mimeType,
                            codecs: codecs,
                            index: new StaticRepresentationIndex({
                                media: url,
                            })
                        }] }, { isManuallyAdded: true });
                if (newAdaptation.representations.length > 0 && !newAdaptation.isSupported) {
                    var error = new MediaError("MANIFEST_INCOMPATIBLE_CODECS_ERROR", "An Adaptation contains only incompatible codecs.");
                    _this.contentWarnings.push(error);
                }
                return newAdaptation;
            }));
        }, []);
        if (newTextAdaptations.length > 0 && this.periods.length > 0) {
            var adaptations = this.periods[0].adaptations;
            adaptations.text =
                adaptations.text != null ? adaptations.text.concat(newTextAdaptations) :
                    newTextAdaptations;
        }
    };
    /**
     * @param {Object} newManifest
     * @param {number} type
     */
    Manifest.prototype._performUpdate = function (newManifest, updateType) {
        this.availabilityStartTime = newManifest.availabilityStartTime;
        this.expired = newManifest.expired;
        this.isDynamic = newManifest.isDynamic;
        this.isLive = newManifest.isLive;
        this.isLastPeriodKnown = newManifest.isLastPeriodKnown;
        this.lifetime = newManifest.lifetime;
        this.contentWarnings = newManifest.contentWarnings;
        this.suggestedPresentationDelay = newManifest.suggestedPresentationDelay;
        this.transport = newManifest.transport;
        this.publishTime = newManifest.publishTime;
        if (updateType === MANIFEST_UPDATE_TYPE.Full) {
            this._timeBounds = newManifest._timeBounds;
            this.uris = newManifest.uris;
            replacePeriods(this.periods, newManifest.periods);
        }
        else {
            this._timeBounds.maximumTimeData = newManifest._timeBounds.maximumTimeData;
            this.updateUrl = newManifest.uris[0];
            updatePeriods(this.periods, newManifest.periods);
            // Partial updates do not remove old Periods.
            // This can become a memory problem when playing a content long enough.
            // Let's clean manually Periods behind the minimum possible position.
            var min = this.getMinimumPosition();
            while (this.periods.length > 0) {
                var period = this.periods[0];
                if (period.end === undefined || period.end > min) {
                    break;
                }
                this.periods.shift();
            }
        }
        // Re-set this.adaptations for retro-compatibility in v3.x.x
        /* eslint-disable import/no-deprecated */
        this.adaptations = this.periods[0] === undefined ?
            {} :
            this.periods[0].adaptations;
        /* eslint-enable import/no-deprecated */
        // Let's trigger events at the end, as those can trigger side-effects.
        // We do not want the current Manifest object to be incomplete when those
        // happen.
        this.trigger("manifestUpdate", null);
    };
    return Manifest;
}(EventEmitter));
export default Manifest;
/**
 * Update `decipherable` property of every `Representation` found in the
 * Manifest based on the result of a `isDecipherable` callback:
 *   - When that callback returns `true`, update `decipherable` to `true`
 *   - When that callback returns `false`, update `decipherable` to `false`
 *   - When that callback returns `undefined`, update `decipherable` to
 *     `undefined`
 * @param {Manifest} manifest
 * @param {Function} isDecipherable
 * @returns {Array.<Object>}
 */
function updateDeciperability(manifest, isDecipherable) {
    var updates = [];
    for (var i = 0; i < manifest.periods.length; i++) {
        var period = manifest.periods[i];
        var adaptations = period.getAdaptations();
        for (var j = 0; j < adaptations.length; j++) {
            var adaptation = adaptations[j];
            var representations = adaptation.representations;
            for (var k = 0; k < representations.length; k++) {
                var representation = representations[k];
                var result = isDecipherable(representation);
                if (result !== representation.decipherable) {
                    updates.push({ manifest: manifest, period: period, adaptation: adaptation, representation: representation });
                    representation.decipherable = result;
                }
            }
        }
    }
    return updates;
}
