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
  ISegmentTemplateIntermediateRepresentation,
} from "../../../node_parser_types";
import { AttributeName } from "../../worker/worker_types";
import { IAttributeParser } from "../parsers_stack";
import { parseString } from "../utils";

export function generateSegmentTemplateAttrParser(
  segmentTemplateAttrs : ISegmentTemplateIntermediateRepresentation
)  : IAttributeParser {
  const textDecoder = new TextDecoder();
  return function onSegmentTemplateAttribute(
    attr : AttributeName,
    payload : ArrayBuffer
  ) {
    switch (attr) {
      case AttributeName.SegmentTimeline: {
        const dataView = new DataView(payload);
        segmentTemplateAttrs.timeline = [];
        let base = 0;
        const len = payload.byteLength;
        for (let i = 0; i < len / 24; i++) {
          segmentTemplateAttrs.timeline.push({
            start: dataView.getFloat64(base, true),
            duration: dataView.getFloat64(base + 8, true),
            repeatCount: dataView.getFloat64(base + 16, true),
          });
          base += 24;
        }
        break;
      }

      case AttributeName.InitializationMedia:
        segmentTemplateAttrs.initialization =
          { media: parseString(textDecoder, payload) };
        break;

      case AttributeName.Index:
        segmentTemplateAttrs.index =
          parseString(textDecoder, payload);
        break;

      case AttributeName.AvailabilityTimeOffset: {
        const dataView = new DataView(payload);
        segmentTemplateAttrs.availabilityTimeOffset =
          dataView.getFloat64(0, true);
        break;
      }

      case AttributeName.AvailabilityTimeComplete: {
        segmentTemplateAttrs.availabilityTimeComplete =
          new DataView(payload).getUint8(0) === 0;
        break;
      }

      case AttributeName.PresentationTimeOffset: {
        const dataView = new DataView(payload);
        segmentTemplateAttrs.presentationTimeOffset =
          dataView.getFloat64(0, true);
        break;
      }

      case AttributeName.TimeScale: {
        const dataView = new DataView(payload);
        segmentTemplateAttrs.timescale =
          dataView.getFloat64(0, true);
        break;
      }

      case AttributeName.IndexRange: {
        const dataView = new DataView(payload);
        segmentTemplateAttrs.indexRange = [
          dataView.getFloat64(0, true),
          dataView.getFloat64(8, true),
        ];
        break;
      }

      case AttributeName.IndexRangeExact: {
        segmentTemplateAttrs.indexRangeExact =
          new DataView(payload).getUint8(0) === 0;
        break;
      }


      case AttributeName.Media:
        segmentTemplateAttrs.media =
          parseString(textDecoder, payload);
        break;

      case AttributeName.BitstreamSwitching: {
        segmentTemplateAttrs.bitstreamSwitching =
          new DataView(payload).getUint8(0) === 0;
        break;
      }

      case AttributeName.Duration: {
        const dataView = new DataView(payload);
        segmentTemplateAttrs.duration =
          dataView.getFloat64(0, true);
        break;
      }

      case AttributeName.StartNumber: {
        const dataView = new DataView(payload);
        segmentTemplateAttrs.startNumber =
          dataView.getFloat64(0, true);
        break;
      }

    }
  };
}
