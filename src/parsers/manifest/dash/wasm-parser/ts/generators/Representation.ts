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
  IRepresentationAttributes,
  IRepresentationChildren,
  ISegmentListIntermediateRepresentation,
} from "../../../node_parser_types";
import {
  AttributeName,
  TagName,
} from "../../worker/worker_types";
import ParsersStack, {
  IAttributeParser,
  IChildrenParser,
} from "../parsers_stack";
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
export function generateRepresentationChildrenParser(
  childrenObj : IRepresentationChildren,
  parsersStack : ParsersStack
)  : IChildrenParser {
  return function onRootChildren(nodeId : number) {
    switch (nodeId) {

      case TagName.BaseURL: {
        const baseUrl = { value: "", attributes: {} };
        childrenObj.baseURLs.push(baseUrl);
        parsersStack.pushParsers(nodeId,
                                 noop,
                                 generateBaseUrlAttrParser(baseUrl));
        break;
      }

      case TagName.InbandEventStream: {
        const inbandEvent = {};
        if (childrenObj.inbandEventStreams === undefined) {
          childrenObj.inbandEventStreams = [];
        }
        childrenObj.inbandEventStreams.push(inbandEvent);
        parsersStack.pushParsers(nodeId, noop, generateSchemeAttrParser(inbandEvent));
        break;
      }

      case TagName.SegmentBase: {
        const segmentBaseObj = {};
        childrenObj.segmentBase = segmentBaseObj;
        const attributeParser = generateSegmentBaseAttrParser(segmentBaseObj);
        parsersStack.pushParsers(nodeId, noop, attributeParser);
        break;
      }

      case TagName.SegmentList: {
        const segmentListObj : ISegmentListIntermediateRepresentation =
          { list: [] };
        childrenObj.segmentList = segmentListObj;
        const childrenParser = generateSegmentListChildrenParser(segmentListObj,
                                                                 parsersStack);

        // Re-use SegmentBase attribute parse as we should have the same attributes
        const attributeParser = generateSegmentBaseAttrParser(segmentListObj);
        parsersStack.pushParsers(nodeId, childrenParser, attributeParser);
        break;
      }

      case TagName.SegmentTemplate: {
        const stObj = {};
        childrenObj.segmentTemplate = stObj;
        parsersStack.pushParsers(nodeId,
                                 noop, // SegmentTimeline as treated like an attribute
                                 generateSegmentTemplateAttrParser(stObj));
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
export function generateRepresentationAttrParser(
  representationAttrs : IRepresentationAttributes
)  : IAttributeParser {
  const textDecoder = new TextDecoder();
  return function onRepresentationAttribute(attr : number, payload : ArrayBuffer) {
    const dataView = new DataView(payload);
    switch (attr) {
      case AttributeName.Id:
        representationAttrs.id = parseString(textDecoder, payload);
        break;
      case AttributeName.AudioSamplingRate:
        representationAttrs.audioSamplingRate =
          parseString(textDecoder, payload);
        break;
      case AttributeName.Bitrate:
        representationAttrs.bitrate = dataView.getFloat64(0, true);
        break;
      case AttributeName.Codecs:
        representationAttrs.codecs =
          parseString(textDecoder, payload);
        break;
      case AttributeName.CodingDependency:
        representationAttrs.codingDependency =
          new DataView(payload).getUint8(0) === 0;
        break;
      case AttributeName.FrameRate:
        representationAttrs.frameRate =
          parseString(textDecoder, payload);
        break;
      case AttributeName.Height:
        representationAttrs.height = dataView.getFloat64(0, true);
        break;
      case AttributeName.Width:
        representationAttrs.width = dataView.getFloat64(0, true);
        break;
      case AttributeName.MaxPlayoutRate:
        representationAttrs.maxPlayoutRate = dataView.getFloat64(0, true);
        break;
      case AttributeName.MaxSAPPeriod:
        representationAttrs.maximumSAPPeriod = dataView.getFloat64(0, true);
        break;
      case AttributeName.MimeType:
        representationAttrs.mimeType =
          parseString(textDecoder, payload);
        break;
      case AttributeName.Profiles:
        representationAttrs.profiles =
          parseString(textDecoder, payload);
        break;
      case AttributeName.QualityRanking:
        representationAttrs.qualityRanking = dataView.getFloat64(0, true);
        break;
      case AttributeName.SegmentProfiles:
        representationAttrs.segmentProfiles =
          parseString(textDecoder, payload);
        break;
    }
  };
}
