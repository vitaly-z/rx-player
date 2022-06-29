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
import { isOffline } from "../../../compat";
import { CustomLoaderError, isKnownError, NetworkErrorTypes, RequestError, } from "../../../errors";
import log from "../../../log";
import cancellableSleep from "../../../utils/cancellable_sleep";
import getFuzzedDelay from "../../../utils/get_fuzzed_delay";
import TaskCanceller from "../../../utils/task_canceller";
/**
 * Called on a loader error.
 * Returns whether the loader request should be retried.
 *
 * TODO the notion of retrying or not could be transport-specific (e.g. 412 are
 * mainly used for Smooth contents) and thus as part of the transport code (e.g.
 * by rejecting with an error always having a `canRetry` property?).
 * Or not, to ponder.
 *
 * @param {Error} error
 * @returns {Boolean} - If true, the request can be retried.
 */
function shouldRetry(error) {
    if (error instanceof RequestError) {
        if (error.type === NetworkErrorTypes.ERROR_HTTP_CODE) {
            return error.status >= 500 ||
                error.status === 404 ||
                error.status === 415 || // some CDN seems to use that code when
                // requesting low-latency segments too much
                // in advance
                error.status === 412;
        }
        return error.type === NetworkErrorTypes.TIMEOUT ||
            error.type === NetworkErrorTypes.ERROR_EVENT;
    }
    else if (error instanceof CustomLoaderError) {
        if (typeof error.canRetry === "boolean") {
            return error.canRetry;
        }
        if (error.xhr !== undefined) {
            return error.xhr.status >= 500 ||
                error.xhr.status === 404 ||
                error.xhr.status === 415 || // some CDN seems to use that code when
                // requesting low-latency segments too much
                // in advance
                error.xhr.status === 412;
        }
        return false;
    }
    return isKnownError(error) && error.code === "INTEGRITY_ERROR";
}
/**
 * Returns true if we're pretty sure that the current error is due to the
 * user being offline.
 * @param {Error} error
 * @returns {Boolean}
 */
function isOfflineRequestError(error) {
    if (error instanceof RequestError) {
        return error.type === NetworkErrorTypes.ERROR_EVENT &&
            isOffline();
    }
    else if (error instanceof CustomLoaderError) {
        return error.isOfflineError;
    }
    return false; // under doubt, return false
}
/**
 * Guess the type of error obtained.
 * @param {*} error
 * @returns {number}
 */
function getRequestErrorType(error) {
    return isOfflineRequestError(error) ? 2 /* REQUEST_ERROR_TYPES.Offline */ :
        1 /* REQUEST_ERROR_TYPES.Regular */;
}
/**
 * Specific algorithm used to perform segment and manifest requests.
 *
 * Here how it works:
 *
 *   1. You give it one or multiple URLs available for the resource you want to
 *      request (from the most important URL to the least important), the
 *      request callback itself, and some options.
 *
 *   2. it tries to call the request callback with the first URL:
 *        - if it works as expected, it resolves the returned Promise with that
 *          request's response.
 *        - if it fails, it calls ther `onRetry` callback given with the
 *          corresponding error and try with the next URL.
 *
 *   3. When all URLs have been tested (and failed), it decides - according to
 *      the error counters, configuration and errors received - if it can retry
 *      at least one of them, in the same order:
 *        - If it can, it increments the corresponding error counter, wait a
 *          delay (based on an exponential backoff) and restart the same logic
 *          for all retry-able URL.
 *        - If it can't it just reject the error through the returned Promise.
 *
 * Note that there are in fact two separate counters:
 *   - one for "offline" errors
 *   - one for other xhr errors
 * Both counters are resetted if the error type changes from an error to the
 * next.
 *
 * @param {Array.<string>} urls
 * @param {Function} performRequest
 * @param {Object} options - Configuration options.
 * @param {Object} cancellationSignal
 * @returns {Promise}
 */
