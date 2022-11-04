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
import { parseFloatOrBool, parseString, } from "../utils";
import { generateBaseUrlAttrParser } from "./BaseURL";
import { generateContentComponentAttrParser } from "./ContentComponent";
import { generateContentProtectionAttrParser } from "./ContentProtection";
import { generateRepresentationAttrParser, generateRepresentationChildrenParser, } from "./Representation";
import { generateSchemeAttrParser } from "./Scheme";
import { generateSegmentBaseAttrParser } from "./SegmentBase";
import { generateSegmentListChildrenParser } from "./SegmentList";
import { generateSegmentTemplateAttrParser } from "./SegmentTemplate";
/**
 * Generate a "children parser" once inside a `AdaptationSet` node.
 * @param {Object} adaptationSetChildren
 * @param {WebAssembly.Memory} linearMemory
 * @param {ParsersStack} parsersStack
 * @returns {Function}
 */
export function generateAdaptationSetChildrenParser(adaptationSetChildren, linearMemory, parsersStack) {
    return function onRootChildren(nodeId) {
        switch (nodeId) {
            case 8 /* TagName.Accessibility */: {
                var accessibility = {};
                if (adaptationSetChildren.accessibilities === undefined) {
                    adaptationSetChildren.accessibilities = [];
                }
                adaptationSetChildren.accessibilities.push(accessibility);
                var schemeAttrParser = generateSchemeAttrParser(accessibility, linearMemory);
                parsersStack.pushParsers(nodeId, noop, schemeAttrParser);
                break;
            }
            case 15 /* TagName.BaseURL */: {
                var baseUrl = { value: "", attributes: {} };
                adaptationSetChildren.baseURLs.push(baseUrl);
                var attributeParser = generateBaseUrlAttrParser(baseUrl, linearMemory);
                parsersStack.pushParsers(nodeId, noop, attributeParser);
                break;
            }
            case 9 /* TagName.ContentComponent */: {
                var contentComponent = {};
                adaptationSetChildren.contentComponent = contentComponent;
                parsersStack.pushParsers(nodeId, noop, generateContentComponentAttrParser(contentComponent, linearMemory));
                break;
            }
            case 10 /* TagName.ContentProtection */: {
                var contentProtection = { children: { cencPssh: [] },
                    attributes: {} };
                if (adaptationSetChildren.contentProtections === undefined) {
                    adaptationSetChildren.contentProtections = [];
                }
                adaptationSetChildren.contentProtections.push(contentProtection);
                var contentProtAttrParser = generateContentProtectionAttrParser(contentProtection, linearMemory);
                parsersStack.pushParsers(nodeId, noop, contentProtAttrParser);
                break;
            }
            case 11 /* TagName.EssentialProperty */: {
                var essentialProperty = {};
                if (adaptationSetChildren.essentialProperties === undefined) {
                    adaptationSetChildren.essentialProperties = [];
                }
                adaptationSetChildren.essentialProperties.push(essentialProperty);
                var childrenParser = noop; // EssentialProperty have no sub-element
                var attributeParser = generateSchemeAttrParser(essentialProperty, linearMemory);
                parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
                break;
            }
            case 19 /* TagName.InbandEventStream */: {
                var inbandEvent = {};
                if (adaptationSetChildren.inbandEventStreams === undefined) {
                    adaptationSetChildren.inbandEventStreams = [];
                }
                adaptationSetChildren.inbandEventStreams.push(inbandEvent);
                var childrenParser = noop; // InbandEventStream have no sub-element
                var attributeParser = generateSchemeAttrParser(inbandEvent, linearMemory);
                parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
                break;
            }
            case 7 /* TagName.Representation */: {
                var representationObj = { children: { baseURLs: [] },
                    attributes: {} };
                adaptationSetChildren.representations.push(representationObj);
                var childrenParser = generateRepresentationChildrenParser(representationObj.children, linearMemory, parsersStack);
                var attributeParser = generateRepresentationAttrParser(representationObj.attributes, linearMemory);
                parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
                break;
            }
            case 12 /* TagName.Role */: {
                var role = {};
                if (adaptationSetChildren.roles === undefined) {
                    adaptationSetChildren.roles = [];
                }
                adaptationSetChildren.roles.push(role);
                var attributeParser = generateSchemeAttrParser(role, linearMemory);
                parsersStack.pushParsers(nodeId, noop, attributeParser);
                break;
            }
            case 13 /* TagName.SupplementalProperty */: {
                var supplementalProperty = {};
                if (adaptationSetChildren.supplementalProperties === undefined) {
                    adaptationSetChildren.supplementalProperties = [];
                }
                adaptationSetChildren.supplementalProperties.push(supplementalProperty);
                var attributeParser = generateSchemeAttrParser(supplementalProperty, linearMemory);
                parsersStack.pushParsers(nodeId, noop, attributeParser);
                break;
            }
            case 17 /* TagName.SegmentBase */: {
                var segmentBaseObj = {};
                adaptationSetChildren.segmentBase = segmentBaseObj;
                var attributeParser = generateSegmentBaseAttrParser(segmentBaseObj, linearMemory);
                parsersStack.pushParsers(nodeId, noop, attributeParser);
                break;
            }
            case 18 /* TagName.SegmentList */: {
                var segmentListObj = { list: [] };
                adaptationSetChildren.segmentList = segmentListObj;
                var childrenParser = generateSegmentListChildrenParser(segmentListObj, linearMemory, parsersStack);
                // Re-use SegmentBase attribute parse as we should have the same attributes
                var attributeParser = generateSegmentBaseAttrParser(segmentListObj, linearMemory);
                parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
                break;
            }
            case 16 /* TagName.SegmentTemplate */: {
                var stObj = {};
                adaptationSetChildren.segmentTemplate = stObj;
                parsersStack.pushParsers(nodeId, noop, // SegmentTimeline as treated like an attribute
                generateSegmentTemplateAttrParser(stObj, linearMemory));
                break;
            }
            default:
                // Allows to make sure we're not mistakenly closing a re-opened
                // tag.
                parsersStack.pushParsers(nodeId, noop, noop);
                break;
        }
    };
}
/**
 * @param {Object} adaptationAttrs
 * @param {WebAssembly.Memory} linearMemory
 * @returns {Function}
 */
