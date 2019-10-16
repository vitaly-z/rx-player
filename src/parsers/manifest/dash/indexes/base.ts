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

import log from "../../../../log";
import {
  IRepresentationIndex,
  ISegment,
} from "../../../../manifest";
import {
  fromIndexTime,
  getIndexSegmentEnd,
  IIndexSegment,
  toIndexTime,
} from "../../utils/index_helpers";
import getInitSegment from "./get_init_segment";
import getSegmentsFromTimeline from "./get_segments_from_timeline";
import { createIndexURLs } from "./tokens";

/**
 * Index property defined for a SegmentBase RepresentationIndex
 * This object contains every property needed to generate an ISegment for a
 * given media time.
 */
export interface IBaseIndex {
  /** Byte range for a possible index of segments in the server. */
  indexRange?: [number, number];
  /**
   * Temporal offset, in the current timescale (see timescale), to add to the
   * presentation time (time a segment has at decoding time) to obtain the
   * corresponding media time (original time of the media segment in the index
   * and on the media file).
   * For example, to look for a segment beginning at a second `T` on a
   * HTMLMediaElement, we actually will look for a segment in the index
   * beginning at:
   * ```
   * T * timescale + indexTimeOffset
   * ```
   */
  indexTimeOffset : number;
  /** Information on the initialization segment. */
  initialization? : {
    /** URLs to access the initialization segment. */
    mediaURLs: string[] | null;
    /** possible byte range to request it. */
    range?: [number, number];
  };
  /**
   * Base URL(s) to access any segment. Can contain tokens to replace to convert
   * it to real URLs.
   */
  mediaURLs : string[] | null;
  /** Number from which the first segments in this index starts with. */
  startNumber? : number;
  /** Every segments defined in this index. */
  timeline : IIndexSegment[];
  /**
   * Timescale to convert a time given here into seconds.
   * This is done by this simple operation:
   * ``timeInSeconds = timeInIndex * timescale``
   */
  timescale : number;
}

/**
 * `index` Argument for a SegmentBase RepresentationIndex.
 * Most of the properties here are already defined in IBaseIndex.
 */
export interface IBaseIndexIndexArgument {
  timeline? : IIndexSegment[];
  timescale? : number;
  media? : string;
  indexRange?: [number, number];
  initialization?: { media?: string; range?: [number, number] };
  startNumber? : number;
  /**
   * Offset present in the index to convert from the mediaTime (time declared in
   * the media segments and in this index) to the presentationTime (time wanted
   * when decoding the segment).  Basically by doing something along the line
   * of:
   * ```
   * presentationTimeInSeconds =
   *   mediaTimeInSeconds -
   *   presentationTimeOffsetInSeconds +
   *   periodStartInSeconds
   * ```
   * The time given here is in the current
   * timescale (see timescale)
   */
  presentationTimeOffset? : number;
}

/** Aditional context needed by a SegmentBase RepresentationIndex. */
export interface IBaseIndexContextArgument {
  /** Start of the period concerned by this RepresentationIndex, in seconds. */
  periodStart : number;
  /** End of the period concerned by this RepresentationIndex, in seconds. */
  periodEnd : number|undefined;
  /** Base URL for the Representation concerned. */
  representationBaseURLs : string[];
  /** ID of the Representation concerned. */
  representationId? : string;
  /** Bitrate of the Representation concerned. */
  representationBitrate? : number;
}

/**
 * Add a new segment to the index.
 *
 * /!\ Mutate the given index
 * @param {Object} index
 * @param {Object} segmentInfos
 * @returns {Boolean} - true if the segment has been added
 */
function _addSegmentInfos(
  index : IBaseIndex,
  segmentInfos : { time : number;
                   duration : number;
                   timescale : number;
                   count?: number;
                   range?: [number, number]; }
) : boolean {
  if (segmentInfos.timescale !== index.timescale) {
    const { timescale } = index;
    index.timeline.push({ start: (segmentInfos.time / segmentInfos.timescale)
                                 * timescale,
                          duration: (segmentInfos.duration / segmentInfos.timescale)
                                    * timescale,
                          repeatCount: segmentInfos.count === undefined ?
                            0 :
                            segmentInfos.count,
                          range: segmentInfos.range });
  } else {
    index.timeline.push({ start: segmentInfos.time,
                          duration: segmentInfos.duration,
                          repeatCount: segmentInfos.count === undefined ?
                            0 :
                            segmentInfos.count,
                          range: segmentInfos.range });
  }
  return true;
}

export default class BaseRepresentationIndex implements IRepresentationIndex {
  /** Underlying structure to retrieve segment information. */
  private _index : IBaseIndex;
  private _hypotheticalInitRange: boolean;
  private _isContentFragmented: boolean;

  /** Absolute end of the period, timescaled and converted to index time. */
  private _scaledPeriodEnd : number | undefined;

