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
  IMPDAttributes,
  IMPDChildren,
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
import { decodeBaseUrl } from "./BaseURL";
import {
  decodePeriodAttributes,
  generatePeriodChildrenParser,
} from "./Period";
import { decodeScheme } from "./Scheme";

/**
 * Generate a "children parser" once inside an `MPD` node.
 * @param {Object} mpdChildren
 * @param {WebAssembly.Memory} linearMemory
 * @param {ParsersStack} parsersStack
 * @param {ArrayBuffer} fullMpd
 * @returns {Function}
 */
export function generateMPDChildrenParser(
  mpdChildren : IMPDChildren,
  linearMemory : WebAssembly.Memory,
  parsersStack : ParsersStack,
  fullMpd : ArrayBuffer
)  : IChildrenParser {
  return function onRootChildren(
    nodeId : number,
    attrPtr : number,
    attrLen : number
  ) {
    switch (nodeId) {

      case TagName.BaseURL: {
        const baseUrl = decodeBaseUrl(linearMemory, attrPtr, attrLen);
        mpdChildren.baseURLs.push(baseUrl);
        parsersStack.pushParser(nodeId, noop); // BaseURL have no sub-element
        break;
      }

      case TagName.Period: {
        const periodChildren : IPeriodChildren = { adaptations: [],
                                                   baseURLs: [],
                                                   eventStreams: [] };
        const childrenParser = generatePeriodChildrenParser(periodChildren,
                                                            linearMemory,
                                                            parsersStack,
                                                            fullMpd);
        const periodAttrs = decodePeriodAttributes(linearMemory, attrPtr, attrLen);
        mpdChildren.periods.push({ children: periodChildren, attributes: periodAttrs });
        parsersStack.pushParser(nodeId, childrenParser);
        break;
      }

      case TagName.UtcTiming: {
        const utcTiming = decodeScheme(linearMemory, attrPtr, attrLen);
        mpdChildren.utcTimings.push(utcTiming);
        parsersStack.pushParser(nodeId, noop); // UTCTiming have no sub-element
        break;
      }

      default:
        // Allows to make sure we're not mistakenly closing a re-opened
        // tag.
        parsersStack.pushParser(nodeId, noop);
        break;
    }
  };
}

export function decodeMPDAttributes(
  mpdChildren : IMPDChildren,
  linearMemory : WebAssembly.Memory,
  ptr : number,
  len : number
) : IMPDAttributes {
  const mpdAttrs : IMPDAttributes = {};
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
        mpdAttrs.id = id;
        offset = newOffset;
        break ;
      }
      case AttributeName.Profiles: {
        const [profiles, newOffset] = readEncodedString(textDecoder, dv, offset);
        mpdAttrs.profiles = profiles;
        offset = newOffset;
        break;
      }
      case AttributeName.Type: {
        const [type, newOffset] = readEncodedString(textDecoder, dv, offset);
        mpdAttrs.profiles = type;
        offset = newOffset;
        break;
      }
      case AttributeName.AvailabilityStartTime: {
        const [startTime, newOffset] = readEncodedString(textDecoder, dv, offset);
        mpdAttrs.availabilityStartTime = new Date(startTime).getTime() / 1000;
        offset = newOffset;
        break;
      }
      case AttributeName.AvailabilityEndTime: {
        const [startTime, newOffset] = readEncodedString(textDecoder, dv, offset);
        mpdAttrs.availabilityEndTime = new Date(startTime).getTime() / 1000;
        offset = newOffset;
        break;
      }
      case AttributeName.PublishTime: {
        const [publishTime, newOffset] = readEncodedString(textDecoder, dv, offset);
        mpdAttrs.publishTime = new Date(publishTime).getTime() / 1000;
        offset = newOffset;
        break;
      }
      case AttributeName.MediaPresentationDuration:
        mpdAttrs.duration = dv.getFloat64(offset, true);
        offset += 8;
        break;
      case AttributeName.MinimumUpdatePeriod:
        mpdAttrs.minimumUpdatePeriod = dv.getFloat64(offset, true);
        offset += 8;
        break;
      case AttributeName.MinBufferTime:
        mpdAttrs.minBufferTime = dv.getFloat64(offset, true);
        offset += 8;
        break;
      case AttributeName.TimeShiftBufferDepth:
        mpdAttrs.timeShiftBufferDepth = dv.getFloat64(offset, true);
        offset += 8;
        break;
      case AttributeName.SuggestedPresentationDelay:
        mpdAttrs.suggestedPresentationDelay = dv.getFloat64(offset, true);
        offset += 8;
        break;
      case AttributeName.MaxSegmentDuration:
        mpdAttrs.maxSegmentDuration = dv.getFloat64(offset, true);
        offset += 8;
        break;
      case AttributeName.MaxSubsegmentDuration:
        mpdAttrs.maxSubsegmentDuration = dv.getFloat64(offset, true);
        offset += 8;
        break;
      case AttributeName.Location: {
        const [location, newOffset] = readEncodedString(textDecoder, dv, offset);
        mpdChildren.locations.push(location);
        offset = newOffset;
        break;
      }

      default: throw new Error("Unexpected MPD attribute.");
    }
  }
  return mpdAttrs;
}
