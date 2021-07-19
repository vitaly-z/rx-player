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
  IAdaptationSetAttributes,
  IAdaptationSetChildren,
  // ISegmentListIntermediateRepresentation,
} from "../../../node_parser_types";
import ParsersStack, {
  IChildrenParser,
} from "../parsers_stack";
import {
  AttributeName,
  TagName,
} from "../types";
import {
  parseFloatOrBool,
  readEncodedString,
} from "../utils";
import { decodeBaseUrl } from "./BaseURL";
import { decodeContentComponentAttributes } from "./ContentComponent";
import { decodeContentProtection } from "./ContentProtection";
// import {
//   generateRepresentationAttrParser,
//   generateRepresentationChildrenParser,
// } from "./Representation";
import { decodeScheme } from "./Scheme";
// import { generateSegmentBaseAttrParser } from "./SegmentBase";
// import { generateSegmentListChildrenParser } from "./SegmentList";
// import { generateSegmentTemplateAttrParser } from "./SegmentTemplate";

/**
 * Generate a "children parser" once inside a `AdaptationSet` node.
 * @param {Object} adaptationSetChildren
 * @param {WebAssembly.Memory} linearMemory
 * @param {ParsersStack} parsersStack
 * @returns {Function}
 */
export function generateAdaptationSetChildrenParser(
  adaptationSetChildren : IAdaptationSetChildren,
  linearMemory : WebAssembly.Memory,
  parsersStack : ParsersStack
)  : IChildrenParser {
  return function onRootChildren(
    nodeId : number,
    attrPtr : number,
    attrLen : number
  ) {
    switch (nodeId) {

      case TagName.Accessibility: {
        const accessibility = decodeScheme(linearMemory, attrPtr, attrLen);
        if (adaptationSetChildren.accessibilities === undefined) {
          adaptationSetChildren.accessibilities = [];
        }
        adaptationSetChildren.accessibilities.push(accessibility);
        parsersStack.pushParser(nodeId, noop); // Accessibility have no sub-element
        break;
      }

      case TagName.BaseURL: {
        const baseUrl = decodeBaseUrl(linearMemory, attrPtr, attrLen);
        adaptationSetChildren.baseURLs.push(baseUrl);
        parsersStack.pushParser(nodeId, noop); // BaseURL have no sub-element
        break;
      }

      case TagName.ContentComponent: {
        const contentComponent = decodeContentComponentAttributes(linearMemory,
                                                                  attrPtr,
                                                                  attrLen);
        adaptationSetChildren.contentComponent = contentComponent;
        parsersStack.pushParser(nodeId, noop);
        break;
      }

      case TagName.ContentProtection: {
        const contentProtection = decodeContentProtection(linearMemory,
                                                          attrPtr,
                                                          attrLen);
        if (adaptationSetChildren.contentProtections === undefined) {
          adaptationSetChildren.contentProtections = [];
        }
        adaptationSetChildren.contentProtections.push(contentProtection);
        parsersStack.pushParser(nodeId, noop);
        break;
      }

      case TagName.EssentialProperty: {
        const essentialProperty = decodeScheme(linearMemory, attrPtr, attrLen);
        if (adaptationSetChildren.essentialProperties === undefined) {
          adaptationSetChildren.essentialProperties = [];
        }
        adaptationSetChildren.essentialProperties.push(essentialProperty);
        parsersStack.pushParser(nodeId, noop); // SupplementalProperty have no sub-element
        break;
      }

//       case TagName.InbandEventStream: {
//         const inbandEvent = {};
//         if (adaptationSetChildren.inbandEventStreams === undefined) {
//           adaptationSetChildren.inbandEventStreams = [];
//         }
//         adaptationSetChildren.inbandEventStreams.push(inbandEvent);

//         const childrenParser = noop; // InbandEventStream have no sub-element
//         const attributeParser = generateSchemeAttrParser(inbandEvent,
//                                                          linearMemory);
//         parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
//         break;
//       }

//       case TagName.Representation: {
//         const representationObj = { children: { baseURLs: [] },
//                                     attributes: {} };
//         adaptationSetChildren.representations.push(representationObj);
//         const childrenParser =
//           generateRepresentationChildrenParser(representationObj.children,
//                                                linearMemory,
//                                                parsersStack);
//         const attributeParser =
//           generateRepresentationAttrParser(representationObj.attributes, linearMemory);
//         parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
//         break;
//       }

      case TagName.Role: {
        const role = decodeScheme(linearMemory, attrPtr, attrLen);
        if (adaptationSetChildren.roles === undefined) {
          adaptationSetChildren.roles = [];
        }
        adaptationSetChildren.roles.push(role);
        parsersStack.pushParser(nodeId, noop); // Role have no sub-element
        break;
      }

      case TagName.SupplementalProperty: {
        const supplementalProperty = decodeScheme(linearMemory, attrPtr, attrLen);
        if (adaptationSetChildren.supplementalProperties === undefined) {
          adaptationSetChildren.supplementalProperties = [];
        }
        adaptationSetChildren.supplementalProperties.push(supplementalProperty);
        parsersStack.pushParser(nodeId, noop); // SupplementalProperty have no sub-element
        break;
      }

//       case TagName.SegmentBase: {
//         const segmentBaseObj = {};
//         adaptationSetChildren.segmentBase = segmentBaseObj;
//         const attributeParser = generateSegmentBaseAttrParser(segmentBaseObj,
//                                                               linearMemory);
//         parsersStack.pushParsers(nodeId, noop, attributeParser);
//         break;
//       }

//       case TagName.SegmentList: {
//         const segmentListObj : ISegmentListIntermediateRepresentation =
//           { list: [] };
//         adaptationSetChildren.segmentList = segmentListObj;
//         const childrenParser = generateSegmentListChildrenParser(segmentListObj,
//                                                                  linearMemory,
//                                                                  parsersStack);

//         // Re-use SegmentBase attribute parse as we should have the same attributes
//         const attributeParser = generateSegmentBaseAttrParser(segmentListObj,
//                                                               linearMemory);
//         parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
//         break;
//       }

//       case TagName.SegmentTemplate: {
//         const stObj = {};
//         adaptationSetChildren.segmentTemplate = stObj;
//         parsersStack.pushParsers(nodeId,
//                                  noop, // SegmentTimeline as treated like an attribute
//                       generateSegmentTemplateAttrParser(stObj, linearMemory));
//         break;
//       }

      default:
        // Allows to make sure we're not mistakenly closing a re-opened
        // tag.
        parsersStack.pushParser(nodeId, noop);
        break;

    }
  };
}

