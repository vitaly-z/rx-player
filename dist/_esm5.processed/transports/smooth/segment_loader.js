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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import PPromise from "pinkie";
import { CustomLoaderError } from "../../errors";
import assert from "../../utils/assert";
import request from "../../utils/request";
import byteRange from "../utils/byte_range";
import checkISOBMFFIntegrity from "../utils/check_isobmff_integrity";
import { createAudioInitSegment, createVideoInitSegment, } from "./isobmff";
import { isMP4EmbeddedTrack } from "./utils";
/**
 * Segment loader triggered if there was no custom-defined one in the API.
 * @param {string} uri
 * @param {Object} content
 * @param {Object} callbacks
 * @param {Object} cancelSignal
 * @param {boolean} checkMediaSegmentIntegrity
 * @returns {Promise}
 */
function regularSegmentLoader(url, content, callbacks, cancelSignal, checkMediaSegmentIntegrity) {
    var headers;
    var range = content.segment.range;
    if (Array.isArray(range)) {
        headers = { Range: byteRange(range) };
    }
    return request({ url: url, responseType: "arraybuffer", headers: headers, cancelSignal: cancelSignal, onProgress: callbacks.onProgress })
        .then(function (data) {
        var isMP4 = isMP4EmbeddedTrack(content.representation);
        if (!isMP4 || checkMediaSegmentIntegrity !== true) {
            return { resultType: "segment-loaded",
                resultData: data };
        }
        var dataU8 = new Uint8Array(data.responseData);
        checkISOBMFFIntegrity(dataU8, content.segment.isInit);
        return { resultType: "segment-loaded",
            resultData: __assign(__assign({}, data), { responseData: dataU8 }) };
    });
}
/**
 * Defines the url for the request, load the right loader (custom/default
 * one).
 */
