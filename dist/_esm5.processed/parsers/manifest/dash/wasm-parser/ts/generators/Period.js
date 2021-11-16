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
import { generateAdaptationSetAttrParser, generateAdaptationSetChildrenParser, } from "./AdaptationSet";
import { generateBaseUrlAttrParser } from "./BaseURL";
import { generateEventStreamAttrParser, generateEventStreamChildrenParser, } from "./EventStream";
import { generateSegmentTemplateAttrParser } from "./SegmentTemplate";
/**
 * Generate a "children parser" once inside a `Perod` node.
 * @param {Object} periodChildren
 * @param {WebAssembly.Memory} linearMemory
 * @param {ParsersStack} parsersStack
 * @param {ArrayBuffer} fullMpd
 * @returns {Function}
 */
export function generatePeriodChildrenParser(periodChildren, linearMemory, parsersStack, fullMpd) {
    return function onRootChildren(nodeId) {
        switch (nodeId) {
            case 4 /* AdaptationSet */: {
                var adaptationObj = { children: { baseURLs: [],
                        representations: [] },
                    attributes: {} };
                periodChildren.adaptations.push(adaptationObj);
                var childrenParser = generateAdaptationSetChildrenParser(adaptationObj.children, linearMemory, parsersStack);
                var attributeParser = generateAdaptationSetAttrParser(adaptationObj.attributes, linearMemory);
                parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
                break;
            }
            case 15 /* BaseURL */: {
                var baseUrl = { value: "", attributes: {} };
                periodChildren.baseURLs.push(baseUrl);
                var childrenParser = noop;
                var attributeParser = generateBaseUrlAttrParser(baseUrl, linearMemory);
                parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
                break;
            }
            case 5 /* EventStream */: {
                var eventStream = { children: { events: [] }, attributes: {} };
                periodChildren.eventStreams.push(eventStream);
                var childrenParser = generateEventStreamChildrenParser(eventStream.children, linearMemory, parsersStack, fullMpd);
                var attrParser = generateEventStreamAttrParser(eventStream.attributes, linearMemory);
                parsersStack.pushParsers(nodeId, childrenParser, attrParser);
                break;
            }
            case 16 /* SegmentTemplate */: {
                var stObj = {};
                periodChildren.segmentTemplate = stObj;
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
 * @param {Object} periodAttrs
 * @param {WebAssembly.Memory} linearMemory
 * @returns {Function}
 */
export function generatePeriodAttrParser(periodAttrs, linearMemory) {
    var textDecoder = new TextDecoder();
    return function onPeriodAttribute(attr, ptr, len) {
        switch (attr) {
            case 0 /* Id */:
                periodAttrs.id = parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 45 /* Start */:
                periodAttrs.start = new DataView(linearMemory.buffer).getFloat64(ptr, true);
                break;
            case 1 /* Duration */:
                periodAttrs.duration = new DataView(linearMemory.buffer).getFloat64(ptr, true);
                break;
            case 32 /* BitstreamSwitching */:
                periodAttrs.bitstreamSwitching =
                    new DataView(linearMemory.buffer).getUint8(0) === 0;
                break;
            case 46 /* XLinkHref */:
                periodAttrs.xlinkHref = parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 47 /* XLinkActuate */:
                periodAttrs.xlinkActuate = parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 70 /* Namespace */:
                var xmlNs = { key: "", value: "" };
                var dataView = new DataView(linearMemory.buffer);
                var offset = ptr;
                var keySize = dataView.getUint32(offset);
                offset += 4;
                xmlNs.key = parseString(textDecoder, linearMemory.buffer, offset, keySize);
                offset += keySize;
                var valSize = dataView.getUint32(offset);
                offset += 4;
                xmlNs.value = parseString(textDecoder, linearMemory.buffer, offset, valSize);
                if (periodAttrs.namespaces === undefined) {
                    periodAttrs.namespaces = [xmlNs];
                }
                else {
                    periodAttrs.namespaces.push(xmlNs);
                }
                break;
        }
    };
}
