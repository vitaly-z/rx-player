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
import { MediaError, } from "../errors";
import arrayFind from "../utils/array_find";
import objectValues from "../utils/object_values";
import PPromise from "../utils/promise";
import { createAdaptationObject, } from "./adaptation";
/**
 * Create an `IPeriod`-compatible object, which will declare the characteristics
 * of a content during a particular time period.
 * @param {Object} parsedPeriod
 * @param {function|undefined} representationFilter
 * @returns {Array.<Object>} Tuple of two values:
 *   1. The parsed Period as an object
 *   2. Array containing every minor errors that happened when the Manifest has
 *      been created, in the order they have happened..
 */
export function createPeriodObject(args, representationFilter) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        /** @link IPeriod */
        function getAdaptations() {
            return objectValues(adaptations).reduce(function (acc, adaps) { return acc.concat(adaps); }, []);
        }
        /** @link IPeriod */
        function getAdaptationsForType(adaptationType) {
            var adaptationsForType = adaptations[adaptationType];
            return adaptationsForType == null ? [] :
                adaptationsForType;
        }
        /** @link IPeriod */
        function getAdaptation(wantedId) {
            return arrayFind(getAdaptations(), function (_a) {
                var adapId = _a.id;
                return wantedId === adapId;
            });
        }
        /** @link IPeriod */
        function getSupportedAdaptations(aType) {
            if (aType === undefined) {
                return getAdaptations().filter(function (ada) {
                    return ada.hasSupport;
                });
            }
            var adaptationsForType = adaptations[aType];
            if (adaptationsForType === undefined) {
                return [];
            }
            return adaptationsForType.filter(function (ada) {
                return ada.hasSupport;
            });
        }
        var warnings, adaptations, _i, _b, type, adapType, adaptationsForType, adaptationProms, _c, adaptationsForType_1, adaptation, adaptationArr, filteredAdaptations, _d, adaptationArr_1, newAdaptation, error, end, periodObject;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    warnings = [];
                    adaptations = {};
                    _i = 0, _b = Object.keys(args.adaptations);
                    _e.label = 1;
                case 1:
                    if (!(_i < _b.length)) return [3 /*break*/, 4];
                    type = _b[_i];
                    adapType = type;
                    adaptationsForType = args.adaptations[adapType];
                    if (adaptationsForType == null) {
                        return [3 /*break*/, 3];
                    }
                    adaptationProms = [];
                    for (_c = 0, adaptationsForType_1 = adaptationsForType; _c < adaptationsForType_1.length; _c++) {
                        adaptation = adaptationsForType_1[_c];
                        adaptationProms.push(createAdaptationObject(adaptation, { representationFilter: representationFilter }));
                    }
                    return [4 /*yield*/, PPromise.all(adaptationProms)];
                case 2:
                    adaptationArr = _e.sent();
                    filteredAdaptations = [];
                    for (_d = 0, adaptationArr_1 = adaptationArr; _d < adaptationArr_1.length; _d++) {
                        newAdaptation = adaptationArr_1[_d];
                        if (newAdaptation.representations.length > 0 &&
                            !newAdaptation.hasSupport) {
                            error = new MediaError("MANIFEST_INCOMPATIBLE_CODECS_ERROR", "An Adaptation contains only incompatible codecs.");
                            warnings.push(error);
                        }
                        if (newAdaptation.representations.length > 0) {
                            filteredAdaptations.push(newAdaptation);
                        }
                    }
                    if (filteredAdaptations.every(function (adaptation) { return !adaptation.hasSupport; }) &&
                        adaptationsForType.length > 0 &&
                        (adapType === "video" || adapType === "audio")) {
                        throw new MediaError("MANIFEST_PARSE_ERROR", "No supported " + adapType + " adaptations");
                    }
                    if (filteredAdaptations.length > 0) {
                        adaptations[adapType] = filteredAdaptations;
                    }
                    _e.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    if (!Array.isArray(adaptations.video) &&
                        !Array.isArray(adaptations.audio)) {
                        throw new MediaError("MANIFEST_PARSE_ERROR", "No supported audio and video tracks.");
                    }
                    end = args.duration !== undefined && args.start !== undefined ?
                        args.duration + args.start :
                        undefined;
                    periodObject = {
                        id: args.id,
                        adaptations: adaptations,
                        start: args.start,
                        duration: args.duration,
                        end: end,
                        streamEvents: (_a = args.streamEvents) !== null && _a !== void 0 ? _a : [],
                        getAdaptations: getAdaptations,
                        getAdaptationsForType: getAdaptationsForType,
                        getAdaptation: getAdaptation,
                        getSupportedAdaptations: getSupportedAdaptations,
                    };
                    return [2 /*return*/, [periodObject, warnings]];
            }
        });
    });
}
