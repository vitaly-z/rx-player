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
 * This file allows to create RepresentationStreams.
 *
 * A RepresentationStream downloads and push segment for a single
 * Representation (e.g. a single video stream of a given quality).
 * It chooses which segments should be downloaded according to the current
 * position and what is currently buffered.
 */

import nextTick from "next-tick";
import {
  combineLatest as observableCombineLatest,
  concat as observableConcat,
  defer as observableDefer,
  EMPTY,
  merge as observableMerge,
  Observable,
  of as observableOf,
  Subject,
} from "rxjs";
import {
  ignoreElements,
  mergeMap,
  startWith,
  take,
  takeUntil,
  takeWhile,
  withLatestFrom,
} from "rxjs/operators";
import log from "../../../log";
import Manifest, {
  Adaptation,
  ISegment,
  Period,
  Representation,
} from "../../../manifest";
import {
  ISegmentParserParsedInitSegment,
  ISegmentParserResponse,
} from "../../../transports";
import assertUnreachable from "../../../utils/assert_unreachable";
import objectAssign from "../../../utils/object_assign";
import { IStalledStatus } from "../../api";
import {
  ISegmentQueue,
  ISegmentQueueEvent,
  ISegmentQueueItem,
} from "../../fetchers";
import { QueuedSourceBuffer } from "../../source_buffers";
import EVENTS from "../events_generators";
import {
  IProtectedSegmentEvent,
  IRepresentationStreamEvent,
  IStreamEventAddedSegment,
  IStreamManifestMightBeOutOfSync,
  IStreamNeedsDiscontinuitySeek,
  IStreamNeedsManifestRefresh,
  IStreamStateActive,
  IStreamStateFull,
  IStreamTerminatingEvent,
  IStreamWarningEvent,
} from "../types";
import getNeededSegments from "./get_needed_segments";
import getSegmentPriority, {
  getPriorityForTime
} from "./get_segment_priority";
import getWantedRange from "./get_wanted_range";
import pushInitSegment from "./push_init_segment";
import pushMediaSegment from "./push_media_segment";

/** Object emitted by the Stream's clock$ at each tick. */
export interface IRepresentationStreamClockTick {
  /** The current position, in seconds the media element is in, in seconds. */
  currentTime : number;
 /**
  * Gap between the current position and the edge of a live content.
  * Not set for non-live contents.
  */
  liveGap? : number;
  /** If set, the player is currently stalled (blocked). */
  stalled : IStalledStatus|null;
  /**
   * Offset in seconds to add to `currentTime` to obtain the position we
   * actually want to download from.
   * This is mostly useful when starting to play a content, where `currentTime`
   * might still be equal to `0` but you actually want to download from a
   * starting position different from `0`.
   */
  wantedTimeOffset : number;
}

/** Item emitted by the `terminate$` Observable given to a RepresentationStream. */
export interface ITerminationOrder {
  /*
   * If `true`, the RepresentationStream should interrupt immediately every long
   * pending operations such as segment downloads.
   * If it is set to `false`, it can continue until those operations are
   * finished.
   */
  urgent : boolean;
}

/** Arguments to give to the RepresentationStream. */
export interface IRepresentationStreamArguments<T> {
  /** Periodically emits the current playback conditions. */
  clock$ : Observable<IRepresentationStreamClockTick>;
  /** The context of the Representation you want to load. */
  content: { adaptation : Adaptation;
             manifest : Manifest;
             period : Period;
             representation : Representation; };
  /** The `QueuedSourceBuffer` on which segments will be pushed. */
  queuedSourceBuffer : QueuedSourceBuffer<T>;
  /** Interface used to load new segments. */
  segmentQueue : ISegmentQueue<T>;
  /**
   * Observable emitting when the RepresentationStream should "terminate".
   *
   * When this Observable emits, the RepresentationStream will begin a
   * "termination process": it will, depending on the type of termination
   * wanted, either stop immediately pending segment requests or wait until they
   * are finished before fully terminating (sending the
   * `IStreamTerminatingEvent` and then completing the `RepresentationStream`
   * Observable once the corresponding segments have been pushed).
   */
  terminate$ : Observable<ITerminationOrder>;
  /**
   * The buffer size we have to reach in seconds (compared to the current
   * position. When that size is reached, no segments will be loaded until it
   * goes below that size again.
   */
  bufferGoal$ : Observable<number>;
  /**
   * Bitrate threshold from which no "fast-switching" should occur on a segment.
   *
   * Fast-switching is an optimization allowing to replace segments from a
   * low-bitrate Representation by segments from a higher-bitrate
   * Representation. This allows the user to see/hear an improvement in quality
   * faster, hence "fast-switching".
   *
   * This Observable allows to limit this behavior to only allow the replacement
   * of segments with a bitrate lower than a specific value - the number emitted
   * by that Observable.
   *
   * If set to `undefined`, no threshold is active and any segment can be
   * replaced by higher quality segment(s).
   *
   * `0` can be emitted to disable any kind of fast-switching.
   */
  fastSwitchThreshold$: Observable< undefined | number>;
}

