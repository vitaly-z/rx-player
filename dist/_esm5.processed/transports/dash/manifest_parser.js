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
import { formatError } from "../../errors";
import features from "../../features";
import log from "../../log";
import Manifest from "../../manifest";
import objectAssign from "../../utils/object_assign";
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
            if (parserResponse.type === "done") {
                if (parserResponse.value.warnings.length > 0) {
                    onWarnings(parserResponse.value.warnings);
                }
                if (cancelSignal.isCancelled) {
                    return Promise.reject(cancelSignal.cancellationError);
                }
                var manifest = new Manifest(parserResponse.value.parsed, options);
                return { manifest: manifest, url: url };
            }
            var value = parserResponse.value;
            var externalResources = value.urls.map(function (resourceUrl) {
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
            return Promise.all(externalResources).then(function (loadedResources) {
                if (value.format === "string") {
                    assertLoadedResourcesFormatString(loadedResources);
                    return processMpdParserResponse(value.continue(loadedResources));
                }
                else {
                    assertLoadedResourcesFormatArrayBuffer(loadedResources);
                    return processMpdParserResponse(value.continue(loadedResources));
                }
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
    if (0 /* __ENVIRONMENT__.CURRENT_ENV */ === 0 /* __ENVIRONMENT__.PRODUCTION */) {
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
    if (0 /* __ENVIRONMENT__.CURRENT_ENV */ === 0 /* __ENVIRONMENT__.PRODUCTION */) {
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
