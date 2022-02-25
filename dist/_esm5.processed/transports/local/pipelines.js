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
/**
 * /!\ This file is feature-switchable.
 * It always should be imported through the `features` object.
 */
import { createManifestObject } from "../../manifest";
import parseLocalManifest from "../../parsers/manifest/local";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import callCustomManifestLoader from "../utils/call_custom_manifest_loader";
import segmentLoader from "./segment_loader";
import segmentParser from "./segment_parser";
import textTrackParser from "./text_parser";
/**
 * Returns pipelines used for local Manifest streaming.
 * @param {Object} options
 * @returns {Object}
 */
export default function getLocalManifestPipelines(options) {
    var customManifestLoader = options.manifestLoader;
    var manifestPipeline = {
        loadManifest: function (url, cancelSignal) {
            if (isNullOrUndefined(customManifestLoader)) {
                throw new Error("A local Manifest is not loadable through regular HTTP(S) " +
                    " calls. You have to set a `manifestLoader` when calling " +
                    "`loadVideo`");
            }
            return callCustomManifestLoader(customManifestLoader, function () {
                throw new Error("Cannot fallback from the `manifestLoader` of a " +
                    "`local` transport");
            })(url, cancelSignal);
        },
        parseManifest: function (manifestData, _parserOptions, onWarnings) {
            return __awaiter(this, void 0, void 0, function () {
                var loadedManifest, parsed, _a, manifest, warnings;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            loadedManifest = manifestData.responseData;
                            if (typeof manifestData !== "object") {
                                throw new Error("Wrong format for the manifest data");
                            }
                            parsed = parseLocalManifest(loadedManifest);
                            return [4 /*yield*/, createManifestObject(parsed, options)];
                        case 1:
                            _a = _b.sent(), manifest = _a[0], warnings = _a[1];
                            if (warnings.length > 0) {
                                onWarnings(warnings);
                            }
                            return [2 /*return*/, { manifest: manifest, url: undefined }];
                    }
                });
            });
        },
    };
    var segmentPipeline = { loadSegment: segmentLoader,
        parseSegment: segmentParser };
    var textTrackPipeline = { loadSegment: segmentLoader,
        parseSegment: textTrackParser };
    var imageTrackPipeline = {
        loadSegment: function () {
            throw new Error("Images track not supported in local transport.");
        },
        parseSegment: function () {
            throw new Error("Images track not supported in local transport.");
        },
    };
    return { manifest: manifestPipeline,
        audio: segmentPipeline,
        video: segmentPipeline,
        text: textTrackPipeline,
        image: imageTrackPipeline };
}
