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
import { parseString } from "../utils";
export function generateSegmentTemplateAttrParser(segmentTemplateAttrs, linearMemory) {
    var textDecoder = new TextDecoder();
    return function onSegmentTemplateAttribute(attr, ptr, len) {
        switch (attr) {
            case 19 /* SegmentTimeline */: {
                var dataView = new DataView(linearMemory.buffer);
                segmentTemplateAttrs.timeline = [];
                var base = ptr;
                for (var i = 0; i < len / 24; i++) {
                    segmentTemplateAttrs.timeline.push({
                        start: dataView.getFloat64(base, true),
                        duration: dataView.getFloat64(base + 8, true),
                        repeatCount: dataView.getFloat64(base + 16, true),
                    });
                    base += 24;
                }
                break;
            }
            case 67 /* InitializationMedia */:
                segmentTemplateAttrs.initialization =
                    { media: parseString(textDecoder, linearMemory.buffer, ptr, len) };
                break;
            case 28 /* Index */:
                segmentTemplateAttrs.index =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 43 /* AvailabilityTimeOffset */: {
                var dataView = new DataView(linearMemory.buffer);
                segmentTemplateAttrs.availabilityTimeOffset =
                    dataView.getFloat64(ptr, true);
                break;
            }
            case 22 /* AvailabilityTimeComplete */: {
                segmentTemplateAttrs.availabilityTimeComplete =
                    new DataView(linearMemory.buffer).getUint8(0) === 0;
                break;
            }
            case 24 /* PresentationTimeOffset */: {
                var dataView = new DataView(linearMemory.buffer);
                segmentTemplateAttrs.presentationTimeOffset =
                    dataView.getFloat64(ptr, true);
                break;
            }
            case 27 /* TimeScale */: {
                var dataView = new DataView(linearMemory.buffer);
                segmentTemplateAttrs.timescale =
                    dataView.getFloat64(ptr, true);
                break;
            }
            case 31 /* IndexRange */: {
                var dataView = new DataView(linearMemory.buffer);
                segmentTemplateAttrs.indexRange = [
                    dataView.getFloat64(ptr, true),
                    dataView.getFloat64(ptr + 8, true),
                ];
                break;
            }
            case 23 /* IndexRangeExact */: {
                segmentTemplateAttrs.indexRangeExact =
                    new DataView(linearMemory.buffer).getUint8(0) === 0;
                break;
            }
            case 30 /* Media */:
                segmentTemplateAttrs.media =
                    parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 32 /* BitstreamSwitching */: {
                segmentTemplateAttrs.bitstreamSwitching =
                    new DataView(linearMemory.buffer).getUint8(0) === 0;
                break;
            }
            case 1 /* Duration */: {
                var dataView = new DataView(linearMemory.buffer);
                segmentTemplateAttrs.duration =
                    dataView.getFloat64(ptr, true);
                break;
            }
            case 20 /* StartNumber */: {
                var dataView = new DataView(linearMemory.buffer);
                segmentTemplateAttrs.startNumber =
                    dataView.getFloat64(ptr, true);
                break;
            }
        }
    };
}
