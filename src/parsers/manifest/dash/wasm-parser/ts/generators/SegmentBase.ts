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

import {
  ISegmentBaseIntermediateRepresentation,
} from "../../../node_parser_types";
import { AttributeName } from "../../worker/worker_types";
import { IAttributeParser } from "../parsers_stack";
import { parseString } from "../utils";

export function generateSegmentBaseAttrParser(
  segmentBaseAttrs : ISegmentBaseIntermediateRepresentation
)  : IAttributeParser {
  const textDecoder = new TextDecoder();
  return function onSegmentBaseAttribute(attr : AttributeName, payload : ArrayBuffer) {
    switch (attr) {

      case AttributeName.InitializationRange: {
        const dataView = new DataView(payload);
        if (segmentBaseAttrs.initialization === undefined) {
          segmentBaseAttrs.initialization = {};
        }
        segmentBaseAttrs.initialization.range = [
          dataView.getFloat64(0, true),
          dataView.getFloat64(8, true),
        ];
        break;
      }

      case AttributeName.InitializationMedia:
        if (segmentBaseAttrs.initialization === undefined) {
          segmentBaseAttrs.initialization = {};
        }
        segmentBaseAttrs.initialization.media =
          parseString(textDecoder, payload);
        break;

      case AttributeName.AvailabilityTimeOffset: {
        const dataView = new DataView(payload);
        segmentBaseAttrs.availabilityTimeOffset =
          dataView.getFloat64(0, true);
        break;
      }

      case AttributeName.AvailabilityTimeComplete: {
        segmentBaseAttrs.availabilityTimeComplete =
          new DataView(payload).getUint8(0) === 0;
        break;
      }

      case AttributeName.PresentationTimeOffset: {
        const dataView = new DataView(payload);
        segmentBaseAttrs.presentationTimeOffset = dataView.getFloat64(0, true);
        break;
      }

      case AttributeName.TimeScale: {
        const dataView = new DataView(payload);
        segmentBaseAttrs.timescale =
          dataView.getFloat64(0, true);
        break;
      }

      case AttributeName.IndexRange: {
        const dataView = new DataView(payload);
        segmentBaseAttrs.indexRange = [
          dataView.getFloat64(0, true),
          dataView.getFloat64(8, true),
        ];
        break;
      }

      case AttributeName.IndexRangeExact: {
        segmentBaseAttrs.indexRangeExact =
          new DataView(payload).getUint8(0) === 0;
        break;
      }

      case AttributeName.Duration: {
        const dataView = new DataView(payload);
        segmentBaseAttrs.duration =
          dataView.getFloat64(0, true);
        break;
      }

      case AttributeName.StartNumber: {
        const dataView = new DataView(payload);
        segmentBaseAttrs.startNumber = dataView.getFloat64(0, true);
        break;
      }

    }
  };
}
