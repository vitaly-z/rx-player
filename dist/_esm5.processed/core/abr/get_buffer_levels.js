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
/**
 * Return "Buffer Levels" which are steps of available buffers from which we
 * are normally able switch safely to the next available bitrate.
 * (Following an algorithm close to BOLA)
 * @param {Array.<number>} bitrates - All available bitrates, __sorted__ in
 * ascending order.
 * @returns {Array.<number>}
 */
export default function getBufferLevels(bitrates) {
    var logs = bitrates.map(function (b) { return Math.log(b / bitrates[0]); });
    var utilities = logs.map(function (l) { return l - logs[0] + 1; }); // normalize
    var gp = (utilities[utilities.length - 1] - 1) / ((bitrates.length * 2) + 10);
    var Vp = 1 / gp;
    return bitrates.map(function (_, i) { return minBufferLevelForBitrate(i); });
    /**
     * Get minimum buffer we should keep ahead to pick this bitrate.
     * @param {number} index
     * @returns {number}
     */
    function minBufferLevelForBitrate(index) {
        if (index === 0) {
            return 0;
        }
        var boundedIndex = Math.min(Math.max(1, index), bitrates.length - 1);
        if (bitrates[boundedIndex] === bitrates[boundedIndex - 1]) {
            return minBufferLevelForBitrate(index - 1);
        }
        return Vp * (gp + (bitrates[boundedIndex] * utilities[boundedIndex - 1] -
            bitrates[boundedIndex - 1] * utilities[boundedIndex]) / (bitrates[boundedIndex] -
            bitrates[boundedIndex - 1])) + 4;
    }
}
