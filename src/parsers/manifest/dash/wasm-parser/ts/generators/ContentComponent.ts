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

import { IContentComponentAttributes } from "../../../node_parser_types";
import { AttributeName } from "../../worker/worker_types";
import { IAttributeParser } from "../parsers_stack";
import { parseString } from "../utils";

/**
 * Generate an "attribute parser" once inside a `BaseURL` node.
 * @param {Object} baseUrlAttrs
 * @param {WebAssembly.Memory} linearMemory
 * @returns {Function}
 */
export function generateContentComponentAttrParser(
  ccAttrs : IContentComponentAttributes
)  : IAttributeParser {
  const textDecoder = new TextDecoder();
  return function onMPDAttribute(attr : number, payload : ArrayBuffer) {
    switch (attr) {
      case AttributeName.Id:
        ccAttrs.id = parseString(textDecoder, payload);
        break;

      case AttributeName.Language:
        ccAttrs.language = parseString(textDecoder, payload);
        break;

      case AttributeName.ContentType:
        ccAttrs.contentType = parseString(textDecoder, payload);
        break;

      case AttributeName.Par:
        ccAttrs.par = parseString(textDecoder, payload);
        break;
    }
  };
}

