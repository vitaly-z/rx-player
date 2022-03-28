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
import { combineLatest as observableCombineLatest, concat as observableConcat, from as observableFrom, of as observableOf, } from "rxjs";
import { filter, map, mergeMap, } from "rxjs/operators";
import features from "../../features";
import log from "../../log";
import Manifest from "../../manifest";
import objectAssign from "../../utils/object_assign";
import request from "../../utils/request";
import { strToUtf8, utf8ToStr, } from "../../utils/string_parsing";
import returnParsedManifest from "../utils/return_parsed_manifest";
/**
 * @param {Object} options
 * @returns {Function}
 */
export default function generateManifestParser(options) {
    var aggressiveMode = options.aggressiveMode, referenceDateTime = options.referenceDateTime;
    var serverTimeOffset = options.serverSyncInfos !== undefined ?
        options.serverSyncInfos.serverTimestamp - options.serverSyncInfos.clientTime :
        undefined;
    return function manifestParser(args) {
        var _a;
        var response = args.response, scheduleRequest = args.scheduleRequest, loaderURL = args.url, argClockOffset = args.externalClockOffset;
        var url = (_a = response.url) !== null && _a !== void 0 ? _a : loaderURL;
        var responseData = response.responseData;
        var optAggressiveMode = aggressiveMode === true;
        var externalClockOffset = serverTimeOffset !== null && serverTimeOffset !== void 0 ? serverTimeOffset : argClockOffset;
        var unsafelyBaseOnPreviousManifest = args.unsafeMode ? args.previousManifest :
            null;
        var parserOpts = { aggressiveMode: optAggressiveMode,
            unsafelyBaseOnPreviousManifest: unsafelyBaseOnPreviousManifest,
            url: url,
            referenceDateTime: referenceDateTime,
            externalClockOffset: externalClockOffset };
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
                var parsed = parsers.wasm.runWasmParser(manifestAB_1, parserOpts);
                return processMpdParserResponse(parsed);
            }
            else {
                log.debug("DASH: Awaiting WASM initialization before parsing the MPD.");
                var initProm = parsers.wasm.waitForInitialization()
                    .catch(function () { });
                return observableFrom(initProm).pipe(mergeMap(function () {
                    if (parsers.wasm === null || parsers.wasm.status !== "initialized") {
                        log.warn("DASH: WASM MPD parser initialization failed. " +
                            "Running JS parser instead");
                        return runDefaultJsParser();
                    }
                    log.debug("DASH: Running WASM MPD Parser.");
                    var parsed = parsers.wasm.runWasmParser(manifestAB_1, parserOpts);
                    return processMpdParserResponse(parsed);
                }));
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
            var parsedManifest = parsers.js(manifestDoc, parserOpts);
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
                var _a = parserResponse.value, warnings = _a.warnings, parsed = _a.parsed;
                var warningEvents = warnings.map(function (warning) { return ({ type: "warning",
                    value: warning }); });
                var manifest = new Manifest(parsed, options);
                return observableConcat(observableOf.apply(void 0, warningEvents), returnParsedManifest(manifest, url));
            }
            var value = parserResponse.value;
            var externalResources$ = value.urls.map(function (resourceUrl) {
                return scheduleRequest(function () {
                    return request({
                        url: resourceUrl,
                        responseType: value.format === "string" ? "text" :
                            "arraybuffer",
                    }).pipe(filter(function (e) { return e.type === "data-loaded"; }), map(function (e) { return e.value; }));
                });
            });
            return observableCombineLatest(externalResources$)
                .pipe(mergeMap(function (loadedResources) {
                if (value.format === "string") {
                    var resources = loadedResources.map(function (resource) {
                        if (typeof resource.responseData !== "string") {
                            throw new Error("External DASH resources should have been a string");
                        }
                        // Normally not needed but TypeScript is just dumb here
                        return objectAssign(resource, { responseData: resource.responseData });
                    });
                    return processMpdParserResponse(value.continue(resources));
                }
                else {
                    var resources = loadedResources.map(function (resource) {
                        if (!(resource.responseData instanceof ArrayBuffer)) {
                            throw new Error("External DASH resources should have been ArrayBuffers");
                        }
                        // Normally not needed but TypeScript is just dumb here
                        return objectAssign(resource, { responseData: resource.responseData });
                    });
                    return processMpdParserResponse(value.continue(resources));
                }
            }));
        }
    };
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
