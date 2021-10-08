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
import { SUPPORTED_ADAPTATIONS_TYPE } from "../../../../manifest";
/**
 * Attach trick mode tracks to adaptations by assigning to the trickModeTracks
 * property an array of trick mode track adaptations.
 * @param {Object} adaptations
 * @param {Array.<Object>} trickModeTracks
 * @returns {void}
 */
function attachTrickModeTrack(adaptations, trickModeTracks) {
    for (var _i = 0, trickModeTracks_1 = trickModeTracks; _i < trickModeTracks_1.length; _i++) {
        var track = trickModeTracks_1[_i];
        var adaptation = track.adaptation, trickModeAttachedAdaptationIds = track.trickModeAttachedAdaptationIds;
        for (var _a = 0, trickModeAttachedAdaptationIds_1 = trickModeAttachedAdaptationIds; _a < trickModeAttachedAdaptationIds_1.length; _a++) {
            var trickModeAttachedAdaptationId = trickModeAttachedAdaptationIds_1[_a];
            for (var _b = 0, SUPPORTED_ADAPTATIONS_TYPE_1 = SUPPORTED_ADAPTATIONS_TYPE; _b < SUPPORTED_ADAPTATIONS_TYPE_1.length; _b++) {
                var adaptationType = SUPPORTED_ADAPTATIONS_TYPE_1[_b];
                var adaptationsByType = adaptations[adaptationType];
                if (adaptationsByType !== undefined) {
                    for (var _c = 0, adaptationsByType_1 = adaptationsByType; _c < adaptationsByType_1.length; _c++) {
                        var adaptationByType = adaptationsByType_1[_c];
                        if (adaptationByType.id === trickModeAttachedAdaptationId) {
                            if (adaptationByType.trickModeTracks === undefined) {
                                adaptationByType.trickModeTracks = [];
                            }
                            adaptationByType.trickModeTracks.push(adaptation);
                        }
                    }
                }
            }
        }
    }
}
export default attachTrickModeTrack;