  /**
   * @param {Object} index
   * @param {Object} context
   */
  constructor(index : IBaseIndexIndexArgument,
              context : IBaseIndexContextArgument,
              isContentFragmented: boolean) {
    const { periodStart,
            periodEnd,
            representationBaseURLs,
            representationId,
            representationBitrate } = context;
    const { timescale } = index;
    this._isContentFragmented = isContentFragmented;
    const presentationTimeOffset = index.presentationTimeOffset != null ?
      index.presentationTimeOffset : 0;

    const realTimescale = (timescale != null ? timescale : 1);
    const indexTimeOffset = presentationTimeOffset - periodStart * realTimescale;

    const mediaURLs = createIndexURLs(representationBaseURLs,
                                     index.initialization !== undefined ?
                                       index.initialization.media :
                                       undefined,
                                    representationId,
                                    representationBitrate);

    // TODO If indexRange is behind the initialization segment
    // the following logic will not work.
    // If no range and index range are given by manifest, we take
    // as init segment the nth first bytes (where n = 1500).
    // Therefore, we need to filter on init boxes after the segment
    // is loaded, to ensure that we push a complete and dry segment
    // to buffers.
    let range: [number, number] | undefined;
    this._hypotheticalInitRange = false;
    if (index.initialization === undefined &&
        index.indexRange === undefined &&
        this._isContentFragmented) {
      range = [0, 1500];
      this._hypotheticalInitRange = true;
    } else {
      if (index.initialization != null) {
        range = index.initialization.range;
      } else if (index.indexRange != null) {
        range = [0, index.indexRange[0] - 1];
      }
    }

    this._index = { indexRange: index.indexRange,
                    indexTimeOffset,
                    initialization: { mediaURLs, range },
                    mediaURLs: createIndexURLs(representationBaseURLs,
                                               index.media,
                                               representationId,
                                               representationBitrate),
                    startNumber: index.startNumber,
                    timeline: index.timeline || [],
                    timescale: realTimescale };
    this._scaledPeriodEnd = periodEnd == null ? undefined :
                                                toIndexTime(periodEnd, this._index);
  }

  /**
   * Construct init Segment.
   * @returns {Object}
   */
  getInitSegment() : ISegment | null {
    // As content is not fragmented, no init segment by default
    if (!this._isContentFragmented) {
      return null;
    }
    const initSegment = getInitSegment(this._index);
    initSegment.hypotheticalInitRange = this._hypotheticalInitRange;
    return initSegment;
  }

  /**
   * @param {Number} _up
   * @param {Number} _to
   * @returns {Array.<Object>}
   */
  getSegments(_up : number, _to : number) : ISegment[] {
    if (!this._isContentFragmented) {
      // Return whole segment
      return [{ id: "0",
                isInit: false,
                number: 0,
                time: 0,
                duration: Number.MAX_VALUE,
                timescale: 1,
                mediaURL: this._index.mediaURL }];
    }
    return getSegmentsFromTimeline(this._index, _up, _to, this._scaledPeriodEnd);
  }

  /**
   * Returns false as no Segment-Base based index should need to be refreshed.
   * @returns {Boolean}
   */
  shouldRefresh() : false {
    return false;
  }

  /**
   * Returns first position in index.
   * @returns {Number|null}
   */
  getFirstPosition() : number|null {
    const index = this._index;
    if (index.timeline.length === 0) {
      return null;
    }
    return fromIndexTime(index.timeline[0].start, index);
  }

  /**
   * Returns last position in index.
   * @returns {Number|null}
   */
  getLastPosition() : number|null {
    const { timeline } = this._index;
    if (timeline.length === 0) {
      return null;
    }
    const lastTimelineElement = timeline[timeline.length - 1];
    const lastTime = getIndexSegmentEnd(lastTimelineElement,
                                        null,
                                        this._scaledPeriodEnd);
    return fromIndexTime(lastTime, this._index);
  }

  /**
   * Segments in a segmentBase scheme should stay available.
   * @returns {Boolean|undefined}
   */
  isSegmentStillAvailable() : true {
    return true;
  }

  /**
   * We do not check for discontinuity in SegmentBase-based indexes.
   * @returns {Number}
   */
  checkDiscontinuity() : -1 {
    return -1;
  }

  /**
   * @param {Array.<Object>} nextSegments
   * @returns {Array.<Object>}
   */
  _addSegments(nextSegments : Array<{ time : number;
                                      duration : number;
                                      timescale : number;
                                      count? : number;
                                      range? : [number, number]; }>
  ) : void {
    for (let i = 0; i < nextSegments.length; i++) {
      _addSegmentInfos(this._index, nextSegments[i]);
    }
  }

  /**
   * Returns true as SegmentBase does not get updated.
   * @returns {Boolean}
   */
  canBeOutOfSyncError() : false {
    return false;
  }

  /**
   * Returns true as SegmentBase does not get updated.
   * @returns {Boolean}
   */
  isFinished() : true {
    return true;
  }

  /**
   * @param {Object} newIndex
   */
  _replace(newIndex : BaseRepresentationIndex) : void {
    this._index = newIndex._index;
  }

  _update() : void {
    log.error("Base RepresentationIndex: Cannot update a SegmentList");
  }
}