export function generateAdaptationSetAttrParser(adaptationAttrs, linearMemory) {
    var textDecoder = new TextDecoder();
    return function onAdaptationSetAttribute(attr, ptr, len) {
        var dataView = new DataView(linearMemory.buffer);
        switch (attr) {
            case 0 /* AttributeName.Id */:
                adaptationAttrs.id = parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 48 /* AttributeName.Group */:
                adaptationAttrs.group = dataView.getFloat64(ptr, true);
                break;
            case 60 /* AttributeName.Language */:
                adaptationAttrs.language =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 61 /* AttributeName.ContentType */:
                adaptationAttrs.contentType =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 62 /* AttributeName.Par */:
                adaptationAttrs.par = parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 53 /* AttributeName.MinBandwidth */:
                adaptationAttrs.minBitrate = dataView.getFloat64(ptr, true);
                break;
            case 49 /* AttributeName.MaxBandwidth */:
                adaptationAttrs.maxBitrate = dataView.getFloat64(ptr, true);
                break;
            case 56 /* AttributeName.MinWidth */:
                adaptationAttrs.minWidth = dataView.getFloat64(ptr, true);
                break;
            case 52 /* AttributeName.MaxWidth */:
                adaptationAttrs.maxWidth = dataView.getFloat64(ptr, true);
                break;
            case 55 /* AttributeName.MinHeight */:
                adaptationAttrs.minHeight = dataView.getFloat64(ptr, true);
                break;
            case 51 /* AttributeName.MaxHeight */:
                adaptationAttrs.maxHeight = dataView.getFloat64(ptr, true);
                break;
            case 54 /* AttributeName.MinFrameRate */:
                adaptationAttrs.minFrameRate =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 50 /* AttributeName.MaxFrameRate */:
                adaptationAttrs.maxFrameRate =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 57 /* AttributeName.SelectionPriority */:
                adaptationAttrs.selectionPriority = dataView.getFloat64(ptr, true);
                break;
            case 58 /* AttributeName.SegmentAlignment */:
                adaptationAttrs.segmentAlignment =
                    parseFloatOrBool(dataView.getFloat64(ptr, true));
                break;
            case 59 /* AttributeName.SubsegmentAlignment */:
                adaptationAttrs.subsegmentAlignment =
                    parseFloatOrBool(dataView.getFloat64(ptr, true));
                break;
            case 32 /* AttributeName.BitstreamSwitching */:
                adaptationAttrs.bitstreamSwitching = dataView.getFloat64(ptr, true) !== 0;
                break;
            case 3 /* AttributeName.AudioSamplingRate */:
                adaptationAttrs.audioSamplingRate =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 4 /* AttributeName.Codecs */:
                adaptationAttrs.codecs =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 2 /* AttributeName.Profiles */:
                adaptationAttrs.profiles =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 12 /* AttributeName.SegmentProfiles */:
                adaptationAttrs.segmentProfiles =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 11 /* AttributeName.MimeType */:
                adaptationAttrs.mimeType =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 5 /* AttributeName.CodingDependency */:
                adaptationAttrs.codingDependency = dataView.getFloat64(ptr, true) !== 0;
                break;
            case 6 /* AttributeName.FrameRate */:
                adaptationAttrs.frameRate =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 7 /* AttributeName.Height */:
                adaptationAttrs.height = dataView.getFloat64(ptr, true);
                break;
            case 8 /* AttributeName.Width */:
                adaptationAttrs.width = dataView.getFloat64(ptr, true);
                break;
            case 9 /* AttributeName.MaxPlayoutRate */:
                adaptationAttrs.maxPlayoutRate = dataView.getFloat64(ptr, true);
                break;
            case 10 /* AttributeName.MaxSAPPeriod */:
                adaptationAttrs.maximumSAPPeriod = dataView.getFloat64(ptr, true);
                break;
            case 43 /* AttributeName.AvailabilityTimeOffset */:
                adaptationAttrs.availabilityTimeOffset = dataView.getFloat64(ptr, true);
                break;
            case 22 /* AttributeName.AvailabilityTimeComplete */:
                adaptationAttrs.availabilityTimeComplete = dataView.getUint8(0) === 0;
                break;
            case 71 /* AttributeName.Label */:
                var label = parseString(textDecoder, linearMemory.buffer, ptr, len);
                adaptationAttrs.label = label;
                break;
            // TODO
            // case AttributeName.StartsWithSap:
            //   adaptationAttrs.startsWithSap = dataView.getFloat64(ptr, true);
        }
    };
}
