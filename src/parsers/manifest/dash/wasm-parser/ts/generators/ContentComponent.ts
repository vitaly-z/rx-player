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
import { AttributeName } from "../types";
import { readEncodedString } from "../utils";

export function decodeContentComponentAttributes(
  linearMemory : WebAssembly.Memory,
  ptr : number,
  len : number
)  : IContentComponentAttributes {
  const contentComponentAttrs : IContentComponentAttributes = {};
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
        contentComponentAttrs.id = id;
        offset = newOffset;
        break ;
      }
      case AttributeName.Language: {
        const [language, newOffset] = readEncodedString(textDecoder, dv, offset);
        contentComponentAttrs.language = language;
        offset = newOffset;
        break ;
      }
      case AttributeName.ContentType: {
        const [contentType, newOffset] = readEncodedString(textDecoder, dv, offset);
        contentComponentAttrs.contentType = contentType;
        offset = newOffset;
        break ;
      }
      case AttributeName.Par: {
        const [par, newOffset] = readEncodedString(textDecoder, dv, offset);
        contentComponentAttrs.par = par;
        offset = newOffset;
        break ;
      }

      default: throw new Error("Unexpected ContentComponent attribute.");
    }
  }
  return contentComponentAttrs;
}