export function tryURLsWithBackoff(urls, performRequest, options, cancellationSignal) {
    if (cancellationSignal.isCancelled) {
        return Promise.reject(cancellationSignal.cancellationError);
    }
    var baseDelay = options.baseDelay, maxDelay = options.maxDelay, maxRetryRegular = options.maxRetryRegular, maxRetryOffline = options.maxRetryOffline, onRetry = options.onRetry;
    var retryCount = 0;
    var lastError = 0 /* REQUEST_ERROR_TYPES.None */;
    var urlsToTry = urls.slice();
    if (urlsToTry.length === 0) {
        log.warn("Fetchers: no URL given to `tryURLsWithBackoff`.");
        return Promise.reject(new Error("No URL to request"));
    }
    return tryURLsRecursively(urlsToTry[0], 0);
    /**
     * Try to do the request of a given `url` which corresponds to the `index`
     * argument in the `urlsToTry` Array.
     *
     * If it fails try the next one.
     *
     * If all URLs fail, start a timer and retry the first element in that array
     * by following the configuration.
     *
     * @param {string|null} url
     * @param {number} index
     * @returns {Observable}
     */
    function tryURLsRecursively(url, index) {
        return __awaiter(this, void 0, void 0, function () {
            var res, error_1, newIndex, currentError, maxRetry, newIndex, delay, fuzzedDelay, nextURL;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 4]);
                        return [4 /*yield*/, performRequest(url, cancellationSignal)];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res];
                    case 2:
                        error_1 = _a.sent();
                        if (TaskCanceller.isCancellationError(error_1)) {
                            throw error_1;
                        }
                        if (!shouldRetry(error_1)) {
                            // ban this URL
                            if (urlsToTry.length <= 1) { // This was the last one, throw
                                throw error_1;
                            }
                            // else, remove that element from the array and go the next URL
                            urlsToTry.splice(index, 1);
                            newIndex = index >= urlsToTry.length - 1 ? 0 :
                                index;
                            onRetry(error_1);
                            if (cancellationSignal.isCancelled) {
                                throw cancellationSignal.cancellationError;
                            }
                            return [2 /*return*/, tryURLsRecursively(urlsToTry[newIndex], newIndex)];
                        }
                        currentError = getRequestErrorType(error_1);
                        maxRetry = currentError === 2 /* REQUEST_ERROR_TYPES.Offline */ ? maxRetryOffline :
                            maxRetryRegular;
                        if (currentError !== lastError) {
                            retryCount = 0;
                            lastError = currentError;
                        }
                        if (index < urlsToTry.length - 1) { // there is still URLs to test
                            newIndex = index + 1;
                            onRetry(error_1);
                            if (cancellationSignal.isCancelled) {
                                throw cancellationSignal.cancellationError;
                            }
                            return [2 /*return*/, tryURLsRecursively(urlsToTry[newIndex], newIndex)];
                        }
                        // Here, we were using the last element of the `urlsToTry` array.
                        // Increment counter and restart with the first URL
                        retryCount++;
                        if (retryCount > maxRetry) {
                            throw error_1;
                        }
                        delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
                        fuzzedDelay = getFuzzedDelay(delay);
                        nextURL = urlsToTry[0];
                        onRetry(error_1);
                        if (cancellationSignal.isCancelled) {
                            throw cancellationSignal.cancellationError;
                        }
                        return [4 /*yield*/, cancellableSleep(fuzzedDelay, cancellationSignal)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, tryURLsRecursively(nextURL, 0)];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
}
/**
 * Lightweight version of the request algorithm, this time with only a simple
 * Promise given.
 * @param {Function} request$
 * @param {Object} options
 * @returns {Observable}
 */
export function tryRequestPromiseWithBackoff(performRequest, options, cancellationSignal) {
    // same than for a single unknown URL
    return tryURLsWithBackoff([null], performRequest, options, cancellationSignal);
}
