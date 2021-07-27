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
 * Register a short-lived history of initial buffered information found linked
 * to a segment.
 *
 * @class BufferedInfoHistory
 */
var BufferedInfoHistory = /** @class */ (function () {
    function BufferedInfoHistory(lifetime, maxHistoryLength) {
        this._history = [];
        this._lifetime = lifetime;
        this._maxHistoryLength = maxHistoryLength;
    }
    BufferedInfoHistory.prototype.setBufferedStart = function (context, expectedStart, bufferedStart) {
        var now = performance.now();
        this._history.push({ type: 0 /* InitialBufferedStart */,
            date: now,
            bufferedStart: bufferedStart,
            expectedStart: expectedStart,
            context: context });
        this._cleanHistory(now);
    };
    BufferedInfoHistory.prototype.setBufferedEnd = function (context, expectedEnd, bufferedEnd) {
        var now = performance.now();
        this._history.push({ type: 1 /* InitialBufferedEnd */,
            date: now,
            bufferedEnd: bufferedEnd,
            expectedEnd: expectedEnd,
            context: context });
        this._cleanHistory(now);
    };
    BufferedInfoHistory.prototype.getHistoryFor = function (context) {
        return this._history.filter(function (el) { return areSameContent(el.context, context); });
    };
    BufferedInfoHistory.prototype._cleanHistory = function (now) {
        var historyEarliestLimit = now - this._lifetime;
        var firstKeptIndex = 0;
        for (var _i = 0, _a = this._history; _i < _a.length; _i++) {
            var element = _a[_i];
            if (element.date < historyEarliestLimit) {
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
    return BufferedInfoHistory;
}());
export default BufferedInfoHistory;
