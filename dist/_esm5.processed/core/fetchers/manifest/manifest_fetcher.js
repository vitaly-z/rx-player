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
import PPromise from "pinkie";
import { Observable, } from "rxjs";
import config from "../../../config";
import { formatError, } from "../../../errors";
import log from "../../../log";
import assert from "../../../utils/assert";
import TaskCanceller from "../../../utils/task_canceller";
import errorSelector from "../utils/error_selector";
import { tryRequestPromiseWithBackoff, } from "../utils/try_urls_with_backoff";
var DEFAULT_MAX_MANIFEST_REQUEST_RETRY = config.DEFAULT_MAX_MANIFEST_REQUEST_RETRY, DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE = config.DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE, INITIAL_BACKOFF_DELAY_BASE = config.INITIAL_BACKOFF_DELAY_BASE, MAX_BACKOFF_DELAY_BASE = config.MAX_BACKOFF_DELAY_BASE;
/**
 * Class allowing to facilitate the task of loading and parsing a Manifest.
 * @class ManifestFetcher
 * @example
 * ```js
 * const manifestFetcher = new ManifestFetcher(manifestUrl, pipelines, options);
 * manifestFetcher.fetch().pipe(
 *   // Filter only responses (might also receive warning events)
 *   filter((evt) => evt.type === "response");
 *   // Parse the Manifest
 *   mergeMap(res => res.parse({ externalClockOffset }))
 *   // (again)
 *   filter((evt) => evt.type === "parsed");
 * ).subscribe(({ value }) => {
 *   console.log("Manifest:", value.manifest);
 * });
 * ```
 */
