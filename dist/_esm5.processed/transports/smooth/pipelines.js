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
import PPromise from "pinkie";
import features from "../../features";
import log from "../../log";
import Manifest from "../../manifest";
import { getMDAT } from "../../parsers/containers/isobmff";
import createSmoothManifestParser, { SmoothRepresentationIndex, } from "../../parsers/manifest/smooth";
import request from "../../utils/request";
import { strToUtf8, utf8ToStr, } from "../../utils/string_parsing";
import warnOnce from "../../utils/warn_once";
import checkISOBMFFIntegrity from "../utils/check_isobmff_integrity";
import generateManifestLoader from "../utils/generate_manifest_loader";
import extractTimingsInfos from "./extract_timings_infos";
import { patchSegment } from "./isobmff";
import generateSegmentLoader from "./segment_loader";
import { extractISML, extractToken, isMP4EmbeddedTrack, replaceToken, resolveManifest, } from "./utils";
var WSX_REG = /\.wsx?(\?token=\S+)?/;
/**
 * @param {Object} adaptation
 * @param {Object} dlSegment
 * @param {Object} nextSegments
 */
function addNextSegments(adaptation, nextSegments, dlSegment) {
    var _a;
    log.debug("Smooth Parser: update segments information.");
    var representations = adaptation.representations;
    for (var i = 0; i < representations.length; i++) {
        var representation = representations[i];
        if (representation.index instanceof SmoothRepresentationIndex &&
            ((_a = dlSegment === null || dlSegment === void 0 ? void 0 : dlSegment.privateInfos) === null || _a === void 0 ? void 0 : _a.smoothMediaSegment) !== undefined) {
            representation.index.addNewSegments(nextSegments, dlSegment.privateInfos.smoothMediaSegment);
        }
        else {
            log.warn("Smooth Parser: should only encounter SmoothRepresentationIndex");
        }
    }
}
export default function (options) {
    var smoothManifestParser = createSmoothManifestParser(options);
    var segmentLoader = generateSegmentLoader(options);
    var manifestLoaderOptions = { customManifestLoader: options.manifestLoader };
    var manifestLoader = generateManifestLoader(manifestLoaderOptions, "text");
    var manifestPipeline = {
        // TODO (v4.x.x) Remove that function
        resolveManifestUrl: function (url, cancelSignal) {
            if (url === undefined) {
                return PPromise.resolve(undefined);
            }
            var resolving;
            if (WSX_REG.test(url)) {
                warnOnce("Giving WSX URL to loadVideo is deprecated." +
                    " You should only give Manifest URLs.");
                resolving = request({ url: replaceToken(url, ""),
                    responseType: "document", cancelSignal: cancelSignal })
                    .then(function (value) {
                    var extractedURL = extractISML(value.responseData);
                    if (extractedURL === null || extractedURL.length === 0) {
                        throw new Error("Invalid ISML");
                    }
                    return extractedURL;
                });
            }
            else {
                resolving = PPromise.resolve(url);
            }
            var token = extractToken(url);
            return resolving.then(function (_url) {
                return replaceToken(resolveManifest(_url), token);
            });
        },
        loadManifest: manifestLoader,
        parseManifest: function (manifestData, parserOptions) {
            var _a;
            var url = (_a = manifestData.url) !== null && _a !== void 0 ? _a : parserOptions.originalUrl;
            var manifestReceivedTime = manifestData.receivedTime, responseData = manifestData.responseData;
            var documentData = typeof responseData === "string" ?
                new DOMParser().parseFromString(responseData, "text/xml") :
                responseData; // TODO find a way to check if Document?
            var parserResult = smoothManifestParser(documentData, url, manifestReceivedTime);
            var manifest = new Manifest(parserResult, {
                representationFilter: options.representationFilter,
                supplementaryImageTracks: options.supplementaryImageTracks,
                supplementaryTextTracks: options.supplementaryTextTracks,
            });
            return { manifest: manifest, url: url };
        },
    };
    /**
     * Export functions allowing to load and parse audio and video smooth
     * segments.
     */
    var audioVideoPipeline = {
        /**
         * Load a Smooth audio/video segment.
         * @param {string|null} url
         * @param {Object} content
         * @param {Object} cancelSignal
         * @param {Object} callbacks
         * @returns {Promise}
         */
        loadSegment: function (url, content, cancelSignal, callbacks) {
            return segmentLoader(url, content, cancelSignal, callbacks);
        },
        parseSegment: function (loadedSegment, content, initTimescale) {
            var _a, _b;
            var segment = content.segment, adaptation = content.adaptation, manifest = content.manifest;
            var data = loadedSegment.data, isChunked = loadedSegment.isChunked;
            if (data === null) {
                if (segment.isInit) {
                    return { segmentType: "init",
                        initializationData: null,
                        protectionDataUpdate: false,
                        initTimescale: undefined };
                }
                return { segmentType: "media",
                    chunkData: null,
                    chunkInfos: null,
                    chunkOffset: 0,
                    protectionDataUpdate: false,
                    appendWindow: [undefined, undefined] };
            }
            var responseBuffer = data instanceof Uint8Array ? data :
                new Uint8Array(data);
            if (segment.isInit) {
                var timescale = (_b = (_a = segment.privateInfos) === null || _a === void 0 ? void 0 : _a.smoothInitSegment) === null || _b === void 0 ? void 0 : _b.timescale;
                return { segmentType: "init",
                    initializationData: data,
                    // smooth init segments are crafted by hand.
                    // Their timescale is the one from the manifest.
                    initTimescale: timescale,
                    protectionDataUpdate: false };
            }
            var timingInfos = initTimescale !== undefined ?
                extractTimingsInfos(responseBuffer, isChunked, initTimescale, segment, manifest.isLive) :
                null;
            if (timingInfos === null ||
                timingInfos.chunkInfos === null ||
                timingInfos.scaledSegmentTime === undefined) {
                throw new Error("Smooth Segment without time information");
            }
            var nextSegments = timingInfos.nextSegments, chunkInfos = timingInfos.chunkInfos, scaledSegmentTime = timingInfos.scaledSegmentTime;
            var chunkData = patchSegment(responseBuffer, scaledSegmentTime);
            if (nextSegments.length > 0) {
                addNextSegments(adaptation, nextSegments, segment);
            }
            return { segmentType: "media", chunkData: chunkData, chunkInfos: chunkInfos, chunkOffset: 0,
                protectionDataUpdate: false,
                appendWindow: [undefined, undefined] };
        },
    };
    var textTrackPipeline = {
        loadSegment: function (url, content, cancelSignal, callbacks) {
            var segment = content.segment, representation = content.representation;
            if (segment.isInit || url === null) {
                return PPromise.resolve({ resultType: "segment-created",
                    resultData: null });
            }
            var isMP4 = isMP4EmbeddedTrack(representation);
            if (!isMP4) {
                return request({ url: url, responseType: "text", cancelSignal: cancelSignal, onProgress: callbacks.onProgress })
                    .then(function (data) { return ({ resultType: "segment-loaded",
                    resultData: data }); });
            }
            else {
                return request({ url: url, responseType: "arraybuffer", cancelSignal: cancelSignal, onProgress: callbacks.onProgress })
                    .then(function (data) {
                    if (options.checkMediaSegmentIntegrity !== true) {
                        return { resultType: "segment-loaded",
                            resultData: data };
                    }
                    var dataU8 = new Uint8Array(data.responseData);
                    checkISOBMFFIntegrity(dataU8, content.segment.isInit);
                    return { resultType: "segment-loaded",
                        resultData: __assign(__assign({}, data), { responseData: dataU8 }) };
                });
            }
        },
        parseSegment: function (loadedSegment, content, initTimescale) {
            var _a;
            var manifest = content.manifest, adaptation = content.adaptation, representation = content.representation, segment = content.segment;
            var language = adaptation.language;
            var isMP4 = isMP4EmbeddedTrack(representation);
            var _b = representation.mimeType, mimeType = _b === void 0 ? "" : _b, _c = representation.codec, codec = _c === void 0 ? "" : _c;
            var data = loadedSegment.data, isChunked = loadedSegment.isChunked;
            if (segment.isInit) { // text init segment has no use in HSS
                return { segmentType: "init",
                    initializationData: null,
                    protectionDataUpdate: false,
                    initTimescale: undefined };
            }
            if (data === null) {
                return { segmentType: "media",
                    chunkData: null,
                    chunkInfos: null,
                    chunkOffset: 0,
                    protectionDataUpdate: false,
                    appendWindow: [undefined, undefined] };
            }
            var nextSegments;
            var chunkInfos = null;
            var segmentStart;
            var segmentEnd;
            var _sdData;
            var _sdType;
            if (isMP4) {
                var chunkBytes = void 0;
                if (typeof data === "string") {
                    chunkBytes = strToUtf8(data);
                }
                else {
                    chunkBytes = data instanceof Uint8Array ? data :
                        new Uint8Array(data);
                }
                var timingInfos = initTimescale !== undefined ?
                    extractTimingsInfos(chunkBytes, isChunked, initTimescale, segment, manifest.isLive) :
                    null;
                nextSegments = timingInfos === null || timingInfos === void 0 ? void 0 : timingInfos.nextSegments;
                chunkInfos = (_a = timingInfos === null || timingInfos === void 0 ? void 0 : timingInfos.chunkInfos) !== null && _a !== void 0 ? _a : null;
                if (chunkInfos === null) {
                    if (isChunked) {
                        log.warn("Smooth: Unavailable time data for current text track.");
                    }
                    else {
                        segmentStart = segment.time;
                        segmentEnd = segment.end;
                    }
                }
                else {
                    segmentStart = chunkInfos.time;
                    segmentEnd = chunkInfos.duration !== undefined ?
                        chunkInfos.time + chunkInfos.duration :
                        segment.end;
                }
                var lcCodec = codec.toLowerCase();
                if (mimeType === "application/ttml+xml+mp4" ||
                    lcCodec === "stpp" ||
                    lcCodec === "stpp.ttml.im1t") {
                    _sdType = "ttml";
                }
                else if (lcCodec === "wvtt") {
                    _sdType = "vtt";
                }
                else {
                    throw new Error("could not find a text-track parser for the type " + mimeType);
                }
                var mdat = getMDAT(chunkBytes);
                _sdData = mdat === null ? "" :
                    utf8ToStr(mdat);
            }
            else { // not MP4
                segmentStart = segment.time;
                segmentEnd = segment.end;
                var chunkString = void 0;
                if (typeof data !== "string") {
                    var bytesData = data instanceof Uint8Array ? data :
                        new Uint8Array(data);
                    chunkString = utf8ToStr(bytesData);
                }
                else {
                    chunkString = data;
                }
                switch (mimeType) {
                    case "application/x-sami":
                    case "application/smil": // TODO SMIL should be its own format, no?
                        _sdType = "sami";
                        break;
                    case "application/ttml+xml":
                        _sdType = "ttml";
                        break;
                    case "text/vtt":
                        _sdType = "vtt";
                        break;
                }
                if (_sdType === undefined) {
                    var lcCodec = codec.toLowerCase();
                    if (lcCodec === "srt") {
                        _sdType = "srt";
                    }
                    else {
                        throw new Error("could not find a text-track parser for the type " + mimeType);
                    }
                }
                _sdData = chunkString;
            }
            if (chunkInfos !== null &&
                Array.isArray(nextSegments) && nextSegments.length > 0) {
                addNextSegments(adaptation, nextSegments, segment);
            }
            var chunkOffset = segmentStart !== null && segmentStart !== void 0 ? segmentStart : 0;
            return { segmentType: "media",
                chunkData: { type: _sdType,
                    data: _sdData,
                    start: segmentStart,
                    end: segmentEnd, language: language }, chunkInfos: chunkInfos, chunkOffset: chunkOffset, protectionDataUpdate: false,
                appendWindow: [undefined, undefined] };
        },
    };
    var imageTrackPipeline = {
        loadSegment: function (url, content, cancelSignal, callbacks) {
            if (content.segment.isInit || url === null) {
                // image do not need an init segment. Passthrough directly to the parser
                return PPromise.resolve({ resultType: "segment-created",
                    resultData: null });
            }
            return request({ url: url, responseType: "arraybuffer",
                onProgress: callbacks.onProgress, cancelSignal: cancelSignal })
                .then(function (data) { return ({ resultType: "segment-loaded",
                resultData: data }); });
        },
        parseSegment: function (loadedSegment, content, _initTimescale) {
            var data = loadedSegment.data, isChunked = loadedSegment.isChunked;
            if (content.segment.isInit) { // image init segment has no use
                return { segmentType: "init",
                    initializationData: null,
                    protectionDataUpdate: false,
                    initTimescale: undefined };
            }
            if (isChunked) {
                throw new Error("Image data should not be downloaded in chunks");
            }
            // TODO image Parsing should be more on the buffer side, no?
            if (data === null || features.imageParser === null) {
                return { segmentType: "media",
                    chunkData: null,
                    chunkInfos: null,
                    chunkOffset: 0,
                    protectionDataUpdate: false,
                    appendWindow: [undefined, undefined] };
            }
            var bifObject = features.imageParser(new Uint8Array(data));
            var thumbsData = bifObject.thumbs;
            return { segmentType: "media",
                chunkData: { data: thumbsData,
                    start: 0,
                    end: Number.MAX_VALUE,
                    timescale: 1,
                    type: "bif" },
                chunkInfos: { time: 0,
                    duration: Number.MAX_VALUE },
                chunkOffset: 0,
                protectionDataUpdate: false,
                appendWindow: [undefined, undefined] };
        },
    };
    return { manifest: manifestPipeline,
        audio: audioVideoPipeline,
        video: audioVideoPipeline,
        text: textTrackPipeline,
        image: imageTrackPipeline };
}
