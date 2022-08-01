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
/**
 * Simple RepresentationIndex implementation for static files.
 * @class StaticRepresentationIndex
 */
var StaticRepresentationIndex = /** @class */ (function () {
    /**
     * @param {Object} infos
     */
    function StaticRepresentationIndex(infos) {
        this._mediaURLs = infos.media;
    }
    /**
     * Static contents do not have any initialization segments.
     * Just return null.
     * @returns {null}
     */
    StaticRepresentationIndex.prototype.getInitSegment = function () {
        return null;
    };
    /**
     * Returns the only Segment available here.
     * @returns {Array.<Object>}
     */
    StaticRepresentationIndex.prototype.getSegments = function () {
        return [{ id: "0",
                isInit: false,
                number: 0,
                mediaURLs: [this._mediaURLs],
                time: 0,
                end: Number.MAX_VALUE,
                duration: Number.MAX_VALUE,
                complete: true,
                timescale: 1 }];
    };
    /**
     * Returns first position in index.
     * @returns {undefined}
     */
    StaticRepresentationIndex.prototype.getFirstPosition = function () {
        return;
    };
    /**
     * Returns last position in index.
     * @returns {undefined}
     */
    StaticRepresentationIndex.prototype.getLastPosition = function () {
        return;
    };
    /**
     * Returns false as a static file never need to be refreshed.
     * @returns {Boolean}
     */
    StaticRepresentationIndex.prototype.shouldRefresh = function () {
        return false;
    };
    /**
     * @returns {null}
     */
    StaticRepresentationIndex.prototype.checkDiscontinuity = function () {
        return null;
    };
    /**
     * @returns {boolean}
     */
    StaticRepresentationIndex.prototype.areSegmentsChronologicallyGenerated = function () {
        return true;
    };
    /**
     * Returns true as a static file should never need lose availability.
     * @returns {Boolean}
     */
    StaticRepresentationIndex.prototype.isSegmentStillAvailable = function () {
        return true;
    };
    /**
     * @returns {Boolean}
     */
    StaticRepresentationIndex.prototype.canBeOutOfSyncError = function () {
        return false;
    };
    /**
     * @returns {Boolean}
     */
    StaticRepresentationIndex.prototype.isFinished = function () {
        return true;
    };
    /**
     * @returns {Boolean}
     */
    StaticRepresentationIndex.prototype.isInitialized = function () {
        return true;
    };
    StaticRepresentationIndex.prototype._replace = function () {
        log.warn("Tried to replace a static RepresentationIndex");
    };
    StaticRepresentationIndex.prototype._update = function () {
        log.warn("Tried to update a static RepresentationIndex");
    };
    return StaticRepresentationIndex;
}());
export default StaticRepresentationIndex;
