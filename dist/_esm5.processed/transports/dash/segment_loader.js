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
import { Observable, of as observableOf, } from "rxjs";
import { CustomLoaderError } from "../../errors";
import xhr, { fetchIsSupported, } from "../../utils/request";
import warnOnce from "../../utils/warn_once";
import byteRange from "../utils/byte_range";
import inferSegmentContainer from "../utils/infer_segment_container";
import addSegmentIntegrityChecks from "./add_segment_integrity_checks_to_loader";
import initSegmentLoader from "./init_segment_loader";
import lowLatencySegmentLoader from "./low_latency_segment_loader";
/**
 * Segment loader triggered if there was no custom-defined one in the API.
 * @param {Object} opt
 * @returns {Observable}
 */
function regularSegmentLoader(url, args, lowLatencyMode) {
    if (args.segment.isInit) {
        return initSegmentLoader(url, args);
    }
    var containerType = inferSegmentContainer(args.adaptation.type, args.representation);
    if (lowLatencyMode && (containerType === "mp4" || containerType === undefined)) {
        if (fetchIsSupported()) {
            return lowLatencySegmentLoader(url, args);
        }
        else {
            warnOnce("DASH: Your browser does not have the fetch API. You will have " +
                "a higher chance of rebuffering when playing close to the live edge");
        }
    }
    var segment = args.segment;
    return xhr({ url: url,
        responseType: "arraybuffer",
        sendProgressEvents: true,
        headers: segment.range !== undefined ?
            { Range: byteRange(segment.range) } :
            undefined });
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
    function segmentLoader(content) {
        var url = content.url;
        if (url == null) {
            return observableOf({ type: "data-created",
                value: { responseData: null } });
        }
        if (lowLatencyMode || customSegmentLoader === undefined) {
            return regularSegmentLoader(url, content, lowLatencyMode);
        }
        var args = { adaptation: content.adaptation,
            manifest: content.manifest,
            period: content.period,
            representation: content.representation,
            segment: content.segment,
            transport: "dash",
            url: url };
        return new Observable(function (obs) {
            var hasFinished = false;
            var hasFallbacked = false;
            /**
             * Callback triggered when the custom segment loader has a response.
             * @param {Object} args
             */
            var resolve = function (_args) {
                if (!hasFallbacked) {
                    hasFinished = true;
                    obs.next({ type: "data-loaded",
                        value: { responseData: _args.data,
                            size: _args.size,
                            duration: _args.duration } });
                    obs.complete();
                }
            };
            /**
             * Callback triggered when the custom segment loader fails
             * @param {*} err - The corresponding error encountered
             */
            var reject = function (err) {
                var _a, _b, _c;
                if (err === void 0) { err = {}; }
                if (!hasFallbacked) {
                    hasFinished = true;
                    // Format error and send it
                    var castedErr = err;
                    var message = (_a = castedErr === null || castedErr === void 0 ? void 0 : castedErr.message) !== null && _a !== void 0 ? _a : "Unknown error when fetching a DASH segment through a " +
                        "custom segmentLoader.";
                    var emittedErr = new CustomLoaderError(message, (_b = castedErr === null || castedErr === void 0 ? void 0 : castedErr.canRetry) !== null && _b !== void 0 ? _b : false, (_c = castedErr === null || castedErr === void 0 ? void 0 : castedErr.isOfflineError) !== null && _c !== void 0 ? _c : false, castedErr === null || castedErr === void 0 ? void 0 : castedErr.xhr);
                    obs.error(emittedErr);
                }
            };
            var progress = function (_args) {
                if (!hasFallbacked) {
                    obs.next({ type: "progress", value: { duration: _args.duration,
                            size: _args.size,
                            totalSize: _args.totalSize } });
                }
            };
            /**
             * Callback triggered when the custom segment loader wants to fallback to
             * the "regular" implementation
             */
            var fallback = function () {
                hasFallbacked = true;
                var regular$ = regularSegmentLoader(url, content, lowLatencyMode);
                // HACK What is TypeScript/RxJS doing here??????
                /* eslint-disable import/no-deprecated */
                /* eslint-disable @typescript-eslint/ban-ts-comment */
                // @ts-ignore
                regular$.subscribe(obs);
                /* eslint-enable import/no-deprecated */
                /* eslint-enable @typescript-eslint/ban-ts-comment */
            };
            var callbacks = { reject: reject, resolve: resolve, progress: progress, fallback: fallback };
            var abort = customSegmentLoader(args, callbacks);
            return function () {
                if (!hasFinished && !hasFallbacked && typeof abort === "function") {
                    abort();
                }
            };
        });
    }
}
