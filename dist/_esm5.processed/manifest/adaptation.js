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
import arrayFind from "../utils/array_find";
import isNullOrUndefined from "../utils/is_null_or_undefined";
import normalizeLanguage from "../utils/languages";
import PPromise from "../utils/promise";
import uniq from "../utils/uniq";
import { createRepresentationObject } from "./representation";
/** List in an array every possible value for the Adaptation's `type` property. */
export var SUPPORTED_ADAPTATIONS_TYPE = ["audio",
    "video",
    "text",
    "image"];
/**
 * Create an `IAdaptation`-compatible object, which will declare a single
 * "Adaptation" (i.e. track) of a content.
 * @param {Object} parsedAdaptation
 * @param {Object|undefined} [options]
 * @returns {Object}
 */
export function createAdaptationObject(parsedAdaptation, options) {
    if (options === void 0) { options = {}; }
    return __awaiter(this, void 0, void 0, function () {
        /** @link IAdaptation */
        function getAvailableBitrates() {
            var bitrates = [];
            for (var i = 0; i < adaptationObj.representations.length; i++) {
                var representation = adaptationObj.representations[i];
                if (representation.decipherable !== false) {
                    bitrates.push(representation.bitrate);
                }
            }
            return uniq(bitrates);
        }
        /** @link IAdaptation */
        function getPlayableRepresentations() {
            return adaptationObj.representations.filter(function (rep) {
                return rep.isCodecSupported &&
                    rep.decipherable !== false &&
                    rep.isSupported !== false;
            });
        }
        /** @link IAdaptation */
        function getRepresentation(wantedId) {
            return arrayFind(adaptationObj.representations, function (_a) {
                var id = _a.id;
                return wantedId === id;
            });
        }
        var trickModeTracks, representationFilter, isManuallyAdded, adaptationObj, _i, trickModeTracks_1, track, _a, _b, argsRepresentations, representationProms, hasSupport, i, representations, filteredRepresentations, _c, representations_1, representation, shouldAdd;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    trickModeTracks = parsedAdaptation.trickModeTracks;
                    representationFilter = options.representationFilter, isManuallyAdded = options.isManuallyAdded;
                    adaptationObj = {
                        id: parsedAdaptation.id,
                        type: parsedAdaptation.type,
                        representations: [],
                        hasSupport: false,
                        getAvailableBitrates: getAvailableBitrates,
                        getPlayableRepresentations: getPlayableRepresentations,
                        getRepresentation: getRepresentation,
                    };
                    if (parsedAdaptation.isTrickModeTrack !== undefined) {
                        adaptationObj.isTrickModeTrack = parsedAdaptation.isTrickModeTrack;
                    }
                    if (parsedAdaptation.language !== undefined) {
                        adaptationObj.language = parsedAdaptation.language;
                        adaptationObj.normalizedLanguage = normalizeLanguage(parsedAdaptation.language);
                    }
                    if (parsedAdaptation.closedCaption !== undefined) {
                        adaptationObj.isClosedCaption = parsedAdaptation.closedCaption;
                    }
                    if (parsedAdaptation.audioDescription !== undefined) {
                        adaptationObj.isAudioDescription = parsedAdaptation.audioDescription;
                    }
                    if (parsedAdaptation.isDub !== undefined) {
                        adaptationObj.isDub = parsedAdaptation.isDub;
                    }
                    if (parsedAdaptation.isSignInterpreted !== undefined) {
                        adaptationObj.isSignInterpreted = parsedAdaptation.isSignInterpreted;
                    }
                    if (!(trickModeTracks !== undefined &&
                        trickModeTracks.length > 0)) return [3 /*break*/, 4];
                    adaptationObj.trickModeTracks = [];
                    _i = 0, trickModeTracks_1 = trickModeTracks;
                    _d.label = 1;
                case 1:
                    if (!(_i < trickModeTracks_1.length)) return [3 /*break*/, 4];
                    track = trickModeTracks_1[_i];
                    _b = (_a = adaptationObj.trickModeTracks).push;
                    return [4 /*yield*/, createAdaptationObject(track)];
                case 2:
                    _b.apply(_a, [_d.sent()]);
                    _d.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    argsRepresentations = parsedAdaptation.representations;
                    representationProms = [];
                    hasSupport = false;
                    for (i = 0; i < argsRepresentations.length; i++) {
                        representationProms.push(createRepresentationObject(argsRepresentations[i], { type: adaptationObj.type }));
                    }
                    return [4 /*yield*/, PPromise.all(representationProms)];
                case 5:
                    representations = _d.sent();
                    filteredRepresentations = [];
                    for (_c = 0, representations_1 = representations; _c < representations_1.length; _c++) {
                        representation = representations_1[_c];
                        shouldAdd = isNullOrUndefined(representationFilter) ||
                            representationFilter(representation, { bufferType: adaptationObj.type,
                                language: adaptationObj.language,
                                normalizedLanguage: adaptationObj.normalizedLanguage,
                                isClosedCaption: adaptationObj.isClosedCaption,
                                isDub: adaptationObj.isDub,
                                isAudioDescription: adaptationObj.isAudioDescription,
                                isSignInterpreted: adaptationObj.isSignInterpreted });
                        if (shouldAdd) {
                            filteredRepresentations.push(representation);
                            if (!hasSupport &&
                                representation.isCodecSupported &&
                                representation.isSupported !== false) {
                                hasSupport = true;
                            }
                        }
                    }
                    filteredRepresentations.sort(function (a, b) { return a.bitrate - b.bitrate; });
                    adaptationObj.representations = filteredRepresentations;
                    adaptationObj.hasSupport = hasSupport;
                    // for manuallyAdded adaptations (not in the manifest)
                    adaptationObj.manuallyAdded = isManuallyAdded === true;
                    return [2 /*return*/, adaptationObj];
            }
        });
    });
}
