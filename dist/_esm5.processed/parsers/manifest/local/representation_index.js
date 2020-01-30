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
import log from "../../../log";
/**
 * @param {Object} index
 * @param {string} representationId
 * @returns {Object}
 */
export default function createRepresentationIndex(index, representationId, isFinished) {
    return {
        /**
         * @returns {Object}
         */
        getInitSegment: function () {
            return {
                id: representationId + "_init",
                isInit: true,
                time: 0,
                duration: 0,
                timescale: 1,
                mediaURL: null,
                privateInfos: {
                    localManifestInitSegment: { load: index.loadInitSegment }
                },
            };
        },
        /**
         * @param {Number} up
         * @param {Number} duration
         * @returns {Array.<Object>}
         */
        getSegments: function (up, duration) {
            var startTime = up;
            var endTime = up + duration;
            var wantedSegments = [];
            for (var i = 0; i < index.segments.length; i++) {
                var segment = index.segments[i];
                var segmentStart = segment.time / 1000;
                if (endTime <= segmentStart) {
                    break;
                }
                var segmentEnd = (segment.time + segment.duration) / 1000;
                if (segmentEnd > startTime) {
                    wantedSegments.push(segment);
                }
            }
            return wantedSegments
                .map(function (wantedSegment) {
                return {
                    id: representationId + "_" + wantedSegment.time,
                    isInit: false,
                    time: wantedSegment.time,
                    duration: wantedSegment.duration,
                    timescale: 1000,
                    timestampOffset: wantedSegment.timestampOffset,
                    mediaURL: null,
                    privateInfos: {
                        localManifestSegment: { load: index.loadSegment,
                            segment: wantedSegment },
                    },
                };
            });
        },
        /**
         * @returns {Number|undefined}
         */
        getFirstPosition: function () {
            if (index.segments.length === 0) {
                return undefined;
            }
            return index.segments[0].time;
        },
        /**
         * @returns {Number|undefined}
         */
        getLastPosition: function () {
            if (index.segments.length === 0) {
                return undefined;
            }
            return index.segments[index.segments.length - 1].time;
        },
        /**
         * @returns {Boolean}
         */
        shouldRefresh: function () {
            return false;
        },
        /**
         * @returns {Boolean}
         */
        isSegmentStillAvailable: function () {
            return true;
        },
        isFinished: function () {
            return isFinished;
        },
        /**
         * @returns {Boolean}
         */
        canBeOutOfSyncError: function () {
            return false;
        },
        /**
         * @returns {Number}
         */
        checkDiscontinuity: function () {
            return -1;
        },
        _update: function () {
            if (false) {
                log.warn("Tried to update a local Manifest RepresentationIndex");
            }
        },
        _addSegments: function () {
            if (false) {
                log.warn("Tried to add Segments to a local Manifest RepresentationIndex");
            }
        },
    };
}
