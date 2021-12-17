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
import { generatePeriodAttrParser, generatePeriodChildrenParser, } from "./Period";
import { generateSchemeAttrParser } from "./Scheme";
/**
 * Generate a "children parser" once inside an `MPD` node.
 * @param {Object} mpdChildren
 * @param {WebAssembly.Memory} linearMemory
 * @param {ParsersStack} parsersStack
 * @param {ArrayBuffer} fullMpd
 * @returns {Function}
 */
export function generateMPDChildrenParser(mpdChildren, linearMemory, parsersStack, fullMpd) {
    return function onRootChildren(nodeId) {
        switch (nodeId) {
            case 15 /* BaseURL */: {
                var baseUrl = { value: "", attributes: {} };
                mpdChildren.baseURLs.push(baseUrl);
                var childrenParser = noop; // BaseURL have no sub-element
                var attributeParser = generateBaseUrlAttrParser(baseUrl, linearMemory);
                parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
                break;
            }
            case 2 /* Period */: {
                var period = { children: { adaptations: [],
                        baseURLs: [],
                        eventStreams: [] },
                    attributes: {} };
                mpdChildren.periods.push(period);
                var childrenParser = generatePeriodChildrenParser(period.children, linearMemory, parsersStack, fullMpd);
                var attributeParser = generatePeriodAttrParser(period.attributes, linearMemory);
                parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
                break;
            }
            case 3 /* UtcTiming */: {
                var utcTiming = {};
                mpdChildren.utcTimings.push(utcTiming);
                var childrenParser = noop; // UTCTiming have no sub-element
                var attributeParser = generateSchemeAttrParser(utcTiming, linearMemory);
                parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
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
export function generateMPDAttrParser(mpdChildren, mpdAttrs, linearMemory) {
    var dataView;
    var textDecoder = new TextDecoder();
    return function onMPDAttribute(attr, ptr, len) {
        switch (attr) {
            case 0 /* Id */:
                mpdAttrs.id = parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 2 /* Profiles */:
                mpdAttrs.profiles = parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 33 /* Type */:
                mpdAttrs.type = parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 34 /* AvailabilityStartTime */:
                var startTime = parseString(textDecoder, linearMemory.buffer, ptr, len);
                mpdAttrs.availabilityStartTime = new Date(startTime).getTime() / 1000;
                break;
            case 35 /* AvailabilityEndTime */:
                var endTime = parseString(textDecoder, linearMemory.buffer, ptr, len);
                mpdAttrs.availabilityEndTime = new Date(endTime).getTime() / 1000;
                break;
            case 36 /* PublishTime */:
                var publishTime = parseString(textDecoder, linearMemory.buffer, ptr, len);
                mpdAttrs.publishTime = new Date(publishTime).getTime() / 1000;
                break;
            case 68 /* MediaPresentationDuration */:
                dataView = new DataView(linearMemory.buffer);
                mpdAttrs.duration = dataView.getFloat64(ptr, true);
                break;
            case 37 /* MinimumUpdatePeriod */:
                dataView = new DataView(linearMemory.buffer);
                mpdAttrs.minimumUpdatePeriod = dataView.getFloat64(ptr, true);
                break;
            case 38 /* MinBufferTime */:
                dataView = new DataView(linearMemory.buffer);
                mpdAttrs.minBufferTime = dataView.getFloat64(ptr, true);
                break;
            case 39 /* TimeShiftBufferDepth */:
                dataView = new DataView(linearMemory.buffer);
                mpdAttrs.timeShiftBufferDepth = dataView.getFloat64(ptr, true);
                break;
            case 40 /* SuggestedPresentationDelay */:
                dataView = new DataView(linearMemory.buffer);
                mpdAttrs.suggestedPresentationDelay = dataView.getFloat64(ptr, true);
                break;
            case 41 /* MaxSegmentDuration */:
                dataView = new DataView(linearMemory.buffer);
                mpdAttrs.maxSegmentDuration = dataView.getFloat64(ptr, true);
                break;
            case 42 /* MaxSubsegmentDuration */:
                dataView = new DataView(linearMemory.buffer);
                mpdAttrs.maxSubsegmentDuration = dataView.getFloat64(ptr, true);
                break;
            case 66 /* Location */:
                var location_1 = parseString(textDecoder, linearMemory.buffer, ptr, len);
                mpdChildren.locations.push(location_1);
                break;
            case 70 /* Namespace */:
                var xmlNs = { key: "", value: "" };
                dataView = new DataView(linearMemory.buffer);
                var offset = ptr;
                var keySize = dataView.getUint32(offset);
                offset += 4;
                xmlNs.key = parseString(textDecoder, linearMemory.buffer, offset, keySize);
                offset += keySize;
                var valSize = dataView.getUint32(offset);
                offset += 4;
                xmlNs.value = parseString(textDecoder, linearMemory.buffer, offset, valSize);
                if (mpdAttrs.namespaces === undefined) {
                    mpdAttrs.namespaces = [xmlNs];
                }
                else {
                    mpdAttrs.namespaces.push(xmlNs);
                }
                break;
        }
    };
}
