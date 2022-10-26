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

import {
  Adaptation,
  ISegment,
  Period,
  Representation,
} from "../../../manifest";
import { CancellationSignal } from "../../../utils/task_canceller";
import SegmentInventory, {
  IBufferedChunk,
  IBufferedHistoryEntry,
  IChunkContext,
  IInsertedChunkInfos,
} from "../inventory";

/**
 * Class allowing to push segments and remove data to a buffer to be able
 * to decode them in the future as well as retrieving information about which
 * segments have already been pushed.
 *
 * A `SegmentBuffer` can rely on a browser's SourceBuffer as well as being
 * entirely defined in the code.
 *
 * A SegmentBuffer is associated to a given "bufferType" (e.g. "audio",
 * "video", "text") and allows to push segments as well as removing part of
 * already-pushed segments for that type.
 *
 * Because a segment can be divided into multiple chunks, one should call the
 * `endOfSegment` method once all chunks of a given segment have been pushed
 * (through the `pushChunk` method) to validate that a segment has been
 * completely pushed.
 * It is expected to push chunks from only one segment at a time before calling
 * the `endOfSegment` function for that segment. Pushing chunks from multiple
 * segments in parallel could have unexpected result depending on the underlying
 * implementation.
 * TODO reflect that in the API?
 *
 * A SegmentBuffer also maintains an "inventory", which is the current
 * list of segments contained in the underlying buffer.
 * This inventory has to be manually "synchronized" (through the
 * `synchronizeInventory` method) before being retrieved (through the
 * `getInventory` method).
 *
 * Also depending on the underlying implementation, the various operations
 * performed on a `SegmentBuffer` (push/remove/endOfSegment) can happen
 * synchronously or asynchronously.
 * In the latter case, such operations are put in a FIFO Queue.
 * You can retrieve the current queue of operations by calling the
 * `getPendingOperations` method.
 * If operations happens synchronously, this method will just return an empty
 * array.
 */
export abstract class SegmentBuffer {
  /** "Type" of the buffer (e.g. "audio", "video", "text", "image"). */
  public readonly abstract bufferType : IBufferType;

  /** Default implementation of an inventory of segment metadata. */
  protected _segmentInventory : SegmentInventory;

  /**
   * Mimetype+codec combination the SegmentBuffer is currently working with.
   * Depending on the implementation, segments with a different codecs could be
   * incompatible.
   *
   * `undefined` if unknown and if this property does not matter for this
   * SegmentBuffer implementation.
   */
  public codec : string | undefined;

  constructor() {
    // Use SegmentInventory by default for inventory purposes
    this._segmentInventory = new SegmentInventory();
  }

  /**
   * Depending on the data appended on this SegmentBuffer, chunk/segments
   * containing media data might depend on another segment, without any data,
   * called the initialization segment. The role of the initialization segment
   * is usually to initialize the media decoders and prepare them for the
   * incoming media segments linked to it.
   *
   * This method allows to push and "declare" a new initialization segment, whose
   * `uniqueId` can then be refered in one of the arguments of the `pushChunk`
   * method, to signal that the corresponding media chunk / segment depends on
   * that initialization segment.
   *
   * Note that you _have to_ call this method before the corresponding media
   * data depending on it is pushed through `pushChunk`. Not doing so will lead
   * to an error.
   * Of course, if media data pushed through `pushChunk` does not depend on an
   * initialization segment, `declareInitSegment` shouldn't be called.
   *
   * It is also important to note that calling this method reserves space for
   * storing the initialization segment in JavaScript memory. To protect against
   * memory leaks and/or free memory resources, you can call `freeInitSegment`
   * with the same `uniqueId` as soon as the corresponding initialization
   * segment is not needed anymore.
   *
   * Calling multiple times `declareInitSegment` with the same `uniqueId`
   * without previously freeing it through the `freeInitSegment` method should
   * be avoided or at least should always be linked to the same data.
   * Not doing so may lead to unexpected errors.
   *
   * @param {string} uniqueId - Identifier identifying the initialization
   * segment. The same identifier may then be used in `freeInitSegment` or
   * `pushChunk` to refer to that initialization segment.
   * @param {*} initSegmentData - The corresponding initialization
   * segment's data.
   * @param {string} codec - Codec the initialization segment is in.
   * @param {boolean} pushToQueue - If set to `true` the initialization segment
   * will be pushed to the buffer just after all current operations (push,
   * remove, initialization segment declarations) have ended.
   * If set to `false`, it is only pushed lazily once the first media chunk
   * segment that depends on it is pushed.
   * @param {Object} cancelSignal - If `pushToQueue` is set to `false`, this
   * CancellationSignal won't have any effect.
   * If `pushToQueue` is set to `true`, this CancellationSignal will allow to
   * abort the pushing operation.
   * @returns {Promise} - The returned promise resolves immediately if the
   * `pushToQueue` argument is set to `false`, but only once the initialization
   * segment has been pushed if the `pushToQueue` argument is set to `true`.
   * It may reject if `pushToQueue` is set to `true` and the append operation
   * fails, in which case it will reject the corresponding error.
   */
  public abstract declareInitSegment(
    uniqueId : string,
    initSegmentData : unknown,
    codec : string,
    pushToQueue : boolean,
    cancelSignal : CancellationSignal
  ) : Promise<void>;

