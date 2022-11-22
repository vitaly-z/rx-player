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

import isNullOrUndefined from "../utils/is_null_or_undefined";
import { ISentManifest } from "../worker";
import Adaptation from "./adaptation";
import Period from "./period";
import Representation from "./representation";
import { ISegment } from "./representation_index";

/** All information needed to identify a given segment. */
export interface IBufferedChunkInfos { adaptation : Adaptation;
                                       period : Period;
                                       representation : Representation;
                                       segment : ISegment; }

/**
 * Check if two contents are the same
 * @param {Object} content1
 * @param {Object} content2
 * @returns {boolean}
 */
export function areSameContent(
  content1: IBufferedChunkInfos,
  content2: IBufferedChunkInfos
): boolean {
  return (content1.segment.id === content2.segment.id &&
          content1.representation.id === content2.representation.id &&
          content1.adaptation.id === content2.adaptation.id &&
          content1.period.id === content2.period.id);
}

/**
 * Get string describing a given ISegment, useful for log functions.
 * @param {Object} content
 * @returns {string|null|undefined}
 */
export function getLoggableSegmentId(
  content : IBufferedChunkInfos | null | undefined
) : string {
  if (isNullOrUndefined(content)) {
    return "";
  }
  const { period, adaptation, representation, segment } = content;
  return `${adaptation.type} P: ${period.id} A: ${adaptation.id} ` +
         `R: ${representation.id} S: ` +
         (segment.isInit   ? "init" :
          segment.complete ? `${segment.time}-${segment.duration}` :
                             `${segment.time}`);
}

/**
 * Returns the theoretical minimum playable position on the content
 * regardless of the current Adaptation chosen, as estimated at parsing
 * time.
 * @param {Object} manifest
 * @returns {number}
 */
export function getMinimumSafePosition(manifest : ISentManifest) : number {
  const windowData = manifest.timeBounds;
  if (windowData.timeshiftDepth === null) {
    return windowData.minimumSafePosition ?? 0;
  }

  const { maximumTimeData } = windowData;
  let maximumTime : number;
  if (!windowData.maximumTimeData.isLinear) {
    maximumTime = maximumTimeData.maximumSafePosition;
  } else {
    const timeDiff = performance.now() - maximumTimeData.time;
    maximumTime = maximumTimeData.maximumSafePosition + timeDiff / 1000;
  }
  const theoricalMinimum = maximumTime - windowData.timeshiftDepth;
  return Math.max(windowData.minimumSafePosition ?? 0, theoricalMinimum);
}

/**
 * Get the position of the live edge - that is, the position of what is
 * currently being broadcasted, in seconds.
 * @param {Object} manifest
 * @returns {number|undefined}
 */
export function getLivePosition(manifest : ISentManifest) : number | undefined {
  const { maximumTimeData } = manifest.timeBounds;
  if (!manifest.isLive || maximumTimeData.livePosition === undefined) {
    return undefined;
  }
  if (!maximumTimeData.isLinear) {
    return maximumTimeData.livePosition;
  }
  const timeDiff = performance.now() - maximumTimeData.time;
  return maximumTimeData.livePosition + timeDiff / 1000;
}

/**
 * Returns the theoretical maximum playable position on the content
 * regardless of the current Adaptation chosen, as estimated at parsing
 * time.
 * @param {Object} manifest
 * @returns {number}
 */
export function getMaximumSafePosition(manifest : ISentManifest) : number {
  const { maximumTimeData } = manifest.timeBounds;
  if (!maximumTimeData.isLinear) {
    return maximumTimeData.maximumSafePosition;
  }
  const timeDiff = performance.now() - maximumTimeData.time;
  return maximumTimeData.maximumSafePosition + timeDiff / 1000;
}
