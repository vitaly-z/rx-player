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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import log from "../../../log";
var LocalRepresentationIndex = /** @class */ (function () {
    function LocalRepresentationIndex(index, representationId, isFinished) {
        this._index = index;
        this._representationId = representationId;
        this._isFinished = isFinished;
    }
    /**
     * @returns {Object}
     */
    LocalRepresentationIndex.prototype.getInitSegment = function () {
        return {
            id: "".concat(this._representationId, "_init"),
            isInit: true,
            time: 0,
            end: 0,
            duration: 0,
            timescale: 1,
            mediaURLs: null,
            complete: true,
            privateInfos: {
                localManifestInitSegment: { load: this._index.loadInitSegment }
            },
        };
    };
    /**
     * @param {Number} up
     * @param {Number} duration
     * @returns {Array.<Object>}
     */
    LocalRepresentationIndex.prototype.getSegments = function (up, duration) {
        var _this = this;
        var startTime = up;
        var endTime = up + duration;
        var wantedSegments = [];
        for (var i = 0; i < this._index.segments.length; i++) {
            var segment = this._index.segments[i];
            var segmentStart = segment.time;
            if (endTime <= segmentStart) {
                break;
            }
            var segmentEnd = segment.time + segment.duration;
            if (segmentEnd > startTime) {
                wantedSegments.push(segment);
            }
        }
        return wantedSegments
            .map(function (wantedSegment) {
            return {
                id: "".concat(_this._representationId, "_").concat(wantedSegment.time),
                isInit: false,
                time: wantedSegment.time,
                end: wantedSegment.time + wantedSegment.duration,
                duration: wantedSegment.duration,
                timescale: 1,
                timestampOffset: wantedSegment.timestampOffset,
                mediaURLs: null,
                complete: true,
                privateInfos: {
                    localManifestSegment: { load: _this._index.loadSegment,
                        segment: wantedSegment },
                },
            };
        });
    };
    /**
     * @returns {Number|undefined}
     */
    LocalRepresentationIndex.prototype.getFirstPosition = function () {
        if (this._index.segments.length === 0) {
            return undefined;
        }
        var firstSegment = this._index.segments[0];
        return firstSegment.time;
    };
    /**
     * @returns {Number|undefined}
     */
    LocalRepresentationIndex.prototype.getLastPosition = function () {
        if (this._index.segments.length === 0) {
            return undefined;
        }
        var lastSegment = this._index.segments[this._index.segments.length - 1];
        return lastSegment.time;
    };
    /**
     * @returns {Boolean}
     */
    LocalRepresentationIndex.prototype.shouldRefresh = function () {
        return false;
    };
    /**
     * @returns {Boolean}
     */
    LocalRepresentationIndex.prototype.isSegmentStillAvailable = function () {
        return true;
    };
    LocalRepresentationIndex.prototype.isFinished = function () {
        return this._isFinished;
    };
    /**
     * @returns {Boolean}
     */
    LocalRepresentationIndex.prototype.canBeOutOfSyncError = function () {
        return false;
    };
    /**
     * @returns {null}
     */
    LocalRepresentationIndex.prototype.checkDiscontinuity = function () {
        return null;
    };
    /**
     * @returns {boolean}
     */
    LocalRepresentationIndex.prototype.areSegmentsChronologicallyGenerated = function () {
        return false;
    };
    /**
     * @returns {Boolean}
     */
    LocalRepresentationIndex.prototype.isInitialized = function () {
        return true;
    };
    LocalRepresentationIndex.prototype._replace = function (newIndex) {
        this._isFinished = newIndex._isFinished;
        this._index.segments = newIndex._index.segments;
        this._index.loadSegment = newIndex._index.loadSegment;
        this._index.loadInitSegment = newIndex._index.loadInitSegment;
    };
    LocalRepresentationIndex.prototype._update = function (newIndex) {
        var _this = this;
        this._isFinished = newIndex._isFinished;
        var newSegments = newIndex._index.segments;
        if (newSegments.length <= 0) {
            return;
        }
        var insertNewIndexAtPosition = function (pos) {
            var _a;
            (_a = _this._index.segments).splice.apply(_a, __spreadArray([pos, oldIndexLength - pos], newSegments, false));
            _this._index.loadSegment = newIndex._index.loadSegment;
            _this._index.loadInitSegment = newIndex._index.loadInitSegment;
        };
        var oldIndexLength = this._index.segments.length;
        var newIndexStart = newSegments[0].time;
        for (var i = oldIndexLength - 1; i >= 0; i--) {
            var currSegment = this._index.segments[i];
            if (currSegment.time === newIndexStart) {
                return insertNewIndexAtPosition(i);
            }
            else if (currSegment.time < newIndexStart) {
                if (currSegment.time + currSegment.duration > newIndexStart) {
                    // the new Manifest overlaps a previous segment (weird). Remove the latter.
                    log.warn("Local RepresentationIndex: Manifest update removed" +
                        " previous segments");
                    return insertNewIndexAtPosition(i);
                }
                return insertNewIndexAtPosition(i + 1);
            }
        }
        // if we got here, it means that every segments in the previous manifest are
        // after the new one. This is unusual.
        // Either the new one has more depth or it's an older one.
        var oldIndexEnd = this._index.segments[oldIndexLength - 1].time +
            this._index.segments[oldIndexLength - 1].duration;
        var newIndexEnd = newSegments[newSegments.length - 1].time +
            newSegments[newSegments.length - 1].duration;
        if (oldIndexEnd >= newIndexEnd) {
            return;
        }
        return this._replace(newIndex);
    };
    return LocalRepresentationIndex;
}());
export default LocalRepresentationIndex;