/**
 * Build up buffer for a single Representation.
 *
 * Download and push segments linked to the given Representation according
 * to what is already in the SourceBuffer and where the playback currently is.
 *
 * Multiple RepresentationStream observables can run on the same SourceBuffer.
 * This allows for example smooth transitions between multiple periods.
 *
 * @param {Object} args
 * @returns {Observable}
 */
export default function RepresentationStream<T>({
  bufferGoal$,
  clock$,
  content,
  fastSwitchThreshold$,
  queuedSourceBuffer,
  segmentQueue,
  terminate$,
} : IRepresentationStreamArguments<T>) : Observable<IRepresentationStreamEvent<T>> {
  const { period, adaptation, representation } = content;
  const bufferType = adaptation.type;
  const initSegment = representation.index.getInitSegment();

  /**
   * Saved initialization segment state for this representation.
   * `null` if the initialization segment hasn't been loaded yet.
   */
  let initSegmentObject : ISegmentParserParsedInitSegment<T> | null =
    initSegment == null ? { initializationData: null,
                            segmentProtections: [],
                            initTimescale: undefined } :
                          null;

  /** Immediately checks the Stream's status when it emits. */
  const reCheckStatus$ = new Subject<void>();

  /** Kill the RepresentationStream after the termination process ends. */
  const destroy$ = new Subject<void>();

  const status$ = observableCombineLatest([
    clock$,
    bufferGoal$,
    terminate$.pipe(take(1),
                    startWith(null)),
    reCheckStatus$.pipe(startWith(undefined)) ]
  ).pipe(
    withLatestFrom(fastSwitchThreshold$),
    mergeMap(function getCurrentStatus(
      [ [ timing, bufferGoal, terminate ],
        fastSwitchThreshold ]
    ) : Observable<IStreamNeedsManifestRefresh |
                   IStreamNeedsDiscontinuitySeek |
                   IStreamTerminatingEvent |
                   IStreamStateFull |
                   IStreamStateActive>
    {
      queuedSourceBuffer.synchronizeInventory();
      let neededSegments : ISegmentQueueItem[] = [];
      const neededRange = getWantedRange(period, timing, bufferGoal);
      if (!representation.index.isInitialized()) {
        if (initSegment === null) {
          log.warn("Stream: Uninitialized index without an initialization segment");
        } else if (initSegmentObject !== null) {
          log.warn("Stream: Uninitialized index with an already loaded " +
                   "initialization segment");
        } else {
          neededSegments.push({ segment: initSegment,
                                priority: getPriorityForTime(period.start, timing) });
        }
      } else {
        neededSegments = getNeededSegments({ content,
                                             currentPlaybackTime: timing.currentTime,
                                             fastSwitchThreshold,
                                             neededRange,
                                             queuedSourceBuffer })
          .map((segment) => ({ priority: getSegmentPriority(segment, timing),
                               segment }));

        if (neededSegments.length > 0 &&
            initSegment !== null && initSegmentObject === null)
        {
          // prepend initialization segment
          const initSegmentPriority = neededSegments[0].priority;
          neededSegments = [ { segment: initSegment,
                               priority: initSegmentPriority },
                             ...neededSegments ];
        }
      }

      segmentQueue.update(neededSegments);

      // XXX TODO
      if (terminate !== null) {
        nextTick(() => {
          destroy$.next(); // complete the downloading queue
        });
        return observableOf(EVENTS.streamTerminating());
      }

      /**
       * `true` if the current Stream has loaded all the needed segments for
       * this Representation until the end of the Period.
       */
      let isFull : boolean;
      if (neededSegments.length > 0 || period.end == null) {
        // Either we still have segments to download or the current Period is
        // not yet ended: not full
        isFull = false;
      } else {
        const lastPosition = representation.index.getLastPosition();
        if (lastPosition === undefined) {
          // We do not know the end of this index.
          // If we reached the end of the period, check that all segments are
          // available.
          isFull = neededRange.end >= period.end &&
                   representation.index.isFinished();
        } else if (lastPosition === null) {
          // There is no available segment in the index currently. If the index
          // tells us it has finished generating new segments, we're done.
          isFull = representation.index.isFinished();
        } else {
          // We have a declared end. Check that our range went until the last
          // position available in the index. If that's the case and we're left
          // with no segments after filtering them, it means we already have
          // downloaded the last segments and have nothing left to do: full.
          const endOfRange = period.end != null ? Math.min(period.end,
                                                           lastPosition) :
                                                  lastPosition;
          isFull = neededRange.end >= endOfRange &&
                   representation.index.isFinished();
        }
      }

      const neededActions : Array<IStreamNeedsDiscontinuitySeek |
                                  IStreamNeedsManifestRefresh> = [];

      const discontinuity = timing.stalled !== null ?
        representation.index.checkDiscontinuity(timing.currentTime) :
        -1;
      if (discontinuity > 1) {
        const nextTime = discontinuity + 1;
        const gap: [number, number] = [discontinuity, nextTime];
        neededActions.push(EVENTS.discontinuityEncountered(gap, bufferType));
      }

      const shouldRefreshManifest = representation.index.shouldRefresh(neededRange.start,
                                                                       neededRange.end);
      if (shouldRefreshManifest) {
        neededActions.push(EVENTS.needsManifestRefresh());
      }

      const currentStreamStatus$ =
        neededSegments.length > 0 ? observableOf(EVENTS.activeStream(bufferType)) :
        isFull                    ? observableOf(EVENTS.fullStream(bufferType)) :
                                    EMPTY;
      return observableConcat(observableOf(...neededActions),
                              currentStreamStatus$);
    }),
    takeWhile((e) => e.type !== "stream-terminating", true)
  );

  const streamQueue$ = segmentQueue.start()
    .pipe(mergeMap(onSegmentQueueEvent));

  return observableMerge(status$, streamQueue$)
    .pipe(takeUntil(destroy$));

  /**
   * React to events from the SegmentQueue.
   * @param {Object} evt
   * @returns {Observable}
   */
  function onSegmentQueueEvent(
    evt : ISegmentQueueEvent<T>
  ) : Observable<IStreamEventAddedSegment<T> |
                 IStreamWarningEvent |
                 IProtectedSegmentEvent |
                 IStreamManifestMightBeOutOfSync>
  {
    switch (evt.type) {

      case "retry":
        return observableConcat(
          observableOf(EVENTS.warning(evt.value.error)),
          observableDefer(() => { // better if done after warning is emitted
            const retriedSegment = evt.value.segment;
            const { index } = representation;
            if (index.isSegmentStillAvailable(retriedSegment) === false) {
              reCheckStatus$.next(); // Re-check list of needed segments
            } else if (index.canBeOutOfSyncError(evt.value.error, retriedSegment)) {
              return observableOf(EVENTS.manifestMightBeOufOfSync());
            }
            return EMPTY; // else, ignore.
          }));

      case "chunk": {
        const initTimescale = initSegmentObject?.initTimescale;
        const { segment, parse } = evt.value;
        return parse(initTimescale).pipe(
          mergeMap((parserEvt) => onParsedSegment(segment, parserEvt)));
      }

      case "chunk-complete": {
        const { segment } = evt.value;
        return queuedSourceBuffer.endOfSegment(objectAssign({ segment }, content))
          .pipe(ignoreElements());
      }

      case "interrupted": {
        const { segment } = evt.value;
        log.info("Stream: segment request interrupted temporarly.", segment);
        return EMPTY;
      }

      case "empty":
        reCheckStatus$.next(); // The SegmentQueue is empty, re-fill it
        return EMPTY;

      default:
        assertUnreachable(evt);
    }
  }

  /**
   * Logic ran when a new segment has been parsed.
   * @param {Object} segment
   * @param {Object} parsed
   * @returns {Observable}
   */
  function onParsedSegment(
    segment : ISegment,
    parsed : ISegmentParserResponse<T>
  ) : Observable<IStreamEventAddedSegment<T> | IProtectedSegmentEvent> {
    switch (parsed.type) {
      case "parsed-init-segment":
        initSegmentObject = parsed.value;
        const protectedEvents$ = observableOf(
          ...parsed.value.segmentProtections.map(segmentProt => {
            return EVENTS.protectedSegment(segmentProt);
          }));
        const segmentData = parsed.value.initializationData;
        const pushEvent$ = pushInitSegment({ clock$,
                                             content,
                                             segment,
                                             segmentData,
                                             queuedSourceBuffer });
        return observableMerge(protectedEvents$, pushEvent$);

      case "parsed-segment":
        const initSegmentData = initSegmentObject?.initializationData ?? null;
        return pushMediaSegment({ clock$,
                                  content,
                                  initSegmentData,
                                  parsedSegment: parsed.value,
                                  segment,
                                  queuedSourceBuffer });
      default:
        assertUnreachable(parsed);
    }
  }
}
