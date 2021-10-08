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
import PPromise from "pinkie";
import { CustomLoaderError } from "../../errors";
import request, { fetchIsSupported, } from "../../utils/request";
import warnOnce from "../../utils/warn_once";
import byteRange from "../utils/byte_range";
import inferSegmentContainer from "../utils/infer_segment_container";
import addSegmentIntegrityChecks from "./add_segment_integrity_checks_to_loader";
import initSegmentLoader from "./init_segment_loader";
import lowLatencySegmentLoader from "./low_latency_segment_loader";
/**
 * Segment loader triggered if there was no custom-defined one in the API.
 * @param {string} uri
 * @param {Object} content
 * @param {boolean} lowLatencyMode
 * @param {Object} callbacks
 * @param {Object} cancelSignal
 * @returns {Promise}
 */
export function regularSegmentLoader(url, content, lowLatencyMode, callbacks, cancelSignal) {
    if (content.segment.isInit) {
        return initSegmentLoader(url, content.segment, cancelSignal, callbacks);
    }
    var containerType = inferSegmentContainer(content.adaptation.type, content.representation);
    if (lowLatencyMode && (containerType === "mp4" || containerType === undefined)) {
        if (fetchIsSupported()) {
            return lowLatencySegmentLoader(url, content, callbacks, cancelSignal);
        }
        else {
            warnOnce("DASH: Your browser does not have the fetch API. You will have " +
                "a higher chance of rebuffering when playing close to the live edge");
        }
    }
    var segment = content.segment;
    return request({ url: url, responseType: "arraybuffer",
        headers: segment.range !== undefined ?
            { Range: byteRange(segment.range) } :
            undefined, cancelSignal: cancelSignal, onProgress: callbacks.onProgress })
        .then(function (data) { return ({ resultType: "segment-loaded",
        resultData: data }); });
}
/**
 * @param {Object} config
 * @returns {Function}
 */
export default function generateSegmentLoader(_a) {
    var lowLatencyMode = _a.lowLatencyMode, customSegmentLoader = _a.segmentLoader, checkMediaSegmentIntegrity = _a.checkMediaSegmentIntegrity;
    return checkMediaSegmentIntegrity !== true ? segmentLoader :
        addSegmentIntegrityChecks(segmentLoader);
    /**
     * @param {Object} content
     * @returns {Observable}
     */
    function segmentLoader(url, content, cancelSignal, callbacks) {
        if (url == null) {
            return PPromise.resolve({ resultType: "segment-created",
                resultData: null });
        }
        if (lowLatencyMode || customSegmentLoader === undefined) {
            return regularSegmentLoader(url, content, lowLatencyMode, callbacks, cancelSignal);
        }
        var args = { adaptation: content.adaptation,
            manifest: content.manifest,
            period: content.period,
            representation: content.representation,
            segment: content.segment,
            transport: "dash", url: url };
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
                res({ resultType: "segment-loaded",
                    resultData: { responseData: _args.data,
                        size: _args.size,
                        duration: _args.duration } });
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
                var message = (_a = castedErr === null || castedErr === void 0 ? void 0 : castedErr.message) !== null && _a !== void 0 ? _a : "Unknown error when fetching a DASH segment through a " +
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
            /**
             * Callback triggered when the custom segment loader wants to fallback to
             * the "regular" implementation
             */
            var fallback = function () {
                if (hasFinished || cancelSignal.isCancelled) {
                    return;
                }
                hasFinished = true;
                cancelSignal.deregister(abortCustomLoader);
                regularSegmentLoader(url, content, lowLatencyMode, callbacks, cancelSignal)
                    .then(res, rej);
            };
            var customCallbacks = { reject: reject, resolve: resolve, progress: progress, fallback: fallback };
            var abort = customSegmentLoader(args, customCallbacks);
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
                if (typeof abort === "function") {
                    abort();
                }
                rej(err);
            }
        });
    }
}
