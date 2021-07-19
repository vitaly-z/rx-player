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
import {
  IAdaptationSetChildren,
  // IEventStreamIntermediateRepresentation,
  IPeriodAttributes,
  IPeriodChildren,
} from "../../../node_parser_types";
import ParsersStack, {
  IChildrenParser,
} from "../parsers_stack";
import {
  AttributeName,
  TagName,
} from "../types";
import { readEncodedString } from "../utils";
import {
  decodeAdaptationSetAttributes,
  generateAdaptationSetChildrenParser,
} from "./AdaptationSet";
import { decodeBaseUrl } from "./BaseURL";
// import {
//   generateEventStreamAttrParser,
//   generateEventStreamChildrenParser,
// } from "./EventStream";
// import { generateSegmentTemplateAttrParser } from "./SegmentTemplate";

/**
 * Generate a "children parser" once inside a `Perod` node.
 * @param {Object} periodChildren
 * @param {WebAssembly.Memory} linearMemory
 * @param {ParsersStack} parsersStack
 * @param {ArrayBuffer} fullMpd
 * @returns {Function}
 */
export function generatePeriodChildrenParser(
  periodChildren : IPeriodChildren,
  linearMemory : WebAssembly.Memory,
  parsersStack : ParsersStack,
  _fullMpd : ArrayBuffer
)  : IChildrenParser {
  return function onRootChildren(
    nodeId : number,
    attrPtr : number,
    attrLen : number
  ) {
    switch (nodeId) {

      case TagName.AdaptationSet: {
        const adapChildren : IAdaptationSetChildren = { baseURLs: [],
                                                        representations: [] };
        const childrenParser = generateAdaptationSetChildrenParser(adapChildren,
                                                                   linearMemory,
                                                                   parsersStack);
        const adapAttrs = decodeAdaptationSetAttributes(linearMemory, attrPtr, attrLen);
        const adaptationObj = { children: adapChildren,
                                attributes: adapAttrs };
        periodChildren.adaptations.push(adaptationObj);
        parsersStack.pushParser(nodeId, childrenParser);
        break;
      }

      case TagName.BaseURL: {
        const baseUrl = decodeBaseUrl(linearMemory, attrPtr, attrLen);
        periodChildren.baseURLs.push(baseUrl);
        parsersStack.pushParser(nodeId, noop); // BaseURL have no children
        break;
      }

      // case TagName.EventStream: {
      //   const eventStream : IEventStreamIntermediateRepresentation =
      //     { children: { events: [] }, attributes: {} };
      //   periodChildren.eventStreams.push(eventStream);
      //   const childrenParser = generateEventStreamChildrenParser(eventStream.children,
      //                                                            linearMemory,
      //                                                            parsersStack,
      //                                                            fullMpd);
      //   const attrParser = generateEventStreamAttrParser(eventStream.attributes,
      //                                                    linearMemory);
      //   parsersStack.pushParsers(nodeId, childrenParser, attrParser);
      //   break;
      // }

      // case TagName.SegmentTemplate: {
      //   const stObj = {};
      //   periodChildren.segmentTemplate = stObj;
      //   parsersStack.pushParsers(nodeId,
      //                            noop, // SegmentTimeline as treated like an attribute
      //               generateSegmentTemplateAttrParser(stObj, linearMemory));
      //   break;
      // }

      default:
        // Allows to make sure we're not mistakenly closing a re-opened
        // tag.
        parsersStack.pushParser(nodeId, noop);
        break;
    }
  };
}

export function decodePeriodAttributes(
  linearMemory : WebAssembly.Memory,
  ptr : number,
  len : number
)  : IPeriodAttributes {
  const periodAttrs : IPeriodAttributes = {};
  const textDecoder = new TextDecoder();
  const dv = new DataView(linearMemory.buffer);

  let offset = ptr;
  const max = ptr + len;
  while (offset < max) {
    const attr = dv.getUint8(offset);
    offset += 1;
    switch (attr) {

      case AttributeName.Id: {
        const [id, newOffset] = readEncodedString(textDecoder, dv, offset);
        periodAttrs.id = id;
        offset = newOffset;
        break ;
      }

      case AttributeName.Start:
        periodAttrs.start = dv.getFloat64(ptr, true);
        offset += 8;
        break;

      case AttributeName.Duration:
        periodAttrs.duration = dv.getFloat64(ptr, true);
        offset += 8;
        break;

      case AttributeName.BitstreamSwitching:
        periodAttrs.bitstreamSwitching = dv.getUint8(0) === 0;
        offset += 1;
        break;

      case AttributeName.XLinkActuate: {
        const [xlinkActuate, newOffset] = readEncodedString(textDecoder, dv, offset);
        periodAttrs.xlinkActuate = xlinkActuate;
        offset = newOffset;
        break ;
      }

      case AttributeName.XLinkHref: {
        const [xlinkHref, newOffset] = readEncodedString(textDecoder, dv, offset);
        periodAttrs.xlinkHref = xlinkHref;
        offset = newOffset;
        break ;
      }

      default: throw new Error("Unexpected Period attribute.");
    }
  }
  return periodAttrs;
}