var ManifestFetcher = /** @class */ (function () {
    /**
     * Construct a new ManifestFetcher.
     * @param {string | undefined} url - Default Manifest url, will be used when
     * no URL is provided to the `fetch` function.
     * `undefined` if unknown or if a Manifest should be retrieved through other
     * means than an HTTP request.
     * @param {Object} pipelines - Transport pipelines used to perform the
     * Manifest loading and parsing operations.
     * @param {Object} settings - Configure the `ManifestFetcher`.
     */
    function ManifestFetcher(url, pipelines, settings) {
        this._manifestUrl = url;
        this._pipelines = pipelines.manifest;
        this._settings = settings;
    }
    /**
     * (re-)Load the Manifest.
     * This method does not yet parse it, parsing will then be available through
     * a callback available on the response.
     *
     * You can set an `url` on which that Manifest will be requested.
     * If not set, the regular Manifest url - defined on the `ManifestFetcher`
     * instanciation - will be used instead.
     *
     * @param {string} [url]
     * @returns {Observable}
     */
    ManifestFetcher.prototype.fetch = function (url) {
        var _this = this;
        return new Observable(function (obs) {
            var pipelines = _this._pipelines;
            var requestUrl = url !== null && url !== void 0 ? url : _this._manifestUrl;
            /** `true` if the loading pipeline is already completely executed. */
            var hasFinishedLoading = false;
            /** Allows to cancel the loading operation. */
            var canceller = new TaskCanceller();
            var backoffSettings = _this._getBackoffSetting(function (err) {
                obs.next({ type: "warning", value: errorSelector(err) });
            });
            var loadingPromise = pipelines.resolveManifestUrl === undefined ?
                callLoaderWithRetries(requestUrl) :
                callResolverWithRetries(requestUrl).then(callLoaderWithRetries);
            loadingPromise
                .then(function (response) {
                hasFinishedLoading = true;
                obs.next({
                    type: "response",
                    parse: function (parserOptions) {
                        return _this._parseLoadedManifest(response, parserOptions);
                    },
                });
                obs.complete();
            })
                .catch(function (err) {
                if (canceller.isUsed) {
                    // Cancellation has already been handled by RxJS
                    return;
                }
                hasFinishedLoading = true;
                obs.error(errorSelector(err));
            });
            return function () {
                if (!hasFinishedLoading) {
                    canceller.cancel();
                }
            };
            /**
             * Call the resolver part of the pipeline, retrying if it fails according
             * to the current settings.
             * Returns the Promise of the last attempt.
             * /!\ This pipeline should have a `resolveManifestUrl` function defined.
             * @param {string | undefined}  resolverUrl
             * @returns {Promise}
             */
            function callResolverWithRetries(resolverUrl) {
                var resolveManifestUrl = pipelines.resolveManifestUrl;
                assert(resolveManifestUrl !== undefined);
                var callResolver = function () { return resolveManifestUrl(resolverUrl, canceller.signal); };
                return tryRequestPromiseWithBackoff(callResolver, backoffSettings, canceller.signal);
            }
            /**
             * Call the loader part of the pipeline, retrying if it fails according
             * to the current settings.
             * Returns the Promise of the last attempt.
             * @param {string | undefined}  resolverUrl
             * @returns {Promise}
             */
            function callLoaderWithRetries(manifestUrl) {
                var loadManifest = pipelines.loadManifest;
                var callLoader = function () { return loadManifest(manifestUrl, canceller.signal); };
                return tryRequestPromiseWithBackoff(callLoader, backoffSettings, canceller.signal);
            }
        });
    };
    /**
     * Parse an already loaded Manifest.
     *
     * This method should be reserved for Manifests for which no request has been
     * done.
     * In other cases, it's preferable to go through the `fetch` method, so
     * information on the request can be used by the parsing process.
     * @param {*} manifest
     * @param {Object} parserOptions
     * @returns {Observable}
     */
    ManifestFetcher.prototype.parse = function (manifest, parserOptions) {
        return this._parseLoadedManifest({ responseData: manifest,
            size: undefined,
            requestDuration: undefined }, parserOptions);
    };
    /**
     * Parse a Manifest.
     *
     * @param {Object} loaded - Information about the loaded Manifest as well as
     * about the corresponding request.
     * @param {Object} parserOptions - Options used when parsing the Manifest.
     * @returns {Observable}
     */
    ManifestFetcher.prototype._parseLoadedManifest = function (loaded, parserOptions) {
        var _this = this;
        return new Observable(function (obs) {
            var parsingTimeStart = performance.now();
            var canceller = new TaskCanceller();
            var sendingTime = loaded.sendingTime, receivedTime = loaded.receivedTime;
            var backoffSettings = _this._getBackoffSetting(function (err) {
                obs.next({ type: "warning", value: errorSelector(err) });
            });
            var opts = { externalClockOffset: parserOptions.externalClockOffset,
                unsafeMode: parserOptions.unsafeMode,
                previousManifest: parserOptions.previousManifest,
                originalUrl: _this._manifestUrl };
            try {
                var res = _this._pipelines.parseManifest(loaded, opts, onWarnings, canceller.signal, scheduleRequest);
                if (!isPromise(res)) {
                    emitManifestAndComplete(res.manifest);
                }
                else {
                    res
                        .then(function (_a) {
                        var manifest = _a.manifest;
                        return emitManifestAndComplete(manifest);
                    })
                        .catch(function (err) {
                        if (canceller.isUsed) {
                            // Cancellation is already handled by RxJS
                            return;
                        }
                        emitError(err, true);
                    });
                }
            }
            catch (err) {
                if (canceller.isUsed) {
                    // Cancellation is already handled by RxJS
                    return undefined;
                }
                emitError(err, true);
            }
            return function () {
                canceller.cancel();
            };
            /**
             * Perform a request with the same retry mechanisms and error handling
             * than for a Manifest loader.
             * @param {Function} performRequest
             * @returns {Function}
             */
            function scheduleRequest(performRequest) {
                return __awaiter(this, void 0, void 0, function () {
                    var data, err_1;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, tryRequestPromiseWithBackoff(performRequest, backoffSettings, canceller.signal)];
                            case 1:
                                data = _a.sent();
                                return [2 /*return*/, data];
                            case 2:
                                err_1 = _a.sent();
                                throw errorSelector(err_1);
                            case 3: return [2 /*return*/];
                        }
                    });
                });
            }
            /**
             * Handle minor errors encountered by a Manifest parser.
             * @param {Array.<Error>} warnings
             */
            function onWarnings(warnings) {
                for (var _i = 0, warnings_1 = warnings; _i < warnings_1.length; _i++) {
                    var warning = warnings_1[_i];
                    if (canceller.isUsed) {
                        return;
                    }
                    emitError(warning, false);
                }
            }
            /**
             * Emit a formatted "parsed" event through `obs`.
             * To call once the Manifest has been parsed.
             * @param {Object} manifest
             */
            function emitManifestAndComplete(manifest) {
                onWarnings(manifest.contentWarnings);
                var parsingTime = performance.now() - parsingTimeStart;
                log.info("MF: Manifest parsed in " + parsingTime + "ms");
                obs.next({ type: "parsed", manifest: manifest, sendingTime: sendingTime, receivedTime: receivedTime, parsingTime: parsingTime });
                obs.complete();
            }
            /**
             * Format the given Error and emit it through `obs`.
             * Either through a `"warning"` event, if `isFatal` is `false`, or through
             * a fatal Observable error, if `isFatal` is set to `true`.
             * @param {*} err
             * @param {boolean} isFatal
             */
            function emitError(err, isFatal) {
                var formattedError = formatError(err, {
                    defaultCode: "PIPELINE_PARSE_ERROR",
                    defaultReason: "Unknown error when parsing the Manifest",
                });
                if (isFatal) {
                    obs.error(formattedError);
                }
                else {
                    obs.next({ type: "warning",
                        value: formattedError });
                }
            }
        });
    };
    /**
     * Construct "backoff settings" that can be used with a range of functions
     * allowing to perform multiple request attempts
     * @param {Function} onRetry
     * @returns {Object}
     */
    ManifestFetcher.prototype._getBackoffSetting = function (onRetry) {
        var _a = this._settings, lowLatencyMode = _a.lowLatencyMode, ogRegular = _a.maxRetryRegular, ogOffline = _a.maxRetryOffline;
        var baseDelay = lowLatencyMode ? INITIAL_BACKOFF_DELAY_BASE.LOW_LATENCY :
            INITIAL_BACKOFF_DELAY_BASE.REGULAR;
        var maxDelay = lowLatencyMode ? MAX_BACKOFF_DELAY_BASE.LOW_LATENCY :
            MAX_BACKOFF_DELAY_BASE.REGULAR;
        var maxRetryRegular = ogRegular !== null && ogRegular !== void 0 ? ogRegular : DEFAULT_MAX_MANIFEST_REQUEST_RETRY;
        var maxRetryOffline = ogOffline !== null && ogOffline !== void 0 ? ogOffline : DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE;
        return { onRetry: onRetry, baseDelay: baseDelay, maxDelay: maxDelay, maxRetryRegular: maxRetryRegular, maxRetryOffline: maxRetryOffline };
    };
    return ManifestFetcher;
}());
export default ManifestFetcher;
/**
 * Returns `true` when the returned value seems to be a Promise instance, as
 * created by the RxPlayer.
 * @param {*} val
 * @returns {boolean}
 */
function isPromise(val) {
    return val instanceof PPromise ||
        val instanceof Promise;
}
