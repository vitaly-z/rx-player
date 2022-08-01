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
import log from "../../log";
import { getMDAT } from "../../parsers/containers/isobmff";
import { utf8ToStr } from "../../utils/string_parsing";
/**
 * Return plain text text track from the given ISOBMFF.
 * @param {Uint8Array} chunkBytes
 * @returns {string}
 */
export function extractTextTrackFromISOBMFF(chunkBytes) {
    var mdat = getMDAT(chunkBytes);
    return mdat === null ? "" :
        utf8ToStr(mdat);
}
/**
 * Returns the a string expliciting the format of a text track when that text
 * track is embedded into a ISOBMFF file.
 * @param {Object} representation
 * @returns {string}
 */
export function getISOBMFFTextTrackFormat(representation) {
    var codec = representation.codec;
    if (codec === undefined) {
        throw new Error("Cannot parse subtitles: unknown format");
    }
    switch (codec.toLowerCase()) {
        case "stpp": // stpp === TTML in MP4
        case "stpp.ttml.im1t":
            return "ttml";
        case "wvtt": // wvtt === WebVTT in MP4
            return "vtt";
    }
    throw new Error("The codec used for the subtitles " +
        "\"".concat(codec, "\" is not managed yet."));
}
/**
 * Returns the a string expliciting the format of a text track in plain text.
 * @param {Object} representation
 * @returns {string}
 */
export function getPlainTextTrackFormat(representation) {
    var _a = representation.mimeType, mimeType = _a === void 0 ? "" : _a;
    switch (representation.mimeType) {
        case "application/ttml+xml":
            return "ttml";
        case "application/x-sami":
        case "application/smil":
            return "sami";
        case "text/vtt":
            return "vtt";
    }
    var _b = representation.codec, codec = _b === void 0 ? "" : _b;
    var codeLC = codec.toLowerCase();
    if (codeLC === "srt") {
        return "srt";
    }
    throw new Error("could not find a text-track parser for the type ".concat(mimeType));
}
/**
 * @param {Object} content
 * @param {ArrayBuffer|UInt8Array|null} chunkData
 * @param {Object|null} chunkInfos
 * @param {boolean} isChunked
 * @returns {Object|null}
 */
export function getISOBMFFEmbeddedTextTrackData(_a, chunkBytes, chunkInfos, isChunked) {
    var segment = _a.segment, adaptation = _a.adaptation, representation = _a.representation;
    if (segment.isInit) {
        return null;
    }
    var startTime;
    var endTime;
    if (chunkInfos === null) {
        if (!isChunked) {
            log.warn("Transport: Unavailable time data for current text track.");
        }
        else {
            startTime = segment.time;
            endTime = segment.end;
        }
    }
    else {
        startTime = chunkInfos.time;
        if (chunkInfos.duration !== undefined) {
            endTime = startTime + chunkInfos.duration;
        }
        else if (!isChunked && segment.complete) {
            endTime = startTime + segment.duration;
        }
    }
    var type = getISOBMFFTextTrackFormat(representation);
    var textData = extractTextTrackFromISOBMFF(chunkBytes);
    return { data: textData, type: type, language: adaptation.language,
        start: startTime,
        end: endTime };
}
/**
 * @param {Object} content
 * @param {ArrayBuffer|UInt8Array|null} chunkData
 * @param {Object|null} chunkInfos
 * @param {boolean} isChunked
 * @returns {Object|null}
 */
export function getPlainTextTrackData(_a, textTrackData, isChunked) {
    var segment = _a.segment, adaptation = _a.adaptation, representation = _a.representation;
    if (segment.isInit) {
        return null;
    }
    var start;
    var end;
    if (isChunked) {
        log.warn("Transport: Unavailable time data for current text track.");
    }
    else {
        start = segment.time;
        if (segment.complete) {
            end = segment.time + segment.duration;
        }
    }
    var type = getPlainTextTrackFormat(representation);
    return { data: textTrackData, type: type, language: adaptation.language, start: start, end: end };
}
