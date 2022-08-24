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
import {
  IRepresentationIndex,
  ISegment,
} from "../../../manifest";
import {
  ILocalIndex,
  ILocalIndexSegment,
} from "./types";

export default class LocalRepresentationIndex implements IRepresentationIndex {
  private _index : ILocalIndex;
  private _representationId : string;
  constructor(index : ILocalIndex, representationId : string) {
    this._index = index;
    this._representationId = representationId;
  }

  /**
   * @returns {Object}
   */
  getInitSegment() : ISegment|null {
    return {
      id: `${this._representationId}_init`,
      isInit: true,
      time: 0,
      end: 0,
      duration: 0,
      timescale: 1,
      mediaURLs: null,
      complete: true,
      privateInfos: {
        localManifestInitSegment: { load: this._index.loadInitSegment } },
    };
  }

  /**
   * @param {Number} up
   * @param {Number} duration
   * @returns {Array.<Object>}
   */
  getSegments(up : number, duration : number) : ISegment[] {
    const startTime = up;
    const endTime = up + duration;
    const wantedSegments : ILocalIndexSegment[] = [];
    for (let i = 0; i < this._index.segments.length; i++) {
      const segment = this._index.segments[i];
      const segmentStart = segment.time;
      if (endTime <= segmentStart) {
        break;
      }
      const segmentEnd = segment.time + segment.duration;
      if (segmentEnd > startTime) {
        wantedSegments.push(segment);
      }
    }

    return wantedSegments
      .map(wantedSegment => {
        return {
          id: `${this._representationId}_${wantedSegment.time}`,
          isInit: false,
          time: wantedSegment.time,
          end: wantedSegment.time + wantedSegment.duration,
          duration: wantedSegment.duration,
          timescale: 1,
          timestampOffset: wantedSegment.timestampOffset,
          mediaURLs: null,
          complete: true,
          privateInfos: {
            localManifestSegment: { load: this._index.loadSegment,
                                    segment: wantedSegment },
          },
        };
      });
  }

  /**
   * @returns {Number|undefined}
   */
  getFirstAvailablePosition() : number|undefined {
    if (this._index.segments.length === 0) {
      return undefined;
    }
    const firstSegment = this._index.segments[0];
    return firstSegment.time;
  }

  /**
   * @returns {Number|undefined}
   */
  getLastAvailablePosition() : number|undefined {
    if (this._index.segments.length === 0) {
      return undefined;
    }
    const lastSegment = this._index.segments[this._index.segments.length - 1];
    return lastSegment.time + lastSegment.duration;
  }

  /**
   * Returns the expected ending position of this RepresentationIndex.
   * `undefined` if unknown.
   * @returns {number|undefined}
   */
  getEnd() : number | undefined {
    if (this._index.isFinished) {
      return this.getLastAvailablePosition();
    }

    const { futureSegments, segments } = this._index;
    if (futureSegments === undefined || futureSegments.length === 0) {
      // If futureSegments is empty but not finished... It's ambiguous.
      return undefined;
    }
    const lastFutureSegment = futureSegments[futureSegments.length - 1];
    const futureSegmentEnd = lastFutureSegment.time + lastFutureSegment.duration;
    if (segments.length === 0) {
      return futureSegmentEnd;
    }
    const lastSegment = this._index.segments[this._index.segments.length - 1];
    return Math.max(lastSegment.time + lastSegment.duration, futureSegmentEnd);
  }

  /**
   * Returns:
   *   - `true` if in the given time interval, at least one new segment is
   *     expected to be available in the future.
   *   - `false` either if all segments in that time interval are already
   *     available for download or if none will ever be available for it.
   *   - `undefined` when it is not possible to tell.
   * @param {number} start
   * @param {number} end
   * @returns {boolean|undefined}
   */
  awaitSegmentBetween(start: number, end: number): boolean | undefined {
    if (this.isFinished()) {
      return false;
    }
    if (this._index.futureSegments === undefined) {
      return undefined;
    }
    return this._index.futureSegments.some((seg) =>
      seg.time < end && (seg.time + seg.duration) > start);
  }

  /**
   * @returns {Boolean}
   */
  shouldRefresh() : false {
    return false;
  }

  /**
   * @returns {Boolean}
   */
  isSegmentStillAvailable() : true {
    return true;
  }

  isFinished() : boolean {
    return this._index.isFinished;
  }

  /**
   * @returns {Boolean}
   */
  canBeOutOfSyncError() : false {
    return false;
  }

  /**
   * @returns {null}
   */
  checkDiscontinuity() : null {
    return null;
  }

  /**
   * @returns {boolean}
   */
  areSegmentsChronologicallyGenerated() : boolean {
    return false;
  }

  /**
   * @returns {Boolean}
   */
  isInitialized() : true {
    return true;
  }

  _replace(newIndex : LocalRepresentationIndex) : void {
    this._index.segments = newIndex._index.segments;
    this._index.loadSegment = newIndex._index.loadSegment;
    this._index.loadInitSegment = newIndex._index.loadInitSegment;
  }

  _update(newIndex : LocalRepresentationIndex) : void {
    const newSegments = newIndex._index.segments;
    if (newSegments.length <= 0) {
      return;
    }
    const insertNewIndexAtPosition = (pos : number) : void => {
      this._index.segments.splice(pos, oldIndexLength - pos, ...newSegments);
      this._index.loadSegment = newIndex._index.loadSegment;
      this._index.loadInitSegment = newIndex._index.loadInitSegment;
    };
    const oldIndexLength = this._index.segments.length;
    const newIndexStart = newSegments[0].time;
    for (let i = oldIndexLength - 1; i >= 0; i--) {
      const currSegment = this._index.segments[i];
      if (currSegment.time === newIndexStart) {
        return insertNewIndexAtPosition(i);
      } else if (currSegment.time < newIndexStart) {
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
    const oldIndexEnd = this._index.segments[oldIndexLength - 1].time +
                        this._index.segments[oldIndexLength - 1].duration;
    const newIndexEnd = newSegments[newSegments.length - 1].time +
                          newSegments[newSegments.length - 1].duration;
    if (oldIndexEnd >= newIndexEnd) {
      return;
    }
    return this._replace(newIndex);
  }
}
