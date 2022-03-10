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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { MediaError, } from "../errors";
import areArraysOfNumbersEqual from "../utils/are_arrays_of_numbers_equal";
import arrayFind from "../utils/array_find";
import EventEmitter from "../utils/event_emitter";
import idGenerator from "../utils/id_generator";
import PPromise from "../utils/promise";
import warnOnce from "../utils/warn_once";
import { createAdaptationObject, } from "./adaptation";
import { createPeriodObject } from "./period";
import { StaticRepresentationIndex } from "./representation_index";
import { MANIFEST_UPDATE_TYPE, } from "./types";
import { replacePeriods, updatePeriods, } from "./update_periods";
var generateSupplementaryTrackID = idGenerator();
var generateNewManifestId = idGenerator();
/**
 * Create an `IManifest`-compatible object, which will list all characteristics
 * about a media content, regardless of the streaming protocol.
 * @param {Object} parsedAdaptation
 * @param {Object} options
 * @returns {Array.<Object>} Tuple of two values:
 *   1. The parsed Manifest as an object
 *   2. Array containing every minor errors that happened when the Manifest has
 *      been created, in the order they have happened..
 */
export function createManifestObject(parsedManifest, options) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function () {
        /** @link IManifest */
        function getPeriod(periodId) {
            return arrayFind(manifestObject.periods, function (period) {
                return periodId === period.id;
            });
        }
        /** @link IManifest */
        function getPeriodForTime(time) {
            return arrayFind(manifestObject.periods, function (period) {
                return time >= period.start &&
                    (period.end === undefined || period.end > time);
            });
        }
        /** @link IManifest */
        function getNextPeriod(time) {
            return arrayFind(manifestObject.periods, function (period) {
                return period.start > time;
            });
        }
        /** @link IManifest */
        function getPeriodAfter(period) {
            var endOfPeriod = period.end;
            if (endOfPeriod === undefined) {
                return null;
            }
            var nextPeriod = arrayFind(manifestObject.periods, function (_period) {
                return _period.end === undefined || endOfPeriod < _period.end;
            });
            return nextPeriod === undefined ? null :
                nextPeriod;
        }
        /** @link IManifest */
        function getUrl() {
            return manifestObject.uris[0];
        }
        /** @link IManifest */
        function replace(newManifest) {
            _performUpdate(newManifest, MANIFEST_UPDATE_TYPE.Full);
        }
        /** @link IManifest */
        function update(newManifest) {
            _performUpdate(newManifest, MANIFEST_UPDATE_TYPE.Partial);
        }
        /** @link IManifest */
        function getMinimumPosition() {
            var _a, _b;
            var windowData = manifestObject.timeBounds;
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
        }
        /** @link IManifest */
        function getMaximumPosition() {
            var maximumTimeData = manifestObject.timeBounds.maximumTimeData;
            if (!maximumTimeData.isLinear) {
                return maximumTimeData.value;
            }
            var timeDiff = performance.now() - maximumTimeData.time;
            return maximumTimeData.value + timeDiff / 1000;
        }
        /** @link IManifest */
        function updateDeciperabilitiesBasedOnKeyIds(_a) {
            var whitelistedKeyIds = _a.whitelistedKeyIds, blacklistedKeyIDs = _a.blacklistedKeyIDs;
            var updates = updateDeciperability(manifestObject, function (representation) {
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
                eventEmitter.trigger("decipherabilityUpdate", updates);
            }
        }
        /** @link IManifest */
        function addUndecipherableProtectionData(initData) {
            var updates = updateDeciperability(manifestObject, function (representation) {
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
                eventEmitter.trigger("decipherabilityUpdate", updates);
            }
        }
        /** @link IManifest */
        function getAdaptations() {
            warnOnce("manifest.getAdaptations() is deprecated." +
                " Please use manifest.period[].getAdaptations() instead");
            var firstPeriod = manifestObject.periods[0];
            if (firstPeriod === undefined) {
                return [];
            }
            var adaptationsByType = firstPeriod.adaptations;
            var adaptationsList = [];
            for (var adaptationType in adaptationsByType) {
                if (adaptationsByType.hasOwnProperty(adaptationType)) {
                    var _adap = adaptationsByType[adaptationType];
                    adaptationsList.push.apply(adaptationsList, _adap);
                }
            }
            return adaptationsList;
        }
        /** @link IManifest */
        function getAdaptationsForType(adaptationType) {
            warnOnce("manifest.getAdaptationsForType(type) is deprecated." +
                " Please use manifest.period[].getAdaptationsForType(type) instead");
            var firstPeriod = manifestObject.periods[0];
            if (firstPeriod === undefined) {
                return [];
            }
            var adaptationsForType = firstPeriod.adaptations[adaptationType];
            return adaptationsForType === undefined ? [] :
                adaptationsForType;
        }
        /** @link IManifest */
        function getAdaptation(wantedId) {
            warnOnce("manifest.getAdaptation(id) is deprecated." +
                " Please use manifest.period[].getAdaptation(id) instead");
            /* eslint-disable-next-line import/no-deprecated */
            return arrayFind(getAdaptations(), function (_a) {
                var id = _a.id;
                return wantedId === id;
            });
        }
        /**
         * Add supplementary image Adaptation(s) to the manifest.
         * @param {Object|Array.<Object>} imageTracks
         */
        function _addSupplementaryImageAdaptations(
        /* eslint-disable-next-line import/no-deprecated */
        imageTracks) {
            return __awaiter(this, void 0, void 0, function () {
                var _imageTracks, newImageTracks, _i, _imageTracks_1, _a, mimeType, url, adaptationID, representationID, newAdaptation, error, adaptations;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _imageTracks = Array.isArray(imageTracks) ? imageTracks : [imageTracks];
                            newImageTracks = [];
                            _i = 0, _imageTracks_1 = _imageTracks;
                            _b.label = 1;
                        case 1:
                            if (!(_i < _imageTracks_1.length)) return [3 /*break*/, 4];
                            _a = _imageTracks_1[_i], mimeType = _a.mimeType, url = _a.url;
                            adaptationID = "gen-image-ada-" + generateSupplementaryTrackID();
                            representationID = "gen-image-rep-" + generateSupplementaryTrackID();
                            return [4 /*yield*/, createAdaptationObject({
                                    id: adaptationID,
                                    type: "image",
                                    representations: [{
                                            bitrate: 0,
                                            id: representationID,
                                            mimeType: mimeType,
                                            index: new StaticRepresentationIndex({ media: url }),
                                        }],
                                }, { isManuallyAdded: true })];
                        case 2:
                            newAdaptation = _b.sent();
                            if (newAdaptation.representations.length > 0 &&
                                newAdaptation.hasSupport) {
                                error = new MediaError("MANIFEST_INCOMPATIBLE_CODECS_ERROR", "An Adaptation contains only incompatible codecs.");
                                warnings.push(error);
                            }
                            newImageTracks.push(newAdaptation);
                            _b.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4:
                            if (newImageTracks.length > 0 && manifestObject.periods.length > 0) {
                                adaptations = manifestObject.periods[0].adaptations;
                                adaptations.image =
                                    adaptations.image != null ? adaptations.image.concat(newImageTracks) :
                                        newImageTracks;
                            }
                            return [2 /*return*/];
                    }
                });
            });
        }
        /**
         * Add supplementary text Adaptation(s) to the manifest.
         * @param {Object|Array.<Object>} textTracks
         */
        function _addSupplementaryTextAdaptations(
        /* eslint-disable-next-line import/no-deprecated */
        textTracks) {
            return __awaiter(this, void 0, void 0, function () {
                var _textTracks, newTextAdaptations, _i, _textTracks_1, textTrack, mimeType, codecs, url, language, 
                /* eslint-disable-next-line import/no-deprecated */
                languages, closedCaption, langsToMapOn, _a, langsToMapOn_1, _language, adaptationID, representationID, newAdaptation, error, adaptations;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _textTracks = Array.isArray(textTracks) ? textTracks : [textTracks];
                            newTextAdaptations = [];
                            _i = 0, _textTracks_1 = _textTracks;
                            _b.label = 1;
                        case 1:
                            if (!(_i < _textTracks_1.length)) return [3 /*break*/, 6];
                            textTrack = _textTracks_1[_i];
                            mimeType = textTrack.mimeType, codecs = textTrack.codecs, url = textTrack.url, language = textTrack.language, languages = textTrack.languages, closedCaption = textTrack.closedCaption;
                            langsToMapOn = language != null ? [language] :
                                languages != null ? languages :
                                    [];
                            _a = 0, langsToMapOn_1 = langsToMapOn;
                            _b.label = 2;
                        case 2:
                            if (!(_a < langsToMapOn_1.length)) return [3 /*break*/, 5];
                            _language = langsToMapOn_1[_a];
                            adaptationID = "gen-text-ada-" + generateSupplementaryTrackID();
                            representationID = "gen-text-rep-" + generateSupplementaryTrackID();
                            return [4 /*yield*/, createAdaptationObject({
                                    id: adaptationID,
                                    type: "text",
                                    language: _language,
                                    closedCaption: closedCaption,
                                    representations: [{
                                            bitrate: 0,
                                            id: representationID,
                                            mimeType: mimeType,
                                            codecs: codecs,
                                            index: new StaticRepresentationIndex({ media: url }),
                                        }],
                                }, { isManuallyAdded: true })];
                        case 3:
                            newAdaptation = _b.sent();
                            if (newAdaptation.representations.length > 0 &&
                                !newAdaptation.hasSupport) {
                                error = new MediaError("MANIFEST_INCOMPATIBLE_CODECS_ERROR", "An Adaptation contains only incompatible codecs.");
                                warnings.push(error);
                            }
                            newTextAdaptations.push(newAdaptation);
                            _b.label = 4;
                        case 4:
                            _a++;
                            return [3 /*break*/, 2];
                        case 5:
                            _i++;
                            return [3 /*break*/, 1];
                        case 6:
                            if (newTextAdaptations.length > 0 && manifestObject.periods.length > 0) {
                                adaptations = manifestObject.periods[0].adaptations;
                                adaptations.text =
                                    adaptations.text != null ? adaptations.text.concat(newTextAdaptations) :
                                        newTextAdaptations;
                            }
                            return [2 /*return*/];
                    }
                });
            });
        }
        /**
         * @param {Object} newManifest
         * @param {number} type
         */
        function _performUpdate(newManifest, updateType) {
            manifestObject.availabilityStartTime = newManifest.availabilityStartTime;
            manifestObject.expired = newManifest.expired;
            manifestObject.isDynamic = newManifest.isDynamic;
            manifestObject.isLive = newManifest.isLive;
            manifestObject.isLastPeriodKnown = newManifest.isLastPeriodKnown;
            manifestObject.lifetime = newManifest.lifetime;
            manifestObject.suggestedPresentationDelay = newManifest.suggestedPresentationDelay;
            manifestObject.transport = newManifest.transport;
            manifestObject.publishTime = newManifest.publishTime;
            if (updateType === MANIFEST_UPDATE_TYPE.Full) {
                manifestObject.timeBounds = newManifest.timeBounds;
                manifestObject.uris = newManifest.uris;
                replacePeriods(manifestObject.periods, newManifest.periods);
            }
            else {
                manifestObject.timeBounds.maximumTimeData = newManifest.timeBounds.maximumTimeData;
                manifestObject.updateUrl = newManifest.uris[0];
                updatePeriods(manifestObject.periods, newManifest.periods);
                // Partial updates do not remove old Periods.
                // This can become a memory problem when playing a content long enough.
                // Let's clean manually Periods behind the minimum possible position.
                var min = manifestObject.getMinimumPosition();
                while (manifestObject.periods.length > 0) {
                    var period = manifestObject.periods[0];
                    if (period.end === undefined || period.end > min) {
                        break;
                    }
                    manifestObject.periods.shift();
                }
            }
            // Re-set this.adaptations for retro-compatibility in v3.x.x
            /* eslint-disable import/no-deprecated */
            manifestObject.adaptations = manifestObject.periods[0] === undefined ?
                {} :
                manifestObject.periods[0].adaptations;
            /* eslint-enable import/no-deprecated */
            // Let's trigger events at the end, as those can trigger side-effects.
            // We do not want the current Manifest object to be incomplete when those
            // happen.
            eventEmitter.trigger("manifestUpdate", null);
        }
        var eventEmitter, _e, supplementaryTextTracks, _f, supplementaryImageTracks, representationFilter, warnings, _periodProms, _i, _g, parsedPeriod, _periods, _h, _j, _k, period, pWarnings, manifestObject;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    eventEmitter = new EventEmitter();
                    _e = options.supplementaryTextTracks, supplementaryTextTracks = _e === void 0 ? [] : _e, _f = options.supplementaryImageTracks, supplementaryImageTracks = _f === void 0 ? [] : _f, representationFilter = options.representationFilter;
                    warnings = [];
                    _periodProms = [];
                    for (_i = 0, _g = parsedManifest.periods; _i < _g.length; _i++) {
                        parsedPeriod = _g[_i];
                        _periodProms.push(createPeriodObject(parsedPeriod, representationFilter));
                    }
                    _periods = [];
                    _h = 0;
                    return [4 /*yield*/, PPromise.all(_periodProms)];
                case 1:
                    _j = _l.sent();
                    _l.label = 2;
                case 2:
                    if (!(_h < _j.length)) return [3 /*break*/, 4];
                    _k = _j[_h], period = _k[0], pWarnings = _k[1];
                    warnings.push.apply(warnings, pWarnings);
                    _periods.push(period);
                    _l.label = 3;
                case 3:
                    _h++;
                    return [3 /*break*/, 2];
                case 4:
                    _periods.sort(function (a, b) { return a.start - b.start; });
                    manifestObject = {
                        id: generateNewManifestId(),
                        expired: (_a = parsedManifest.expired) !== null && _a !== void 0 ? _a : null,
                        transport: parsedManifest.transportType,
                        clockOffset: parsedManifest.clockOffset,
                        periods: _periods,
                        /* eslint-disable-next-line import/no-deprecated */
                        adaptations: (_c = (_b = _periods[0]) === null || _b === void 0 ? void 0 : _b.adaptations) !== null && _c !== void 0 ? _c : {},
                        isDynamic: parsedManifest.isDynamic,
                        isLive: parsedManifest.isLive,
                        isLastPeriodKnown: parsedManifest.isLastPeriodKnown,
                        uris: (_d = parsedManifest.uris) !== null && _d !== void 0 ? _d : [],
                        updateUrl: options.manifestUpdateUrl,
                        lifetime: parsedManifest.lifetime,
                        suggestedPresentationDelay: parsedManifest.suggestedPresentationDelay,
                        availabilityStartTime: parsedManifest.availabilityStartTime,
                        publishTime: parsedManifest.publishTime,
                        timeBounds: parsedManifest.timeBounds,
                        getPeriod: getPeriod,
                        getPeriodForTime: getPeriodForTime,
                        getPeriodAfter: getPeriodAfter,
                        getNextPeriod: getNextPeriod,
                        getUrl: getUrl,
                        replace: replace,
                        update: update,
                        getMinimumPosition: getMinimumPosition,
                        getMaximumPosition: getMaximumPosition,
                        updateDeciperabilitiesBasedOnKeyIds: updateDeciperabilitiesBasedOnKeyIds,
                        addUndecipherableProtectionData: addUndecipherableProtectionData,
                        getAdaptations: getAdaptations,
                        getAdaptationsForType: getAdaptationsForType,
                        getAdaptation: getAdaptation,
                        addEventListener: eventEmitter.addEventListener.bind(eventEmitter),
                        removeEventListener: eventEmitter.removeEventListener.bind(eventEmitter),
                    };
                    if (!(supplementaryImageTracks.length > 0)) return [3 /*break*/, 6];
                    return [4 /*yield*/, _addSupplementaryImageAdaptations(supplementaryImageTracks)];
                case 5:
                    _l.sent();
                    _l.label = 6;
                case 6:
                    if (!(supplementaryTextTracks.length > 0)) return [3 /*break*/, 8];
                    return [4 /*yield*/, _addSupplementaryTextAdaptations(supplementaryTextTracks)];
                case 7:
                    _l.sent();
                    _l.label = 8;
                case 8: return [2 /*return*/, [manifestObject, warnings]];
            }
        });
    });
}
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
