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
import { checkDecodingCapabilitiesSupport, isCodecSupported, } from "../compat";
import log from "../log";
import areArraysOfNumbersEqual from "../utils/are_arrays_of_numbers_equal";
/**
 * Create an `IRepresentation`-compatible object, which will declare a single
 * "Representation" (i.e. quality) of a track.
 * @param {Object} args
 * @param {Object} opts
 * @returns {Object}
 */
export function createRepresentationObject(args, opts) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        /** @link IRepresentation */
        function getMimeTypeString() {
            var _a, _b;
            return "".concat((_a = representationObj.mimeType) !== null && _a !== void 0 ? _a : "", ";") +
                "codecs=\"".concat((_b = representationObj.codec) !== null && _b !== void 0 ? _b : "", "\"");
        }
        /** @link IRepresentation */
        function getEncryptionData(drmSystemId) {
            var _a;
            var allInitData = getAllEncryptionData();
            var filtered = [];
            for (var i = 0; i < allInitData.length; i++) {
                var createdObjForType = false;
                var initData = allInitData[i];
                for (var j = 0; j < initData.values.length; j++) {
                    if (initData.values[j].systemId.toLowerCase() === drmSystemId.toLowerCase()) {
                        if (!createdObjForType) {
                            var keyIds = (_a = representationObj.contentProtections) === null || _a === void 0 ? void 0 : _a.keyIds.map(function (val) { return val.keyId; });
                            filtered.push({ type: initData.type, keyIds: keyIds, values: [initData.values[j]] });
                            createdObjForType = true;
                        }
                        else {
                            filtered[filtered.length - 1].values.push(initData.values[j]);
                        }
                    }
                }
            }
            return filtered;
        }
        /** @link IRepresentation */
        function getAllEncryptionData() {
            var contentProtections = representationObj.contentProtections;
            if (contentProtections === undefined ||
                contentProtections.initData.length === 0) {
                return [];
            }
            var keyIds = contentProtections === null || contentProtections === void 0 ? void 0 : contentProtections.keyIds.map(function (val) { return val.keyId; });
            return contentProtections.initData.map(function (x) {
                return { type: x.type, keyIds: keyIds, values: x.values };
            });
        }
        /** @link IRepresentation */
        function _addProtectionData(initDataType, data) {
            var contentProtections = representationObj.contentProtections;
            var hasUpdatedProtectionData = false;
            if (contentProtections === undefined) {
                representationObj.contentProtections = { keyIds: [],
                    initData: [{ type: initDataType,
                            values: data }] };
                return true;
            }
            var cInitData = contentProtections.initData;
            for (var i = 0; i < cInitData.length; i++) {
                if (cInitData[i].type === initDataType) {
                    var cValues = cInitData[i].values;
                    // loop through data
                    for (var dataI = 0; dataI < data.length; dataI++) {
                        var dataToAdd = data[dataI];
                        var cValuesIdx = void 0;
                        for (cValuesIdx = 0; cValuesIdx < cValues.length; cValuesIdx++) {
                            if (dataToAdd.systemId === cValues[cValuesIdx].systemId) {
                                if (areArraysOfNumbersEqual(dataToAdd.data, cValues[cValuesIdx].data)) {
                                    // go to next dataToAdd
                                    break;
                                }
                                else {
                                    log.warn("Manifest: different init data for the same system ID");
                                }
                            }
                        }
                        if (cValuesIdx === cValues.length) {
                            // we didn't break the loop === we didn't already find that value
                            cValues.push(dataToAdd);
                            hasUpdatedProtectionData = true;
                        }
                    }
                    return hasUpdatedProtectionData;
                }
            }
            // If we are here, this means that we didn't find the corresponding
            // init data type in this.contentProtections.initData.
            contentProtections.initData.push({ type: initDataType,
                values: data });
            return true;
        }
        var representationObj, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    representationObj = {
                        id: args.id,
                        bitrate: args.bitrate,
                        codec: args.codecs,
                        index: args.index,
                        getMimeTypeString: getMimeTypeString,
                        getEncryptionData: getEncryptionData,
                        getAllEncryptionData: getAllEncryptionData,
                        _addProtectionData: _addProtectionData,
                        // Set first to default `false` value, to have a valid Representation object
                        isCodecSupported: false,
                        isSupported: false,
                    };
                    if (args.height !== undefined) {
                        representationObj.height = args.height;
                    }
                    if (args.width !== undefined) {
                        representationObj.width = args.width;
                    }
                    if (args.mimeType !== undefined) {
                        representationObj.mimeType = args.mimeType;
                    }
                    if (args.contentProtections !== undefined) {
                        representationObj.contentProtections = args.contentProtections;
                    }
                    if (args.frameRate !== undefined) {
                        representationObj.frameRate = args.frameRate;
                    }
                    if (args.hdrInfo !== undefined) {
                        representationObj.hdrInfo = args.hdrInfo;
                    }
                    if (!(opts.type === "audio" || opts.type === "video")) return [3 /*break*/, 2];
                    representationObj.isCodecSupported = isCodecSupported((_a = representationObj.getMimeTypeString()) !== null && _a !== void 0 ? _a : "");
                    _b = representationObj;
                    return [4 /*yield*/, checkDecodingCapabilitiesSupport(representationObj, opts.type)];
                case 1:
                    _b.isSupported =
                        _c.sent();
                    return [3 /*break*/, 3];
                case 2:
                    representationObj.isCodecSupported = true; // TODO for other types
                    representationObj.isSupported = true;
                    _c.label = 3;
                case 3: return [2 /*return*/, representationObj];
            }
        });
    });
}
