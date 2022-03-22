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
import config from "../../../config";
import applyPrioritizerToSegmentFetcher from "./prioritized_segment_fetcher";
import ObservablePrioritizer from "./prioritizer";
import createSegmentFetcher, { getSegmentFetcherOptions, } from "./segment_fetcher";
/**
 * Interact with the transport pipelines to download segments with the right
 * priority.
 *
 * @class SegmentFetcherCreator
 *
 * @example
 * ```js
 * const creator = new SegmentFetcherCreator(transport, {
 *   lowLatencyMode: false,
 *   maxRetryRegular: Infinity,
 *   maxRetryOffline: Infinity,
 * });
 *
 * // 2 - create a new fetcher with its backoff options
 * const fetcher = creator.createSegmentFetcher("audio", {
 *   // ... (lifecycle callbacks if wanted)
 * });
 *
 * // 3 - load a segment with a given priority
 * fetcher.createRequest(myContent, 1)
 *   // 4 - parse it
 *   .pipe(
 *     filter(evt => evt.type === "chunk"),
 *     mergeMap(response => response.parse());
 *   )
 *   // 5 - use it
 *   .subscribe((res) => console.log("audio chunk downloaded:", res));
 * ```
 */
var SegmentFetcherCreator = /** @class */ (function () {
    /**
     * @param {Object} transport
     */
    function SegmentFetcherCreator(transport, options) {
        var _a = config.getCurrent(), MIN_CANCELABLE_PRIORITY = _a.MIN_CANCELABLE_PRIORITY, MAX_HIGH_PRIORITY_LEVEL = _a.MAX_HIGH_PRIORITY_LEVEL;
        this._transport = transport;
        this._prioritizer = new ObservablePrioritizer({
            prioritySteps: { high: MAX_HIGH_PRIORITY_LEVEL,
                low: MIN_CANCELABLE_PRIORITY },
        });
        this._backoffOptions = options;
    }
    /**
     * Create a segment fetcher, allowing to easily perform segment requests.
     * @param {string} bufferType - The type of buffer concerned (e.g. "audio",
     * "video", etc.)
     * @param {Object} callbacks
     * @returns {Object}
     */
    SegmentFetcherCreator.prototype.createSegmentFetcher = function (bufferType, callbacks) {
        var backoffOptions = getSegmentFetcherOptions(bufferType, this._backoffOptions);
        var pipelines = this._transport[bufferType];
        // Types are very complicated here as they are per-type of buffer.
        var segmentFetcher = createSegmentFetcher(bufferType, pipelines, callbacks, backoffOptions);
        return applyPrioritizerToSegmentFetcher(this._prioritizer, segmentFetcher);
    };
    return SegmentFetcherCreator;
}());
export default SegmentFetcherCreator;
