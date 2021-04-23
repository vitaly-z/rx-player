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
  IEventStreamAttributes,
  IEventStreamChildren,
  IEventStreamEventIntermediateRepresentation,
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

/**
 * Generate a "children parser" once inside a `EventStream` node.
 * @param {Object} childrenObj
 * @param {WebAssembly.Memory} linearMemory
 * @param {ParsersStack} parsersStack
 * @param {ArrayBuffer} fullMpd
 * @returns {Function}
 */
export function generateEventStreamChildrenParser(
  childrenObj : IEventStreamChildren,
  parsersStack : ParsersStack
)  : IChildrenParser {
  return function onRootChildren(nodeId : number) {
    switch (nodeId) {
      case TagName.EventStreamElt: {
        const event = {};
        childrenObj.events.push(event);
        const attrParser = generateEventAttrParser(event);
        parsersStack.pushParsers(nodeId, noop, attrParser);
        break;
      }
    }
  };
}

/**
 * @param {Object} esAttrs
 * @param {WebAssembly.Memory} linearMemory
 * @returns {Function}
 */
export function generateEventStreamAttrParser(
  esAttrs : IEventStreamAttributes
)  : IAttributeParser {
  const textDecoder = new TextDecoder();
  return function onEventStreamAttribute(attr : number, payload : ArrayBuffer) {
    const dataView = new DataView(payload);
    switch (attr) {
      case AttributeName.SchemeIdUri:
        esAttrs.schemeIdUri =
          parseString(textDecoder, payload);
        break;
      case AttributeName.SchemeValue:
        esAttrs.value =
          parseString(textDecoder, payload);
        break;
      case AttributeName.TimeScale:
        esAttrs.timescale = dataView.getFloat64(0, true);
        break;
    }
  };
}

/**
 * @param {Object} eventAttr
 * @param {WebAssembly.Memory} linearMemory
 * @param {ArrayBuffer} fullMpd
 * @returns {Function}
 */
function generateEventAttrParser(
  eventAttr : IEventStreamEventIntermediateRepresentation
) : IAttributeParser {
  const textDecoder = new TextDecoder();
  return function onEventStreamAttribute(attr : number, payload : ArrayBuffer) {
    const dataView = new DataView(payload);
    switch (attr) {
      case AttributeName.EventPresentationTime:
        eventAttr.presentationTime = dataView.getFloat64(0, true);
        break;
      case AttributeName.Duration:
        eventAttr.duration = dataView.getFloat64(0, true);
        break;
      case AttributeName.Id:
        eventAttr.id = parseString(textDecoder, payload);
        break;
      case AttributeName.EventStreamEltRange:
        eventAttr.eventStreamData = payload;
        break;
    }
  };
}