var generateSegmentLoader = function (_a) {
    var checkMediaSegmentIntegrity = _a.checkMediaSegmentIntegrity, customSegmentLoader = _a.customSegmentLoader;
    return function (url, content, cancelSignal, callbacks) {
        var segment = content.segment, manifest = content.manifest, period = content.period, adaptation = content.adaptation, representation = content.representation;
        if (segment.isInit) {
            if (segment.privateInfos === undefined ||
                segment.privateInfos.smoothInitSegment === undefined) {
                throw new Error("Smooth: Invalid segment format");
            }
            var smoothInitPrivateInfos = segment.privateInfos.smoothInitSegment;
            var responseData = void 0;
            var codecPrivateData = smoothInitPrivateInfos.codecPrivateData, timescale = smoothInitPrivateInfos.timescale, _a = smoothInitPrivateInfos.protection, protection = _a === void 0 ? { keyId: undefined,
                keySystems: undefined } : _a;
            if (codecPrivateData === undefined) {
                throw new Error("Smooth: no codec private data.");
            }
            switch (adaptation.type) {
                case "video": {
                    var _b = representation.width, width = _b === void 0 ? 0 : _b, _c = representation.height, height = _c === void 0 ? 0 : _c;
                    responseData = createVideoInitSegment(timescale, width, height, 72, 72, 4, // vRes, hRes, nal
                    codecPrivateData, protection.keyId);
                    break;
                }
                case "audio": {
                    var _d = smoothInitPrivateInfos.channels, channels = _d === void 0 ? 0 : _d, _e = smoothInitPrivateInfos.bitsPerSample, bitsPerSample = _e === void 0 ? 0 : _e, _f = smoothInitPrivateInfos.packetSize, packetSize = _f === void 0 ? 0 : _f, _g = smoothInitPrivateInfos.samplingRate, samplingRate = _g === void 0 ? 0 : _g;
                    responseData = createAudioInitSegment(timescale, channels, bitsPerSample, packetSize, samplingRate, codecPrivateData, protection.keyId);
                    break;
                }
                default:
                    if (false) {
                        assert(false, "responseData should have been set");
                    }
                    responseData = new Uint8Array(0);
            }
            return PPromise.resolve({ resultType: "segment-created",
                resultData: responseData });
        }
        else if (url === null) {
            return PPromise.resolve({ resultType: "segment-created",
                resultData: null });
        }
        else {
            var args_1 = { adaptation: adaptation, manifest: manifest, period: period, representation: representation, segment: segment, transport: "smooth", url: url };
            if (typeof customSegmentLoader !== "function") {
                return regularSegmentLoader(url, content, callbacks, cancelSignal, checkMediaSegmentIntegrity);
            }
            return new Promise(function (res, rej) {
                /** `true` when the custom segmentLoader should not be active anymore. */
                var hasFinished = false;
                /**
                 * Callback triggered when the custom segment loader has a response.
                 * @param {Object} args
                 */
                var resolve = function (_args) {
                    if (hasFinished || cancelSignal.isCancelled) {
                        return;
                    }
                    hasFinished = true;
                    cancelSignal.deregister(abortCustomLoader);
                    var isMP4 = isMP4EmbeddedTrack(content.representation);
                    if (!isMP4 || checkMediaSegmentIntegrity !== true) {
                        res({ resultType: "segment-loaded",
                            resultData: { responseData: _args.data,
                                size: _args.size,
                                requestDuration: _args.duration } });
                    }
                    var dataU8 = _args.data instanceof Uint8Array ? _args.data :
                        new Uint8Array(_args.data);
                    checkISOBMFFIntegrity(dataU8, content.segment.isInit);
                    res({ resultType: "segment-loaded",
                        resultData: { responseData: dataU8,
                            size: _args.size,
                            requestDuration: _args.duration } });
                };
                /**
                 * Callback triggered when the custom segment loader fails
                 * @param {*} err - The corresponding error encountered
                 */
                var reject = function (err) {
                    var _a, _b, _c;
                    if (hasFinished || cancelSignal.isCancelled) {
                        return;
                    }
                    hasFinished = true;
                    cancelSignal.deregister(abortCustomLoader);
                    // Format error and send it
                    var castedErr = err;
                    var message = (_a = castedErr === null || castedErr === void 0 ? void 0 : castedErr.message) !== null && _a !== void 0 ? _a : "Unknown error when fetching a Smooth segment through a " +
                        "custom segmentLoader.";
                    var emittedErr = new CustomLoaderError(message, (_b = castedErr === null || castedErr === void 0 ? void 0 : castedErr.canRetry) !== null && _b !== void 0 ? _b : false, (_c = castedErr === null || castedErr === void 0 ? void 0 : castedErr.isOfflineError) !== null && _c !== void 0 ? _c : false, castedErr === null || castedErr === void 0 ? void 0 : castedErr.xhr);
                    rej(emittedErr);
                };
                var progress = function (_args) {
                    if (hasFinished || cancelSignal.isCancelled) {
                        return;
                    }
                    callbacks.onProgress({ duration: _args.duration,
                        size: _args.size,
                        totalSize: _args.totalSize });
                };
                var fallback = function () {
                    if (hasFinished || cancelSignal.isCancelled) {
                        return;
                    }
                    hasFinished = true;
                    cancelSignal.deregister(abortCustomLoader);
                    regularSegmentLoader(url, content, callbacks, cancelSignal, checkMediaSegmentIntegrity)
                        .then(res, rej);
                };
                var customCallbacks = { reject: reject, resolve: resolve, fallback: fallback, progress: progress };
                var abort = customSegmentLoader(args_1, customCallbacks);
                cancelSignal.register(abortCustomLoader);
                /**
                 * The logic to run when the custom loader is cancelled while pending.
                 * @param {Error} err
                 */
                function abortCustomLoader(err) {
                    if (hasFinished) {
                        return;
                    }
                    hasFinished = true;
                    if (!hasFinished && typeof abort === "function") {
                        abort();
                    }
                    rej(err);
                }
            });
        }
    };
};
export default generateSegmentLoader;
