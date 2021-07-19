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

// import { base64ToBytes } from "../../../../../../utils/base64";
import { hexToBytes } from "../../../../../../utils/string_parsing";
import {
  IContentProtectionIntermediateRepresentation,
} from "../../../node_parser_types";
import { AttributeName } from "../types";
import { readEncodedString } from "../utils";

export function decodeContentProtection(
  linearMemory : WebAssembly.Memory,
  ptr : number,
  len : number
)  : IContentProtectionIntermediateRepresentation {
  const contentProtection : IContentProtectionIntermediateRepresentation = {
    attributes: {},
    children: { cencPssh: [] },
  };
  const textDecoder = new TextDecoder();
  const dv = new DataView(linearMemory.buffer);

  let offset = ptr;
  const max = ptr + len;
  while (offset < max) {
    const attr = dv.getUint8(offset);
    offset += 1;
    switch (attr) {
      case AttributeName.SchemeIdUri: {
        const [schemeIdUri, newOffset] = readEncodedString(textDecoder, dv, offset);
        contentProtection.attributes.schemeIdUri = schemeIdUri;
        offset = newOffset;
        break ;
      }
      case AttributeName.ContentProtectionValue: {
        const [val, newOffset] = readEncodedString(textDecoder, dv, offset);
        contentProtection.attributes.value = val;
        offset = newOffset;
        break ;
      }
      case AttributeName.ContentProtectionKeyId: {
        const [kid, newOffset] = readEncodedString(textDecoder, dv, offset);
        contentProtection.attributes.keyId = hexToBytes(kid.replace(/-/g, ""));
        offset = newOffset;
        break ;
      }
      // case AttributeName.ContentProtectionCencPSSH: {
      //   const [b64, newOffset] = readEncodedString(textDecoder, dv, offset);
      //   offset = newOffset;
      //   try {
      //     contentProtection.children.cencPssh.push(base64ToBytes(b64));
      //   } catch (_) { /* TODO log error? register as warning? */ }

      //   break ;
      // }

      default: throw new Error("Unexpected ContentProtection attribute.");
    }
  }
  return contentProtection;
}