  /**
   * Removes from JavaScript memory an initialization segment, based on its
   * `uniqueId` originally communicated through `declareInitSegment`.
   * @param {string} uniqueId - The same identifier than the one communicated
   * through `declareInitSegment`.
   * @returns {boolean} - If `true` the corresponding `uniqueId` has been found
   * and removed. If `false`, that `uniqueId` didn't exist.
   */
  public abstract freeInitSegment(uniqueId : string) : boolean;

  /**
   * Push a chunk of the media segment given to the attached buffer, in a
   * FIFO queue.
   *
   * Once all chunks of a single Segment have been given to `pushChunk`, you
   * should call `endOfSegment` to indicate that the whole Segment has been
   * pushed.
   *
   * Depending on the type of data appended, the pushed chunk might rely on an
   * initialization segment, in which case this initialization segment should
   * already have been communicated through `declareInitSegment` and its
   * corresponding identifier should be communicated through `pushChunk`'s
   * argument.
   *
   * @param {Object} infos
   * @param {Object} cancellationSignal
   * @returns {Promise}
   */
  public abstract pushChunk(
    infos : IPushChunkInfos<unknown>,
    cancellationSignal : CancellationSignal
  ) : Promise<void>;

  /**
   * Remove buffered data (added to the same FIFO queue than `pushChunk`).
   * @param {number} start - start position, in seconds
   * @param {number} end - end position, in seconds
   * @param {Object} cancellationSignal
   * @returns {Promise}
   */
  public abstract removeBuffer(
    start : number,
    end : number,
    cancellationSignal : CancellationSignal
  ) : Promise<void>;

  /**
   * Indicate that every chunks from a Segment has been given to pushChunk so
   * far.
   * This will update our internal Segment inventory accordingly.
   * The returned Promise will resolve once the whole segment has been pushed
   * and this indication is acknowledged.
   * @param {Object} infos
   * @param {Object} cancellationSignal
   * @returns {Promise}
   */
  public abstract endOfSegment(
    infos : IEndOfSegmentInfos,
    cancellationSignal : CancellationSignal
  ) : Promise<void>;

  /**
   * Returns the currently buffered data, in a TimeRanges object.
   * @returns {TimeRanges}
   */
  public abstract getBufferedRanges() : TimeRanges;

  /**
   * The maintained inventory can fall out of sync from garbage collection or
   * other events.
   *
   * This methods allow to manually trigger a synchronization. It should be
   * called before retrieving Segment information from it (e.g. with
   * `getInventory`).
   */
  public synchronizeInventory() : void {
    // The default implementation just use the SegmentInventory
    this._segmentInventory.synchronizeBuffered(this.getBufferedRanges());
  }

  /**
   * Returns the currently buffered data for which the content is known with
   * the corresponding content information.
   * /!\ This data can fall out of sync with the real buffered ranges. Please
   * call `synchronizeInventory` before to make sure it is correctly
   * synchronized.
   * @returns {Array.<Object>}
   */
  public getInventory() : IBufferedChunk[] {
    // The default implementation just use the SegmentInventory
    return this._segmentInventory.getInventory();
  }

  /**
   * Returns the list of every operations that the `SegmentBuffer` is still
   * processing. From the one with the highest priority (like the one being
   * processed)
   * @returns {Array.<Object>}
   */
  public getPendingOperations() : Array<ISBOperation<unknown>> {
    // Return no pending operation by default (for synchronous SegmentBuffers)
    return [];
  }

  /**
   * Returns a recent history of registered operations performed and event
   * received linked to the segment given in argument.
   *
   * Not all operations and events are registered in the returned history.
   * Please check the return type for more information on what is available.
   *
   * Note that history is short-lived for memory usage and performance reasons.
   * You may not receive any information on operations that happened too long
   * ago.
   * @param {Object} context
   * @returns {Array.<Object>}
   */
  public getSegmentHistory(context : IChunkContext) : IBufferedHistoryEntry[] {
    return this._segmentInventory.getHistoryFor(context);
  }

  /**
   * Dispose of the resources used by this AudioVideoSegmentBuffer.
   * /!\ You won't be able to use the SegmentBuffer after calling this
   * function.
   */
  public abstract dispose() : void;
}

/** Every SegmentBuffer types. */
export type IBufferType = "audio" |
                          "video" |
                          "text" |
                          "image";

