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
import features from "../../features";
import { createManifestObject, } from "../../manifest";
import parseMetaPlaylist from "../../parsers/manifest/metaplaylist";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import objectAssign from "../../utils/object_assign";
import PPromise from "../../utils/promise";
import generateManifestLoader from "./manifest_loader";
/**
 * Get base - real - content from an offseted metaplaylist content.
 * @param {Object} segment
 * @param {number} offset
 * @returns {Object}
 */
function getOriginalContent(segment) {
    var _a;
    if (((_a = segment.privateInfos) === null || _a === void 0 ? void 0 : _a.metaplaylistInfos) === undefined) {
        throw new Error("MetaPlaylist: missing private infos");
    }
    var _b = segment.privateInfos.metaplaylistInfos.baseContent, manifest = _b.manifest, period = _b.period, adaptation = _b.adaptation, representation = _b.representation;
    var originalSegment = segment.privateInfos.metaplaylistInfos.originalSegment;
    return { manifest: manifest, period: period, adaptation: adaptation, representation: representation, segment: originalSegment };
}
/**
 * @param {Object} transports
 * @param {string} transportName
 * @param {Object} options
 * @returns {Object}
 */
function getTransportPipelines(transports, transportName, options) {
    var initialTransport = transports[transportName];
    if (initialTransport !== undefined) {
        return initialTransport;
    }
    var feature = features.transports[transportName];
    if (feature === undefined) {
        throw new Error("MetaPlaylist: Unknown transport ".concat(transportName, "."));
    }
    var transport = feature(options);
    transports[transportName] = transport;
    return transport;
}
/**
 * @param {Object} segment
 * @returns {Object}
 */
