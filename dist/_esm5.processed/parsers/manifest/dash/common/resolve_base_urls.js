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
import resolveURL from "../../../../utils/resolve_url";
/**
 * @param {Array.<string>} currentBaseURLs
 * @param {Array.<Object>} newBaseUrlsIR
 * @returns {Array.<string>}
 */
export default function resolveBaseURLs(currentBaseURLs, newBaseUrlsIR) {
    if (newBaseUrlsIR.length === 0) {
        return currentBaseURLs;
    }
    var newBaseUrls = newBaseUrlsIR.map(function (ir) {
        var _a, _b;
        return { url: ir.value,
            availabilityTimeOffset: (_a = ir.attributes.availabilityTimeOffset) !== null && _a !== void 0 ? _a : 0,
            availabilityTimeComplete: (_b = ir.attributes.availabilityTimeComplete) !== null && _b !== void 0 ? _b : true };
    });
    if (currentBaseURLs.length === 0) {
        return newBaseUrls;
    }
    var result = [];
    for (var i = 0; i < currentBaseURLs.length; i++) {
        var curBaseUrl = currentBaseURLs[i];
        for (var j = 0; j < newBaseUrls.length; j++) {
            var newBaseUrl = newBaseUrls[j];
            var newUrl = resolveURL(curBaseUrl.url, newBaseUrl.url);
            var newAvailabilityTimeOffset = curBaseUrl.availabilityTimeOffset +
                newBaseUrl.availabilityTimeOffset;
            result.push({ url: newUrl,
                availabilityTimeOffset: newAvailabilityTimeOffset,
                availabilityTimeComplete: newBaseUrl.availabilityTimeComplete });
        }
    }
    return result;
}
