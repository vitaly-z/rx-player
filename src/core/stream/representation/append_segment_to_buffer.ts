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

/**
 * This file allows any Stream to push data to a SegmentBuffer.
 */

import { MediaError } from "../../../errors";
import { CancellationSignal } from "../../../utils/task_canceller";
import { IReadOnlyPlaybackObserver } from "../../api";
import {
  IPushChunkInfos,
  SegmentBuffer,
} from "../../segment_buffers";
import forceGarbageCollection from "./force_garbage_collection";
import { IRepresentationStreamPlaybackObservation } from "./representation_stream";

/**
 * Append a media (non-initialization) segment to the given segmentBuffer.
 * If it leads to a QuotaExceededError, try to run our custom range
 * _garbage collector_ then retry.
 * @param {Observable} playbackObserver
 * @param {Object} segmentBuffer
 * @param {Object} dataInfos
 * @param {Object} cancelSignal
 * @returns {Promise}
 */
export async function appendMediaSegmentToBuffer<T>(
  playbackObserver : IReadOnlyPlaybackObserver<IRepresentationStreamPlaybackObservation>,
  segmentBuffer : SegmentBuffer,
  dataInfos : IPushChunkInfos<T>,
  cancelSignal : CancellationSignal
) : Promise<void> {
  try {
    await segmentBuffer.pushChunk(dataInfos, cancelSignal);
  } catch (appendError : unknown) {
    await handlePushError(appendError, playbackObserver, segmentBuffer, cancelSignal);
    await segmentBuffer.pushChunk(dataInfos, cancelSignal);
  }
}

/**
 * Append a media (non-initialization) segment to the given segmentBuffer.
 * If it leads to a QuotaExceededError, try to run our custom range
 * _garbage collector_ then retry.
 * @param {Observable} playbackObserver
 * @param {Object} segmentBuffer
 * @param {Object} dataInfos
 * @param {Object} cancelSignal
 * @returns {Promise}
 */
export async function appendInitSegmentToBuffer<T>(
  playbackObserver : IReadOnlyPlaybackObserver<IRepresentationStreamPlaybackObservation>,
  segmentBuffer : SegmentBuffer,
  dataInfos : {
    uniqueId : string;
    codec : string;
    data : T;
  },
  cancelSignal : CancellationSignal
) : Promise<void> {
  try {
    await segmentBuffer.declareInitSegment(dataInfos.uniqueId,
                                           dataInfos.data,
                                           dataInfos.codec,
                                           true,
                                           cancelSignal);
  } catch (appendError : unknown) {
    await handlePushError(appendError, playbackObserver, segmentBuffer, cancelSignal);
    await segmentBuffer.declareInitSegment(dataInfos.uniqueId,
                                           dataInfos.data,
                                           dataInfos.codec,
                                           true,
                                           cancelSignal);
  }
}

/**
 * @param {Observable} playbackObserver
 * @param {Object} segmentBuffer
 * @param {Object} cancelSignal
 * @returns {Promise}
 */
export async function handlePushError(
  error : unknown,
  playbackObserver : IReadOnlyPlaybackObserver<IRepresentationStreamPlaybackObservation>,
  segmentBuffer : SegmentBuffer,
  cancelSignal : CancellationSignal
) : Promise<void> {
  if (!(error instanceof Error) || error.name !== "QuotaExceededError") {
    const reason = error instanceof Error ?
      error.toString() :
      "An unknown error happened when pushing content";
    throw new MediaError("BUFFER_APPEND_ERROR", reason);
  }
  const { position } = playbackObserver.getReference().getValue();
  const currentPos = position.pending ?? position.last;
  try {
    await forceGarbageCollection(currentPos, segmentBuffer, cancelSignal);
  } catch (err2) {
    const reason = err2 instanceof Error ? err2.toString() :
                                           "Could not clean the buffer";

    throw new MediaError("BUFFER_FULL_ERROR", reason);
  }
}
