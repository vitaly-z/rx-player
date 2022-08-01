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
import objectAssign from "../../../utils/object_assign";
/**
 * The MetaRepresentationIndex is wrapper for all kind of RepresentationIndex (from
 * dash, smooth, etc)
 *
 * It wraps methods from original RepresentationIndex, while taking into account
 * the time offset introduced by the MetaPlaylist content.
 *
 * It makes a bridge between the MetaPlaylist timeline, and the original
 * timeline of content. (e.g. the segment whose "meta" time is 1500, is actually a
 * segment whose original time is 200, played with an offset of 1300)
 * @class MetaRepresentationIndex
 */
var MetaRepresentationIndex = /** @class */ (function () {
    /**
     * Create a new `MetaRepresentationIndex`.
     * @param {Object} wrappedIndex - "Real" RepresentationIndex implementation of
     * the concerned Representation.
     * @param {Array.<number|undefined>} contentBounds - Start time and end time
     * the Representation will be played between, in seconds.
     * @param {string} transport - Transport for the "real" RepresentationIndex
     * (e.g. "dash" or "smooth").
     * @param {Object} baseContentInfos - Various information about the "real"
     * Representation.
     */
    function MetaRepresentationIndex(wrappedIndex, contentBounds, transport, baseContentInfos) {
        this._wrappedIndex = wrappedIndex;
        this._timeOffset = contentBounds[0];
        this._contentEnd = contentBounds[1];
        this._transport = transport;
        this._baseContentInfos = baseContentInfos;
    }
    /**
     * Returns information about the initialization segment.
     */
    MetaRepresentationIndex.prototype.getInitSegment = function () {
        var segment = this._wrappedIndex.getInitSegment();
        if (segment === null) {
            return null;
        }
        return this._cloneWithPrivateInfos(segment);
    };
    /**
     * Returns information about the segments asked.
     * @param {number} up - Starting time wanted, in seconds.
     * @param {Number} duration - Amount of time wanted, in seconds
     * @returns {Array.<Object>}
     */
    MetaRepresentationIndex.prototype.getSegments = function (up, duration) {
        var _this = this;
        return this._wrappedIndex.getSegments(up - this._timeOffset, duration)
            .map(function (segment) {
            var clonedSegment = _this._cloneWithPrivateInfos(segment);
            clonedSegment.time += _this._timeOffset;
            clonedSegment.end += _this._timeOffset;
            return clonedSegment;
        });
    };
    /**
     * Whether this RepresentationIndex should be refreshed now.
     * Returns `false` as MetaPlaylist contents do not support underlying live
     * contents yet.
     * @returns {Boolean}
     */
    MetaRepresentationIndex.prototype.shouldRefresh = function () {
        return false;
    };
    /**
     * Returns first possible position the first segment plays at, in seconds.
     * `undefined` if we do not know this value.
     * @return {Number|undefined}
     */
    MetaRepresentationIndex.prototype.getFirstPosition = function () {
        var wrappedFirstPosition = this._wrappedIndex.getFirstPosition();
        return wrappedFirstPosition != null ? wrappedFirstPosition + this._timeOffset :
            undefined;
    };
    /**
     * Returns last possible position the last segment plays at, in seconds.
     * `undefined` if we do not know this value.
     * @return {Number|undefined}
     */
    MetaRepresentationIndex.prototype.getLastPosition = function () {
        var wrappedLastPosition = this._wrappedIndex.getLastPosition();
        return wrappedLastPosition != null ? wrappedLastPosition + this._timeOffset :
            undefined;
    };
    /**
     * Returns `false` if that segment is not currently available in the Manifest
     * (e.g. it corresponds to a segment which is before the current buffer
     * depth).
     * @param {Object} segment
     * @returns {boolean|undefined}
     */
    MetaRepresentationIndex.prototype.isSegmentStillAvailable = function (segment) {
        var _a;
        if (((_a = segment.privateInfos) === null || _a === void 0 ? void 0 : _a.metaplaylistInfos) === undefined) {
            return false;
        }
        var originalSegment = segment.privateInfos.metaplaylistInfos.originalSegment;
        return this._wrappedIndex.isSegmentStillAvailable(originalSegment);
    };
    /**
     * @param {Error} error
     * @param {Object} segment
     * @returns {Boolean}
     */
    MetaRepresentationIndex.prototype.canBeOutOfSyncError = function (error, segment) {
        var _a;
        if (((_a = segment.privateInfos) === null || _a === void 0 ? void 0 : _a.metaplaylistInfos) === undefined) {
            return false;
        }
        var originalSegment = segment.privateInfos.metaplaylistInfos.originalSegment;
        return this._wrappedIndex.canBeOutOfSyncError(error, originalSegment);
    };
    /**
     *
     * @param {Number} time
     * @returns {Number | null}
     */
    MetaRepresentationIndex.prototype.checkDiscontinuity = function (time) {
        return this._wrappedIndex.checkDiscontinuity(time - this._timeOffset);
    };
    /**
     * @returns {Boolean}
     */
    MetaRepresentationIndex.prototype.areSegmentsChronologicallyGenerated = function () {
        return this._wrappedIndex.areSegmentsChronologicallyGenerated();
    };
    /**
     * @returns {Boolean}
     */
    MetaRepresentationIndex.prototype.isFinished = function () {
        return this._wrappedIndex.isFinished();
    };
    /**
     * @returns {Boolean}
     */
    MetaRepresentationIndex.prototype.isInitialized = function () {
        return this._wrappedIndex.isInitialized();
    };
    /**
     * @param {Object} newIndex
     */
    MetaRepresentationIndex.prototype._replace = function (newIndex) {
        if (!(newIndex instanceof MetaRepresentationIndex)) {
            throw new Error("A MetaPlaylist can only be replaced with another MetaPlaylist");
        }
        this._wrappedIndex._replace(newIndex._wrappedIndex);
    };
    /**
     * @param {Object} newIndex
     */
    MetaRepresentationIndex.prototype._update = function (newIndex) {
        if (!(newIndex instanceof MetaRepresentationIndex)) {
            throw new Error("A MetaPlaylist can only be updated with another MetaPlaylist");
        }
        this._wrappedIndex._update(newIndex._wrappedIndex);
    };
    /**
     * Clone the given segment, presumably coming from its original
     * RepresentationIndex, and add the linked metaplaylist privateInfos to it.
     * Return that cloned and enhanced segment.
     * @param {Object} segment
     * @returns {Object}
     */
    MetaRepresentationIndex.prototype._cloneWithPrivateInfos = function (segment) {
        var clonedSegment = objectAssign({}, segment);
        if (clonedSegment.privateInfos === undefined) {
            clonedSegment.privateInfos = {};
        }
        clonedSegment.privateInfos.metaplaylistInfos = {
            transportType: this._transport,
            baseContent: this._baseContentInfos,
            contentStart: this._timeOffset,
            contentEnd: this._contentEnd,
            originalSegment: segment,
        };
        return clonedSegment;
    };
    return MetaRepresentationIndex;
}());
export default MetaRepresentationIndex;
