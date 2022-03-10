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
import log from "../log";
import objectAssign from "../utils/object_assign";
import { isChromeCast, isSafariDesktop, isSafariMobile, } from "./browser_detection";
import isNode from "./is_node";
/**
 * Object allowing to store short-term information on decoding capabilities, to
 * avoid calling multiple times the same API when video characteristics are
 * similar.
 */
var VideoDecodingInfoMemory = {};
/**
 * Contains the timeout id of the timer used to clear `VideoDecodingInfoMemory`.
 */
var VideoCapabilitiesTimeout;
/**
 * If `false`, MediaCapability APIs cannot be relied on.
 * Most of the exception here are set due to Shaka-Player also avoiding to use
 * the API on them.
 */
var CanUseMediaCapabilitiesApi = !isNode &&
    !isChromeCast &&
    !isSafariMobile &&
    !isSafariDesktop &&
    typeof navigator.mediaCapabilities === "object";
/**
 * Use the `MediaCapabilities` web APIs to detect if the given Representation is
 * supported or not.
 * Returns `true` if it is supported, false it is not and `undefined if it
 * cannot tell.
 * @param {Object} representation
 * @param {string} adaptationType
 * @returns {Promise.<boolean|undefined>}
 */
export default function checkDecodingCapabilitiesSupport(representation, adaptationType) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function () {
        function runCheck() {
            return __awaiter(this, void 0, void 0, function () {
                var videoCharacs, supportObj, err_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            videoCharacs = { contentType: mimeTypeStr, width: width, height: height, bitrate: bitrate, framerate: framerate };
                            return [4 /*yield*/, navigator.mediaCapabilities.decodingInfo({
                                    type: "media-source",
                                    video: videoCharacs,
                                })];
                        case 1:
                            supportObj = _a.sent();
                            if (VideoDecodingInfoMemory[mimeTypeStr] === undefined) {
                                VideoDecodingInfoMemory[mimeTypeStr] = [];
                            }
                            VideoDecodingInfoMemory[mimeTypeStr].push(objectAssign({ result: supportObj }, videoCharacs));
                            if (VideoCapabilitiesTimeout === undefined) {
                                VideoCapabilitiesTimeout = window.setTimeout(function () {
                                    VideoCapabilitiesTimeout = undefined;
                                    VideoDecodingInfoMemory = {};
                                }, 0);
                            }
                            return [2 /*return*/, supportObj.supported];
                        case 2:
                            err_1 = _a.sent();
                            log.warn("Compat: mediaCapabilities.decodingInfo API failed for video content", err_1);
                            throw err_1;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        }
        var mimeTypeStr, tmpFrameRate, framerate, width, height, bitrate, decodingForMimeType, _i, decodingForMimeType_1, characteristics;
        return __generator(this, function (_d) {
            if (!CanUseMediaCapabilitiesApi || adaptationType !== "video") {
                return [2 /*return*/, undefined];
            }
            mimeTypeStr = representation.getMimeTypeString();
            tmpFrameRate = representation.frameRate !== undefined ?
                parseMaybeDividedNumber(representation.frameRate) :
                null;
            framerate = tmpFrameRate !== null &&
                !isNaN(tmpFrameRate) &&
                isFinite(tmpFrameRate) ? tmpFrameRate :
                1;
            width = (_a = representation.width) !== null && _a !== void 0 ? _a : 1;
            height = (_b = representation.height) !== null && _b !== void 0 ? _b : 1;
            bitrate = (_c = representation.bitrate) !== null && _c !== void 0 ? _c : 1;
            decodingForMimeType = VideoDecodingInfoMemory[mimeTypeStr];
            if (decodingForMimeType === undefined) {
                return [2 /*return*/, runCheck()];
            }
            for (_i = 0, decodingForMimeType_1 = decodingForMimeType; _i < decodingForMimeType_1.length; _i++) {
                characteristics = decodingForMimeType_1[_i];
                if (characteristics.bitrate === bitrate &&
                    characteristics.width === width &&
                    characteristics.height === height &&
                    characteristics.framerate === framerate) {
                    return [2 /*return*/, characteristics.result.supported];
                }
            }
            return [2 /*return*/];
        });
    });
}
/**
 * Frame rates can be expressed as divisions of integers.
 * This function tries to convert it to a floating point value.
 * TODO in v4, declares `frameRate` as number directly
 * @param {string} val
 * @param {string} displayName
 * @returns {Array.<number | Error | null>}
 */
function parseMaybeDividedNumber(val) {
    var matches = /^(\d+)\/(\d+)$/.exec(val);
    if (matches !== null) {
        // No need to check, we know both are numbers
        return +matches[1] / +matches[2];
    }
    return Number.parseFloat(val);
}
