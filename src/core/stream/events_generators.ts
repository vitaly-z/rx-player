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

import { Subject } from "rxjs";
import { ICustomError } from "../../errors";
import {
  Adaptation,
  ISegment,
  Period,
  Representation,
} from "../../manifest";
import { IBufferType } from "../segment_buffers";
import {
  IActivePeriodChangedEvent,
  IAdaptationChangeEvent,
  IBitrateEstimationChangeEvent,
  ICompletedStreamEvent,
  IEndOfStreamEvent,
  INeedsDecipherabilityFlush,
  INeedsMediaSourceReload,
  IPeriodStreamClearedEvent,
  IPeriodStreamReadyEvent,
  IProtectedSegmentEvent,
  IRepresentationChangeEvent,
  IResumeStreamEvent,
  IStreamEventAddedSegment,
  IStreamManifestMightBeOutOfSync,
  IStreamNeedsManifestRefresh,
  IStreamTerminatingEvent,
  IStreamWarningEvent,
  StreamEventType,
} from "./types";

const EVENTS = {
  activePeriodChanged(period : Period) : IActivePeriodChangedEvent {
    return { type : StreamEventType.ActivePeriodChanged,
             value : { period } };
  },

  adaptationChange(
    bufferType : IBufferType,
    adaptation : Adaptation|null,
    period : Period
  ) : IAdaptationChangeEvent {
    return { type: StreamEventType.AdaptationChanged,
             value : { type: bufferType,
                       adaptation,
                       period } };
  },

  addedSegment<T>(
    content : { adaptation : Adaptation;
                period : Period;
                representation : Representation; },
    segment : ISegment,
    buffered : TimeRanges,
    segmentData : T
  ) : IStreamEventAddedSegment<T> {
    return { type : StreamEventType.AddedSegment,
             value : { content,
                       segment,
                       segmentData,
                       buffered } };
  },

  bitrateEstimationChange(
    type : IBufferType,
    bitrate : number|undefined
  ) : IBitrateEstimationChangeEvent {
    return { type: StreamEventType.BitrateEstimateUpdate,
             value: { type, bitrate } };
  },

  streamComplete(bufferType: IBufferType) : ICompletedStreamEvent {
    return { type: StreamEventType.CompleteStream,
             value: { type: bufferType } };
  },

  endOfStream() : IEndOfStreamEvent {
    return { type: StreamEventType.EndOfStream,
             value: undefined };
  },

  needsManifestRefresh() : IStreamNeedsManifestRefresh {
    return { type : StreamEventType.NeedsManifestRefresh,
             value :  undefined };
  },

  manifestMightBeOufOfSync() : IStreamManifestMightBeOutOfSync {
    return { type : StreamEventType.ManifestMaybeOutOfSync,
             value : undefined };
  },

  /**
   * @param {Object} period - The Period to which the stream logic asking for a
   * media source reload is linked.
   * @param {number} reloadAt - Position at which we should reload
   * @param {boolean} reloadOnPause - If `false`, stay on pause after reloading.
   * if `true`, automatically play once reloaded.
   * @returns {Object}
   */
  needsMediaSourceReload(
    period : Period,
    reloadAt : number,
    reloadOnPause : boolean
  ) : INeedsMediaSourceReload {
    return { type: StreamEventType.NeedsMediaSourceReload,
             value: { position : reloadAt,
                      autoPlay : reloadOnPause,
                      period } };
  },

  needsDecipherabilityFlush(
    position : number,
    autoPlay : boolean,
    duration : number
  ) : INeedsDecipherabilityFlush {
    return { type: StreamEventType.NeedsDecipherabilityFlush,
             value: { position, autoPlay, duration } };
  },

  periodStreamReady(
    type : IBufferType,
    period : Period,
    adaptation$ : Subject<Adaptation|null>
  ) : IPeriodStreamReadyEvent {
    return { type: StreamEventType.PeriodStreamReady,
             value: { type, period, adaptation$ } };
  },

  periodStreamCleared(
    type : IBufferType,
    period : Period
  ) : IPeriodStreamClearedEvent {
    return { type: StreamEventType.PeriodStreamCleared,
             value: { type, period } };
  },

  protectedSegment(initDataInfo : { type : string;
                                    data : Uint8Array; }
  ) : IProtectedSegmentEvent {
    return { type: StreamEventType.ProtectedSegment,
             value: initDataInfo };
  },

  representationChange(
    type : IBufferType,
    period : Period,
    representation : Representation
  ) : IRepresentationChangeEvent {
    return { type: StreamEventType.RepresentationChange,
             value: { type, period, representation } };
  },

  streamTerminating() : IStreamTerminatingEvent {
    return { type: StreamEventType.StreamTerminating,
             value: undefined };
  },

  resumeStream() : IResumeStreamEvent {
    return { type: StreamEventType.ResumeStream,
             value: undefined };
  },

  warning(value : ICustomError) : IStreamWarningEvent {
    return { type: StreamEventType.Warning, value };
  },
};

export default EVENTS;