/**
 * Content of the `data` property when pushing a new chunk.
 *
 * This will contain all necessary information to decode the media data.
 * Type parameter `T` is the format of the chunk's data.
 */
export interface IPushedChunkData<T> {
  /**
   * Identifier used to identify the initialization segment linked to this
   * chunk.
   * `null` if this chunk does not depend on any initialization segment.
   *
   * See the SegmentBuffer's methods for more information.
   */
  initSegmentUniqueId: string | null;
  /**
   * Chunk you want to push.
   * This can be the whole decodable segment's data or just a decodable sub-part
   * of it.
   */
  chunk : T;
  /**
   * String corresponding to the mime-type + codec of the last segment pushed.
   * This might then be used by a SourceBuffer to infer the right codec to use.
   *
   * If set to `undefined`, the SegmentBuffer implementation will just rely on
   * a default codec it is linked to, if one.
   */
  codec : string | undefined;
  /**
   * Time offset in seconds to apply to this segment.
   * A `timestampOffset` set to `5` will mean that the segment will be decoded
   * 5 seconds after its decode time which was found from the segment data
   * itself.
   */
  timestampOffset : number;
  /**
   * Append windows for the segment. This is a tuple of two elements.
   *
   * The first indicates the "start append window". The media data of that
   * segment that should have been decoded BEFORE that time (after taking the
   * `timestampOffset` property in consideration) will be ignored.
   * This can be set to `0` or `undefined` to not apply any start append window
   * to that chunk.
   *
   * The second indicates the "end append window". The media data of that
   * segment that should have been decoded AFTER that time (after taking the
   * `timestampOffset` property in consideration) will be ignored.
   * This can be set to `0` or `undefined` to not apply any end append window
   * to that chunk.
   */
  appendWindow: [ number | undefined,
                  number | undefined ];
}

/**
 * Information to give when indicating a whole segment has been pushed via the
 * `endOfSegment` method.
 */
export interface IEndOfSegmentInfos {
  /** Adaptation object linked to the chunk. */
  adaptation : Adaptation;
  /** Period object linked to the chunk. */
  period : Period;
  /** Representation object linked to the chunk. */
  representation : Representation;
  /** The segment object linked to the pushed chunk. */
  segment : ISegment;
}

/**
 * Information to give when pushing a new chunk via the `pushChunk` method.
 * Type parameter `T` is the format of the chunk's data.
 */
export interface IPushChunkInfos<T> {
  /** Chunk that should be pushed with the associated metadata */
  data : IPushedChunkData<T>;
  /**
   * Context about the chunk that will be added to the inventory once it is
   * pushed.
   *
   * Can be set to `null` if you don't want to add an entry to the inventory
   * after that segment is pushed (e.g. can be useful for initialization
   * segments, as they take no place in a buffer).
   * Please note that an inventory might become completely un-synchronized
   * with the real media buffer if some buffered segments are not added to
   * the inventory afterwise.
   */
   inventoryInfos : IInsertedChunkInfos |
                    null;
}

/** "Operations" scheduled by a SegmentBuffer. */
export type ISBOperation<T> = IPushOperation<T> |
                              IRemoveOperation |
                              IEndOfSegmentOperation;

/**
 * Enum used by a SegmentBuffer as a discriminant in its queue of
 * "operations".
 */
export enum SegmentBufferOperation { Push,
                                     Remove,
                                     EndOfSegment }

/**
 * "Operation" created by a `SegmentBuffer` when asked to push a chunk.
 *
 * It represents a queued "Push" operation (created due to a `pushChunk` method
 * call) that is not yet fully processed by a `SegmentBuffer`.
 */
export interface IPushOperation<T> {
  /** Discriminant (allows to tell its a "Push operation"). */
  type : SegmentBufferOperation.Push;
  /** Arguments for that push. */
  value : IPushChunkInfos<T>;
}

/**
 * "Operation" created by a SegmentBuffer when asked to remove buffer.
 *
 * It represents a queued "Remove" operation (created due to a `removeBuffer`
 * method call) that is not yet fully processed by a SegmentBuffer.
 */
export interface IRemoveOperation {
  /** Discriminant (allows to tell its a "Remove operation"). */
  type : SegmentBufferOperation.Remove;
  /** Arguments for that remove (absolute start and end time, in seconds). */
  value : { start : number;
            end : number; }; }

/**
 * "Operation" created by a `SegmentBuffer` when asked to validate that a full
 * segment has been pushed through earlier `Push` operations.
 *
 * It represents a queued "EndOfSegment" operation (created due to a
 * `endOfSegment` method call) that is not yet fully processed by a
 * `SegmentBuffer.`
 */
export interface IEndOfSegmentOperation {
  /** Discriminant (allows to tell its an "EndOfSegment operation"). */
  type : SegmentBufferOperation.EndOfSegment;
  /** Arguments for that operation. */
  value : IEndOfSegmentInfos;
}
