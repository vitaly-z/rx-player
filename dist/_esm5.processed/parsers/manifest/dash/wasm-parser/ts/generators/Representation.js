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
import noop from "../../../../../../utils/noop";
import { parseString } from "../utils";
import { generateBaseUrlAttrParser } from "./BaseURL";
import { generateSchemeAttrParser } from "./Scheme";
import { generateSegmentBaseAttrParser } from "./SegmentBase";
import { generateSegmentListChildrenParser } from "./SegmentList";
import { generateSegmentTemplateAttrParser } from "./SegmentTemplate";
/**
 * Generate a "children parser" once inside a `Representation` node.
 * @param {Object} childrenObj
 * @param {WebAssembly.Memory} linearMemory
 * @param {ParsersStack} parsersStack
 * @returns {Function}
 */
export function generateRepresentationChildrenParser(childrenObj, linearMemory, parsersStack) {
    return function onRootChildren(nodeId) {
        switch (nodeId) {
            case 15 /* BaseURL */: {
                var baseUrl = { value: "", attributes: {} };
                childrenObj.baseURLs.push(baseUrl);
                parsersStack.pushParsers(nodeId, noop, generateBaseUrlAttrParser(baseUrl, linearMemory));
                break;
            }
            case 19 /* InbandEventStream */: {
                var inbandEvent = {};
                if (childrenObj.inbandEventStreams === undefined) {
                    childrenObj.inbandEventStreams = [];
                }
                childrenObj.inbandEventStreams.push(inbandEvent);
                parsersStack.pushParsers(nodeId, noop, generateSchemeAttrParser(inbandEvent, linearMemory));
                break;
            }
            case 17 /* SegmentBase */: {
                var segmentBaseObj = {};
                childrenObj.segmentBase = segmentBaseObj;
                var attributeParser = generateSegmentBaseAttrParser(segmentBaseObj, linearMemory);
                parsersStack.pushParsers(nodeId, noop, attributeParser);
                break;
            }
            case 18 /* SegmentList */: {
                var segmentListObj = { list: [] };
                childrenObj.segmentList = segmentListObj;
                var childrenParser = generateSegmentListChildrenParser(segmentListObj, linearMemory, parsersStack);
                // Re-use SegmentBase attribute parse as we should have the same attributes
                var attributeParser = generateSegmentBaseAttrParser(segmentListObj, linearMemory);
                parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
                break;
            }
            case 16 /* SegmentTemplate */: {
                var stObj = {};
                childrenObj.segmentTemplate = stObj;
                parsersStack.pushParsers(nodeId, noop, // SegmentTimeline as treated like an attribute
                generateSegmentTemplateAttrParser(stObj, linearMemory));
                break;
            }
        }
    };
}
/**
 * @param {Object} representationAttrs
 * @param {WebAssembly.Memory} linearMemory
 * @returns {Function}
 */
export function generateRepresentationAttrParser(representationAttrs, linearMemory) {
    var textDecoder = new TextDecoder();
    return function onRepresentationAttribute(attr, ptr, len) {
        var dataView = new DataView(linearMemory.buffer);
        switch (attr) {
            case 0 /* Id */:
                representationAttrs.id = parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 3 /* AudioSamplingRate */:
                representationAttrs.audioSamplingRate =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 63 /* Bitrate */:
                representationAttrs.bitrate = dataView.getFloat64(ptr, true);
                break;
            case 4 /* Codecs */:
                representationAttrs.codecs =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 5 /* CodingDependency */:
                representationAttrs.codingDependency =
                    new DataView(linearMemory.buffer).getUint8(0) === 0;
                break;
            case 6 /* FrameRate */:
                representationAttrs.frameRate =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 7 /* Height */:
                representationAttrs.height = dataView.getFloat64(ptr, true);
                break;
            case 8 /* Width */:
                representationAttrs.width = dataView.getFloat64(ptr, true);
                break;
            case 9 /* MaxPlayoutRate */:
                representationAttrs.maxPlayoutRate = dataView.getFloat64(ptr, true);
                break;
            case 10 /* MaxSAPPeriod */:
                representationAttrs.maximumSAPPeriod = dataView.getFloat64(ptr, true);
                break;
            case 11 /* MimeType */:
                representationAttrs.mimeType =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 2 /* Profiles */:
                representationAttrs.profiles =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 65 /* QualityRanking */:
                representationAttrs.qualityRanking = dataView.getFloat64(ptr, true);
                break;
            case 12 /* SegmentProfiles */:
                representationAttrs.segmentProfiles =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
        }
    };
}
