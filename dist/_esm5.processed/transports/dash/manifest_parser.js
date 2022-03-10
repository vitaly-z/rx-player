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
import { formatError } from "../../errors";
import features from "../../features";
import log from "../../log";
import { createManifestObject } from "../../manifest";
import objectAssign from "../../utils/object_assign";
import PPromise from "../../utils/promise";
import request from "../../utils/request";
import { strToUtf8, utf8ToStr, } from "../../utils/string_parsing";
export default function generateManifestParser(options) {
    var aggressiveMode = options.aggressiveMode, referenceDateTime = options.referenceDateTime;
    var serverTimeOffset = options.serverSyncInfos !== undefined ?
        options.serverSyncInfos.serverTimestamp - options.serverSyncInfos.clientTime :
        undefined;
    return function manifestParser(manifestData, parserOptions, onWarnings, cancelSignal, scheduleRequest) {
        var _a;
        var responseData = manifestData.responseData;
        var argClockOffset = parserOptions.externalClockOffset;
        var url = (_a = manifestData.url) !== null && _a !== void 0 ? _a : parserOptions.originalUrl;
        var optAggressiveMode = aggressiveMode === true;
        var externalClockOffset = serverTimeOffset !== null && serverTimeOffset !== void 0 ? serverTimeOffset : argClockOffset;
        var unsafelyBaseOnPreviousManifest = parserOptions.unsafeMode ?
            parserOptions.previousManifest :
            null;
        var dashParserOpts = { aggressiveMode: optAggressiveMode, unsafelyBaseOnPreviousManifest: unsafelyBaseOnPreviousManifest, url: url, referenceDateTime: referenceDateTime, externalClockOffset: externalClockOffset };
        var parsers = features.dashParsers;
        if (parsers.wasm === null ||
            parsers.wasm.status === "uninitialized" ||
            parsers.wasm.status === "failure") {
            log.debug("DASH: WASM MPD Parser not initialized. Running JS one.");
            return runDefaultJsParser();
        }
        else {
            var manifestAB_1 = getManifestAsArrayBuffer(responseData);
            if (!doesXmlSeemsUtf8Encoded(manifestAB_1)) {
                log.info("DASH: MPD doesn't seem to be UTF-8-encoded. " +
                    "Running JS parser instead of the WASM one.");
                return runDefaultJsParser();
            }
            if (parsers.wasm.status === "initialized") {
                log.debug("DASH: Running WASM MPD Parser.");
                var parsed = parsers.wasm.runWasmParser(manifestAB_1, dashParserOpts);
                return processMpdParserResponse(parsed);
            }
            else {
                log.debug("DASH: Awaiting WASM initialization before parsing the MPD.");
                var initProm = parsers.wasm.waitForInitialization()
                    .catch(function () { });
                return initProm.then(function () {
                    if (parsers.wasm === null || parsers.wasm.status !== "initialized") {
                        log.warn("DASH: WASM MPD parser initialization failed. " +
                            "Running JS parser instead");
                        return runDefaultJsParser();
                    }
                    log.debug("DASH: Running WASM MPD Parser.");
                    var parsed = parsers.wasm.runWasmParser(manifestAB_1, dashParserOpts);
                    return processMpdParserResponse(parsed);
                });
            }
        }
        /**
         * Parse the MPD through the default JS-written parser (as opposed to the
         * WebAssembly one).
         * If it is not defined, throws.
         * @returns {Observable}
         */
        function runDefaultJsParser() {
            if (parsers.js === null) {
                throw new Error("No MPD parser is imported");
            }
            var manifestDoc = getManifestAsDocument(responseData);
            var parsedManifest = parsers.js(manifestDoc, dashParserOpts);
            return processMpdParserResponse(parsedManifest);
        }
        /**
         * Process return of one of the MPD parser.
         * If it asks for a resource, load it then continue.
         * @param {Object} parserResponse - Response returned from a MPD parser.
         * @returns {Observable}
         */
        function processMpdParserResponse(parserResponse) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, manifest, mWarnings, value, externalResources;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (!(parserResponse.type === "done")) return [3 /*break*/, 2];
                            if (parserResponse.value.warnings.length > 0) {
                                onWarnings(parserResponse.value.warnings);
                            }
                            if (cancelSignal.isCancelled) {
                                return [2 /*return*/, PPromise.reject(cancelSignal.cancellationError)];
                            }
                            return [4 /*yield*/, createManifestObject(parserResponse.value.parsed, options)];
                        case 1:
                            _a = _b.sent(), manifest = _a[0], mWarnings = _a[1];
                            if (mWarnings.length > 0) {
                                onWarnings(parserResponse.value.warnings);
                            }
                            return [2 /*return*/, { manifest: manifest, url: url }];
                        case 2:
                            value = parserResponse.value;
                            externalResources = value.urls.map(function (resourceUrl) {
                                return scheduleRequest(function () {
                                    return value.format === "string" ? request({ url: resourceUrl,
                                        responseType: "text", cancelSignal: cancelSignal }) :
                                        request({ url: resourceUrl,
                                            responseType: "arraybuffer", cancelSignal: cancelSignal });
                                }).then(function (res) {
                                    if (value.format === "string") {
                                        if (typeof res.responseData !== "string") {
                                            throw new Error("External DASH resources should have been a string");
                                        }
                                        return objectAssign(res, {
                                            responseData: {
                                                success: true,
                                                data: res.responseData
                                            },
                                        });
                                    }
                                    else {
                                        if (!(res.responseData instanceof ArrayBuffer)) {
                                            throw new Error("External DASH resources should have been ArrayBuffers");
                                        }
                                        return objectAssign(res, {
                                            responseData: {
                                                success: true,
                                                data: res.responseData
                                            },
                                        });
                                    }
                                }, function (err) {
                                    var error = formatError(err, {
                                        defaultCode: "PIPELINE_PARSE_ERROR",
                                        defaultReason: "An unknown error occured when parsing ressources.",
                                    });
                                    return objectAssign({}, {
                                        size: undefined,
                                        requestDuration: undefined,
                                        responseData: {
                                            success: false,
                                            error: error
                                        },
                                    });
                                });
                            });
                            return [2 /*return*/, PPromise.all(externalResources).then(function (loadedResources) {
                                    if (value.format === "string") {
                                        assertLoadedResourcesFormatString(loadedResources);
                                        return processMpdParserResponse(value.continue(loadedResources));
                                    }
                                    else {
                                        assertLoadedResourcesFormatArrayBuffer(loadedResources);
                                        return processMpdParserResponse(value.continue(loadedResources));
                                    }
                                })];
                    }
                });
            });
        }
    };
}
/**
 * Throw if the given input is not in the expected format.
 * Allows to enforce runtime type-checking as compile-time type-checking here is
 * difficult to enforce.
 *
 * @param loadedResource
 * @returns
 */
