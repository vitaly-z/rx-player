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
import { Observable, } from "rxjs";
import { CustomLoaderError } from "../../errors";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
/**
 * @param {Function} customSegmentLoader
 * @returns {Observable}
 */
function loadInitSegment(customSegmentLoader) {
    return new Observable(function (obs) {
        var hasFinished = false;
        /**
         * Callback triggered when the custom segment loader has a response.
         * @param {Object} args
         */
        var resolve = function (_args) {
            hasFinished = true;
            obs.next({ type: "data-loaded",
                value: { responseData: _args.data,
                    size: _args.size,
                    duration: _args.duration } });
            obs.complete();
        };
        /**
         * Callback triggered when the custom segment loader fails
         * @param {*} err - The corresponding error encountered
         */
        var reject = function (err) {
            hasFinished = true;
            obs.error(err);
        };
        var abort = customSegmentLoader({ resolve: resolve, reject: reject });
        return function () {
            if (!hasFinished && typeof abort === "function") {
                abort();
            }
        };
    });
}
/**
 * @param {Object} segment
 * @param {Function} customSegmentLoader
 * @returns {Observable}
 */
function loadSegment(segment, customSegmentLoader) {
    return new Observable(function (obs) {
        var hasFinished = false;
        /**
         * Callback triggered when the custom segment loader has a response.
         * @param {Object} args
         */
        var resolve = function (_args) {
            hasFinished = true;
            obs.next({ type: "data-loaded",
                value: { responseData: _args.data,
                    size: _args.size,
                    duration: _args.duration } });
            obs.complete();
        };
        /**
         * Callback triggered when the custom segment loader fails
         * @param {*} err - The corresponding error encountered
         */
        var reject = function (err) {
            var _a, _b, _c;
            hasFinished = true;
            // Format error and send it
            var castedErr = err;
            var message = (_a = castedErr === null || castedErr === void 0 ? void 0 : castedErr.message) !== null && _a !== void 0 ? _a : "Unknown error when fetching a local segment through a " +
                "custom segmentLoader.";
            var emittedErr = new CustomLoaderError(message, (_b = castedErr === null || castedErr === void 0 ? void 0 : castedErr.canRetry) !== null && _b !== void 0 ? _b : false, (_c = castedErr === null || castedErr === void 0 ? void 0 : castedErr.isOfflineError) !== null && _c !== void 0 ? _c : false, castedErr === null || castedErr === void 0 ? void 0 : castedErr.xhr);
            obs.error(emittedErr);
        };
        var abort = customSegmentLoader(segment, { resolve: resolve, reject: reject });
        return function () {
            if (!hasFinished && typeof abort === "function") {
                abort();
            }
        };
    });
}
/**
 * Generic segment loader for the local Manifest.
 * @param {Object} arg
 * @returns {Observable}
 */
export default function segmentLoader(_a) {
    var segment = _a.segment;
    var privateInfos = segment.privateInfos;
    if (segment.isInit) {
        if (privateInfos === undefined ||
            isNullOrUndefined(privateInfos.localManifestInitSegment)) {
            throw new Error("Segment is not a local Manifest segment");
        }
        return loadInitSegment(privateInfos.localManifestInitSegment.load);
    }
    if (privateInfos === undefined ||
        isNullOrUndefined(privateInfos.localManifestSegment)) {
        throw new Error("Segment is not an local Manifest segment");
    }
    return loadSegment(privateInfos.localManifestSegment.segment, privateInfos.localManifestSegment.load);
}