export function decodeAdaptationSetAttributes(
  linearMemory : WebAssembly.Memory,
  ptr : number,
  len : number
)  : IAdaptationSetAttributes {
  const adaptationAttrs : IAdaptationSetAttributes = {};
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
        adaptationAttrs.id = id;
        offset = newOffset;
        break ;
      }
      case AttributeName.Group:
        adaptationAttrs.group = dv.getFloat64(ptr, true);
        offset += 8;
        break;
      case AttributeName.Language: {
        const [language, newOffset] = readEncodedString(textDecoder, dv, offset);
        adaptationAttrs.language = language;
        offset = newOffset;
        break ;
      }
      case AttributeName.ContentType: {
        const [contentType, newOffset] = readEncodedString(textDecoder, dv, offset);
        adaptationAttrs.contentType = contentType;
        offset = newOffset;
        break ;
      }
      case AttributeName.Par: {
        const [par, newOffset] = readEncodedString(textDecoder, dv, offset);
        adaptationAttrs.par = par;
        offset = newOffset;
        break ;
      }
      case AttributeName.MinBandwidth:
        adaptationAttrs.minBitrate = dv.getFloat64(ptr, true);
        offset += 8;
        break;
      case AttributeName.MaxBandwidth:
        adaptationAttrs.maxBitrate = dv.getFloat64(ptr, true);
        offset += 8;
        break;
      case AttributeName.MinWidth:
        adaptationAttrs.minWidth = dv.getFloat64(ptr, true);
        offset += 8;
        break;
      case AttributeName.MaxWidth:
        adaptationAttrs.maxWidth = dv.getFloat64(ptr, true);
        offset += 8;
        break;
      case AttributeName.MinHeight:
        adaptationAttrs.minHeight = dv.getFloat64(ptr, true);
        offset += 8;
        break;
      case AttributeName.MaxHeight:
        adaptationAttrs.maxHeight = dv.getFloat64(ptr, true);
        offset += 8;
        break;
      case AttributeName.MinFrameRate: {
        const [minFrameRate, newOffset] = readEncodedString(textDecoder, dv, offset);
        adaptationAttrs.minFrameRate = minFrameRate;
        offset = newOffset;
        break ;
      }
      case AttributeName.MaxFrameRate: {
        const [maxFrameRate, newOffset] = readEncodedString(textDecoder, dv, offset);
        adaptationAttrs.maxFrameRate = maxFrameRate;
        offset = newOffset;
        break ;
      }
      case AttributeName.SelectionPriority:
        adaptationAttrs.selectionPriority = dv.getFloat64(ptr, true);
        offset += 8;
        break;
      case AttributeName.SegmentAlignment:
        adaptationAttrs.segmentAlignment =
          parseFloatOrBool(dv.getFloat64(ptr, true));
        offset += 8;
        break;
      case AttributeName.SubsegmentAlignment:
        adaptationAttrs.subsegmentAlignment =
          parseFloatOrBool(dv.getFloat64(ptr, true));
        offset += 8;
        break;
      case AttributeName.BitstreamSwitching:
        adaptationAttrs.bitstreamSwitching = dv.getFloat64(ptr, true) !== 0;
        offset += 8;
        break;
      case AttributeName.AudioSamplingRate: {
        const [audioSamplingRate, newOffset] = readEncodedString(textDecoder, dv, offset);
        adaptationAttrs.audioSamplingRate = audioSamplingRate;
        offset = newOffset;
        break ;
      }
      case AttributeName.Codecs: {
        const [codecs, newOffset] = readEncodedString(textDecoder, dv, offset);
        adaptationAttrs.codecs = codecs;
        offset = newOffset;
        break ;
      }
      case AttributeName.Profiles: {
        const [profiles, newOffset] = readEncodedString(textDecoder, dv, offset);
        adaptationAttrs.profiles = profiles;
        offset = newOffset;
        break ;
      }
      case AttributeName.SegmentProfiles: {
        const [segmentProfiles, newOffset] = readEncodedString(textDecoder, dv, offset);
        adaptationAttrs.segmentProfiles = segmentProfiles;
        offset = newOffset;
        break ;
      }
      case AttributeName.MimeType: {
        const [mimeType, newOffset] = readEncodedString(textDecoder, dv, offset);
        adaptationAttrs.mimeType = mimeType;
        offset = newOffset;
        break ;
      }
      case AttributeName.CodingDependency:
        adaptationAttrs.codingDependency = dv.getFloat64(ptr, true) !== 0;
        offset += 8;
        break;
      case AttributeName.FrameRate: {
        const [frameRate, newOffset] = readEncodedString(textDecoder, dv, offset);
        adaptationAttrs.frameRate = frameRate;
        offset = newOffset;
        break ;
      }
      case AttributeName.Height:
        adaptationAttrs.height = dv.getFloat64(ptr, true);
        offset += 8;
        break;
      case AttributeName.Width:
        adaptationAttrs.width = dv.getFloat64(ptr, true);
        offset += 8;
        break;
      case AttributeName.MaxPlayoutRate:
        adaptationAttrs.maxPlayoutRate = dv.getFloat64(ptr, true);
        offset += 8;
        break;
      case AttributeName.MaxSAPPeriod:
        adaptationAttrs.maximumSAPPeriod = dv.getFloat64(ptr, true);
        offset += 8;
        break;

      // XXX TODO? Check if WASM implement it
      // case AttributeName.StartsWithSap:
      //   adaptationAttrs.startsWithSap = dv.getFloat64(ptr, true);

      default: throw new Error("Unexpected AdaptationSet attribute.");
    }
  }
  return adaptationAttrs;
}