function assertLoadedResourcesFormatString(loadedResources) {
    if (0 /* CURRENT_ENV */ === 0 /* PRODUCTION */) {
        return;
    }
    loadedResources.forEach(function (loadedResource) {
        var responseData = loadedResource.responseData;
        if (responseData.success && typeof responseData.data === "string") {
            return;
        }
        else if (!responseData.success) {
            return;
        }
        throw new Error("Invalid data given to the LoadedRessource");
    });
}
/**
 * Throw if the given input is not in the expected format.
 * Allows to enforce runtime type-checking as compile-time type-checking here is
 * difficult to enforce.
 *
 * @param loadedResource
 * @returns
 */
function assertLoadedResourcesFormatArrayBuffer(loadedResources) {
    if (0 /* CURRENT_ENV */ === 0 /* PRODUCTION */) {
        return;
    }
    loadedResources.forEach(function (loadedResource) {
        var responseData = loadedResource.responseData;
        if (responseData.success && responseData.data instanceof ArrayBuffer) {
            return;
        }
        else if (!responseData.success) {
            return;
        }
        throw new Error("Invalid data given to the LoadedRessource");
    });
}
/**
 * Try to convert a Manifest from an unknown format to a `Document` format.
 * Useful to exploit DOM-parsing APIs to quickly parse an XML Manifest.
 *
 * Throws if the format cannot be converted.
 * @param {*} manifestSrc
 * @returns {Document}
 */
function getManifestAsDocument(manifestSrc) {
    if (manifestSrc instanceof ArrayBuffer) {
        return new DOMParser()
            .parseFromString(utf8ToStr(new Uint8Array(manifestSrc)), "text/xml");
    }
    else if (typeof manifestSrc === "string") {
        return new DOMParser().parseFromString(manifestSrc, "text/xml");
    }
    else if (manifestSrc instanceof Document) {
        return manifestSrc;
    }
    else {
        throw new Error("DASH Manifest Parser: Unrecognized Manifest format");
    }
}
/**
 * Try to convert a Manifest from an unknown format to an `ArrayBuffer` format.
 * Throws if the format cannot be converted.
 * @param {*} manifestSrc
 * @returns {ArrayBuffer}
 */
function getManifestAsArrayBuffer(manifestSrc) {
    if (manifestSrc instanceof ArrayBuffer) {
        return manifestSrc;
    }
    else if (typeof manifestSrc === "string") {
        return strToUtf8(manifestSrc).buffer;
    }
    else if (manifestSrc instanceof Document) {
        return strToUtf8(manifestSrc.documentElement.innerHTML).buffer;
    }
    else {
        throw new Error("DASH Manifest Parser: Unrecognized Manifest format");
    }
}
/**
 * Returns true if the given XML appears to be encoded in UTF-8.
 *
 * For now, this function can return a lot of false positives, but it should
 * mostly work with real use cases.
 * @param {ArrayBuffer} xmlData
 * @returns {boolean}
 */
function doesXmlSeemsUtf8Encoded(xmlData) {
    var dv = new DataView(xmlData);
    if (dv.getUint16(0) === 0xEFBB && dv.getUint8(2) === 0XBF) {
        // (UTF-8 BOM)
        return true;
    }
    else if (dv.getUint16(0) === 0xFEFF || dv.getUint16(0) === 0xFFFe) {
        // (UTF-16 BOM)
        return false;
    }
    // TODO check encoding from request mimeType and text declaration?
    // https://www.w3.org/TR/xml/#sec-TextDecl
    return true;
}
