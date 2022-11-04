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
import log from "../../log";
import arrayFindIndex from "../../utils/array_find_index";
import getBufferLevels from "./utils/get_buffer_levels";
/**
 * Choose a bitrate based on the currently available buffer.
 *
 * This algorithm is based on a deviation of the BOLA algorithm.
 * It is a hybrid solution that also relies on a given bitrate's
 * "maintainability".
 * Each time a chunk is downloaded, from the ratio between the chunk duration
 * and chunk's request time, we can assume that the representation is
 * "maintanable" or not.
 * If so, we may switch to a better quality, or conversely to a worse quality.
 *
 * @class BufferBasedChooser
 */
var BufferBasedChooser = /** @class */ (function () {
    /**
     * @param {Array.<number>} bitrates
     */
    function BufferBasedChooser(bitrates) {
        this._levelsMap = getBufferLevels(bitrates);
        this._bitrates = bitrates;
        log.debug("ABR: Steps for buffer based chooser.", this._levelsMap.map(function (l, i) { return "bufferLevel: ".concat(l, ", bitrate: ").concat(bitrates[i]); })
            .join(" ,"));
    }
    /**
     * @param {Object} playbackObservation
     * @returns {number|undefined}
     */
    BufferBasedChooser.prototype.getEstimate = function (playbackObservation) {
        var bufferLevels = this._levelsMap;
        var bitrates = this._bitrates;
        var bufferGap = playbackObservation.bufferGap, currentBitrate = playbackObservation.currentBitrate, currentScore = playbackObservation.currentScore, speed = playbackObservation.speed;
        if (currentBitrate == null) {
            return bitrates[0];
        }
        var currentBitrateIndex = arrayFindIndex(bitrates, function (b) { return b === currentBitrate; });
        if (currentBitrateIndex < 0 || bitrates.length !== bufferLevels.length) {
            log.error("ABR: Current Bitrate not found in the calculated levels");
            return bitrates[0];
        }
        var scaledScore;
        if (currentScore != null) {
            scaledScore = speed === 0 ? currentScore : (currentScore / speed);
        }
        if (scaledScore != null && scaledScore > 1) {
            var currentBufferLevel_1 = bufferLevels[currentBitrateIndex];
            var nextIndex = (function () {
                for (var i = currentBitrateIndex + 1; i < bufferLevels.length; i++) {
                    if (bufferLevels[i] > currentBufferLevel_1) {
                        return i;
                    }
                }
            })();
            if (nextIndex != null) {
                var nextBufferLevel = bufferLevels[nextIndex];
                if (bufferGap >= nextBufferLevel) {
                    return bitrates[nextIndex];
                }
            }
        }
        if (scaledScore == null || scaledScore < 1.15) {
            var currentBufferLevel = bufferLevels[currentBitrateIndex];
            if (bufferGap < currentBufferLevel) {
                for (var i = currentBitrateIndex - 1; i >= 0; i--) {
                    if (bitrates[i] < currentBitrate) {
                        return bitrates[i];
                    }
                }
                return currentBitrate;
            }
        }
        return currentBitrate;
    };
    return BufferBasedChooser;
}());
export default BufferBasedChooser;
