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
import { base64ToBytes } from "../../../../../../utils/base64";
import { hexToBytes } from "../../../../../../utils/string_parsing";
import { parseString } from "../utils";
/**
 * @param {Object} cpAttrs
 * @param {WebAssembly.Memory} linearMemory
 * @returns {Function}
 */
export function generateContentProtectionAttrParser(cp, linearMemory) {
    var cpAttrs = cp.attributes;
    var cpChildren = cp.children;
    var textDecoder = new TextDecoder();
    return function onContentProtectionAttribute(attr, ptr, len) {
        switch (attr) {
            case 16 /* SchemeIdUri */:
                cpAttrs.schemeIdUri = parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 13 /* ContentProtectionValue */:
                cpAttrs.value = parseString(textDecoder, linearMemory.buffer, ptr, len);
                break;
            case 14 /* ContentProtectionKeyId */:
                var kid = parseString(textDecoder, linearMemory.buffer, ptr, len);
                cpAttrs.keyId = hexToBytes(kid.replace(/-/g, ""));
                break;
            case 15 /* ContentProtectionCencPSSH */:
                try {
                    var b64 = parseString(textDecoder, linearMemory.buffer, ptr, len);
                    cpChildren.cencPssh.push(base64ToBytes(b64));
                }
                catch (_) { /* TODO log error? register as warning? */ }
                break;
        }
    };
}
