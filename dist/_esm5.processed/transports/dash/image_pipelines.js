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
import features from "../../features";
import request from "../../utils/request";
import takeFirstSet from "../../utils/take_first_set";
/**
 * Loads an image segment.
 * @param {string|null} url
 * @param {Object} content
 * @param {Object} cancelSignal
 * @param {Object} callbacks
 * @returns {Promise}
 */
export function imageLoader(url, content, cancelSignal, callbacks) {
    return __awaiter(this, void 0, void 0, function () {
        var segment, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    segment = content.segment;
                    if (segment.isInit || url === null) {
                        return [2 /*return*/, { resultType: "segment-created",
                                resultData: null }];
                    }
                    return [4 /*yield*/, request({ url: url, responseType: "arraybuffer",
                            onProgress: callbacks.onProgress, cancelSignal: cancelSignal })];
                case 1:
                    data = _a.sent();
                    return [2 /*return*/, { resultType: "segment-loaded",
                            resultData: data }];
            }
        });
    });
}
/**
 * Parses an image segment.
 * @param {Object} loadedSegment
 * @param {Object} content
 * @returns {Object}
 */
export function imageParser(loadedSegment, content) {
    var segment = content.segment, period = content.period;
    var data = loadedSegment.data, isChunked = loadedSegment.isChunked;
    if (content.segment.isInit) { // image init segment has no use
        return { segmentType: "init",
            initializationData: null,
            initializationDataSize: 0,
            protectionDataUpdate: false,
            initTimescale: undefined };
    }
    if (isChunked) {
        throw new Error("Image data should not be downloaded in chunks");
    }
    var chunkOffset = takeFirstSet(segment.timestampOffset, 0);
    // TODO image Parsing should be more on the buffer side, no?
    if (data === null || features.imageParser === null) {
        return { segmentType: "media",
            chunkData: null,
            chunkSize: 0,
            chunkInfos: { duration: segment.duration,
                time: segment.time }, chunkOffset: chunkOffset, protectionDataUpdate: false,
            appendWindow: [period.start, period.end] };
    }
    var bifObject = features.imageParser(new Uint8Array(data));
    var thumbsData = bifObject.thumbs;
    return { segmentType: "media",
        chunkData: { data: thumbsData,
            start: 0,
            end: Number.MAX_VALUE,
            timescale: 1,
            type: "bif" },
        chunkSize: undefined,
        chunkInfos: { time: 0,
            duration: Number.MAX_VALUE }, chunkOffset: chunkOffset, protectionDataUpdate: false,
        appendWindow: [period.start, period.end] };
}
