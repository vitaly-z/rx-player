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
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
/**
 * From a given time, find the trickmode representation and return
 * the content information.
 * @param {number} time
 * @param {Object} manifest
 * @returns {Object|null}
 */
export default function getContentInfos(time, manifest) {
    var _a, _b;
    var period = manifest.getPeriodForTime(time);
    if (period === undefined ||
        period.adaptations.video === undefined ||
        period.adaptations.video.length === 0) {
        return null;
    }
    for (var i = 0; i < period.adaptations.video.length; i++) {
        var videoAdaptation = period.adaptations.video[i];
        var representation = (_b = (_a = videoAdaptation.trickModeTracks) === null || _a === void 0 ? void 0 : _a[0].representations) === null || _b === void 0 ? void 0 : _b[0];
        if (!isNullOrUndefined(representation)) {
            return { manifest: manifest, period: period, adaptation: videoAdaptation, representation: representation };
        }
    }
    return null;
}