function getMetaPlaylistPrivateInfos(segment) {
    var privateInfos = segment.privateInfos;
    if ((privateInfos === null || privateInfos === void 0 ? void 0 : privateInfos.metaplaylistInfos) === undefined) {
        throw new Error("MetaPlaylist: Undefined transport for content for metaplaylist.");
    }
    return privateInfos.metaplaylistInfos;
}
export default function (options) {
    var transports = {};
    var manifestLoader = generateManifestLoader({
        customManifestLoader: options.manifestLoader,
    });
    // remove some options that we might not want to apply to the
    // other streaming protocols used here
    var otherTransportOptions = objectAssign({}, options, { manifestLoader: undefined,
        supplementaryTextTracks: [],
        supplementaryImageTracks: [] });
    var manifestPipeline = {
        loadManifest: manifestLoader,
        parseManifest: function (manifestData, parserOptions, onWarnings, cancelSignal, scheduleRequest) {
            var _a;
            var url = (_a = manifestData.url) !== null && _a !== void 0 ? _a : parserOptions.originalUrl;
            var responseData = manifestData.responseData;
            var mplParserOptions = { url: url, serverSyncInfos: options.serverSyncInfos };
            var parsed = parseMetaPlaylist(responseData, mplParserOptions);
            return handleParsedResult(parsed);
            function handleParsedResult(parsedResult) {
                return __awaiter(this, void 0, void 0, function () {
                    var _a, manifest, warnings, parsedValue, loaderProms;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                if (!(parsedResult.type === "done")) return [3 /*break*/, 2];
                                return [4 /*yield*/, createManifestObject(parsedResult.value, options)];
                            case 1:
                                _a = _b.sent(), manifest = _a[0], warnings = _a[1];
                                if (warnings.length > 0) {
                                    onWarnings(warnings);
                                }
                                return [2 /*return*/, PPromise.resolve({ manifest: manifest })];
                            case 2:
                                parsedValue = parsedResult.value;
                                loaderProms = parsedValue.ressources.map(function (resource) {
                                    var transport = getTransportPipelines(transports, resource.transportType, otherTransportOptions);
                                    return scheduleRequest(loadSubManifest)
                                        .then(function (data) {
                                        return transport.manifest.parseManifest(data, __assign(__assign({}, parserOptions), { originalUrl: resource.url }), onWarnings, cancelSignal, scheduleRequest);
                                    });
                                    function loadSubManifest() {
                                        return transport.manifest.loadManifest(resource.url, cancelSignal);
                                    }
                                });
                                return [2 /*return*/, PPromise.all(loaderProms).then(function (parsedReqs) {
                                        var loadedRessources = parsedReqs.map(function (e) { return e.manifest; });
                                        return handleParsedResult(parsedResult.value.continue(loadedRessources));
                                    })];
                        }
                    });
                });
            }
        },
    };
    /**
     * @param {Object} segment
     * @param {Object} transports
     * @returns {Object}
     */
    function getTransportPipelinesFromSegment(segment) {
        var transportType = getMetaPlaylistPrivateInfos(segment).transportType;
        return getTransportPipelines(transports, transportType, otherTransportOptions);
    }
    /**
     * @param {number} contentOffset
     * @param {number} scaledContentOffset
     * @param {number|undefined} contentEnd
     * @param {Object} segmentResponse
     * @returns {Object}
     */
    function offsetTimeInfos(contentOffset, contentEnd, segmentResponse) {
        var offsetedSegmentOffset = segmentResponse.chunkOffset + contentOffset;
        if (isNullOrUndefined(segmentResponse.chunkData)) {
            return { chunkInfos: segmentResponse.chunkInfos,
                chunkOffset: offsetedSegmentOffset,
                appendWindow: [undefined, undefined] };
        }
        // clone chunkInfos
        var chunkInfos = segmentResponse.chunkInfos, appendWindow = segmentResponse.appendWindow;
        var offsetedChunkInfos = chunkInfos === null ? null :
            objectAssign({}, chunkInfos);
        if (offsetedChunkInfos !== null) {
            offsetedChunkInfos.time += contentOffset;
        }
        var offsetedWindowStart = appendWindow[0] !== undefined ?
            Math.max(appendWindow[0] + contentOffset, contentOffset) :
            contentOffset;
        var offsetedWindowEnd;
        if (appendWindow[1] !== undefined) {
            offsetedWindowEnd = contentEnd !== undefined ?
                Math.min(appendWindow[1] + contentOffset, contentEnd) :
                appendWindow[1] + contentOffset;
        }
        else if (contentEnd !== undefined) {
            offsetedWindowEnd = contentEnd;
        }
        return { chunkInfos: offsetedChunkInfos,
            chunkOffset: offsetedSegmentOffset,
            appendWindow: [offsetedWindowStart, offsetedWindowEnd] };
    }
    var audioPipeline = {
        loadSegment: function (url, content, cancelToken, callbacks) {
            var segment = content.segment;
            var audio = getTransportPipelinesFromSegment(segment).audio;
            var ogContent = getOriginalContent(segment);
            return audio.loadSegment(url, ogContent, cancelToken, callbacks);
        },
        parseSegment: function (loadedSegment, content, initTimescale) {
            var segment = content.segment;
            var _a = getMetaPlaylistPrivateInfos(segment), contentStart = _a.contentStart, contentEnd = _a.contentEnd;
            var audio = getTransportPipelinesFromSegment(segment).audio;
            var ogContent = getOriginalContent(segment);
            var parsed = audio.parseSegment(loadedSegment, ogContent, initTimescale);
            if (parsed.segmentType === "init") {
                return parsed;
            }
            var timeInfos = offsetTimeInfos(contentStart, contentEnd, parsed);
            return objectAssign({}, parsed, timeInfos);
        },
    };
    var videoPipeline = {
        loadSegment: function (url, content, cancelToken, callbacks) {
            var segment = content.segment;
            var video = getTransportPipelinesFromSegment(segment).video;
            var ogContent = getOriginalContent(segment);
            return video.loadSegment(url, ogContent, cancelToken, callbacks);
        },
        parseSegment: function (loadedSegment, content, initTimescale) {
            var segment = content.segment;
            var _a = getMetaPlaylistPrivateInfos(segment), contentStart = _a.contentStart, contentEnd = _a.contentEnd;
            var video = getTransportPipelinesFromSegment(segment).video;
            var ogContent = getOriginalContent(segment);
            var parsed = video.parseSegment(loadedSegment, ogContent, initTimescale);
            if (parsed.segmentType === "init") {
                return parsed;
            }
            var timeInfos = offsetTimeInfos(contentStart, contentEnd, parsed);
            return objectAssign({}, parsed, timeInfos);
        },
    };
    var textTrackPipeline = {
        loadSegment: function (url, content, cancelToken, callbacks) {
            var segment = content.segment;
            var text = getTransportPipelinesFromSegment(segment).text;
            var ogContent = getOriginalContent(segment);
            return text.loadSegment(url, ogContent, cancelToken, callbacks);
        },
        parseSegment: function (loadedSegment, content, initTimescale) {
            var segment = content.segment;
            var _a = getMetaPlaylistPrivateInfos(segment), contentStart = _a.contentStart, contentEnd = _a.contentEnd;
            var text = getTransportPipelinesFromSegment(segment).text;
            var ogContent = getOriginalContent(segment);
            var parsed = text.parseSegment(loadedSegment, ogContent, initTimescale);
            if (parsed.segmentType === "init") {
                return parsed;
            }
            var timeInfos = offsetTimeInfos(contentStart, contentEnd, parsed);
            return objectAssign({}, parsed, timeInfos);
        },
    };
    var imageTrackPipeline = {
        loadSegment: function (url, content, cancelToken, callbacks) {
            var segment = content.segment;
            var image = getTransportPipelinesFromSegment(segment).image;
            var ogContent = getOriginalContent(segment);
            return image.loadSegment(url, ogContent, cancelToken, callbacks);
        },
        parseSegment: function (loadedSegment, content, initTimescale) {
            var segment = content.segment;
            var _a = getMetaPlaylistPrivateInfos(segment), contentStart = _a.contentStart, contentEnd = _a.contentEnd;
            var image = getTransportPipelinesFromSegment(segment).image;
            var ogContent = getOriginalContent(segment);
            var parsed = image.parseSegment(loadedSegment, ogContent, initTimescale);
            if (parsed.segmentType === "init") {
                return parsed;
            }
            var timeInfos = offsetTimeInfos(contentStart, contentEnd, parsed);
            return objectAssign({}, parsed, timeInfos);
        },
    };
    return { manifest: manifestPipeline,
        audio: audioPipeline,
        video: videoPipeline,
        text: textTrackPipeline,
        image: imageTrackPipeline };
}
