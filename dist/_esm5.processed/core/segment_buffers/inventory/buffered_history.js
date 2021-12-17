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
import { areSameContent } from "../../../manifest";
/**
 * Register a short-lived history of buffer information.
 *
 * This class can be useful to develop heuristics based on short-term buffer
 * history, such as knowing the real start and end of a buffered segment once
 * it has been pushed in a buffer.
 *
 * By storing in a history important recent actions and events, the
 * `BufferedHistory` can help other RxPlayer modules detect and work-around
 * unusual behavior.
 *
 * @class BufferedHistory
 */
var BufferedHistory = /** @class */ (function () {
    /**
     * @param {number} lifetime - Maximum time a history entry should be retained.
     * @param {number} maxHistoryLength - Maximum number of entries the history
     * should have.
     */
    function BufferedHistory(lifetime, maxHistoryLength) {
        this._history = [];
        this._lifetime = lifetime;
        this._maxHistoryLength = maxHistoryLength;
    }
    /**
     * Add an entry to the `BufferedHistory`'s history indicating the buffered
     * range of a pushed segment.
     *
     * To call when the full range of a given segment becomes known.
     *
     * @param {Object} context
     * @param {number} bufferedStart
     * @param {number} bufferedEnd
     */
    BufferedHistory.prototype.addBufferedSegment = function (context, bufferedStart, bufferedEnd) {
        var now = performance.now();
        this._history.push({ date: now, bufferedStart: bufferedStart, bufferedEnd: bufferedEnd, context: context });
        this._cleanHistory(now);
    };
    /**
     * Returns all entries linked to the given segment.
     * @param {Object} context
     * @returns {Array.<Object>}
     */
    BufferedHistory.prototype.getHistoryFor = function (context) {
        return this._history.filter(function (el) { return areSameContent(el.context, context); });
    };
    /**
     * If the current history does not satisfy `_lifetime` or `_maxHistoryLength`,
     * clear older entries until it does.
     * @param {number} now - Current `performance.now()` result.
     */
    BufferedHistory.prototype._cleanHistory = function (now) {
        var historyEarliestLimit = now - this._lifetime;
        var firstKeptIndex = 0;
        for (var _i = 0, _a = this._history; _i < _a.length; _i++) {
            var event_1 = _a[_i];
            if (event_1.date < historyEarliestLimit) {
                firstKeptIndex++;
            }
            else {
                break;
            }
        }
        if (firstKeptIndex > 0) {
            this._history.splice(firstKeptIndex);
        }
        if (this._history.length > this._maxHistoryLength) {
            var toRemove = this._history.length - this._maxHistoryLength;
            this._history.splice(toRemove);
        }
    };
    return BufferedHistory;
}());
export default BufferedHistory;
