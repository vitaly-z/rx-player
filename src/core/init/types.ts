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

import { ICustomError } from "../../errors";
import Manifest, {
  Adaptation,
  Period,
  Representation,
} from "../../manifest";
import { IStalledStatus } from "../api";
import {
  IAttachedMediaKeysEvent,
  IBlacklistKeysEvent,
  IBlacklistProtectionDataEvent,
  ICreatedMediaKeysEvent,
  IEncryptedEvent,
  IInitDataIgnoredEvent,
  INoUpdateEvent,
  ISessionMessageEvent,
  ISessionUpdatedEvent,
} from "../eme";
import SegmentBuffersStore from "../segment_buffers";
import {
  IActivePeriodChangedEvent,
  IAdaptationChangeEvent,
  IBitrateEstimationChangeEvent,
  ICompletedStreamEvent,
  INeedsDecipherabilityFlush,
  INeedsMediaSourceReload,
  IPeriodStreamClearedEvent,
  IPeriodStreamReadyEvent,
  IProtectedSegmentEvent,
  IRepresentationChangeEvent,
  IStreamEventAddedSegment,
  IStreamManifestMightBeOutOfSync,
  IStreamNeedsManifestRefresh,
} from "../stream";
import { IEMEDisabledEvent } from "./create_eme_manager";
import {
  IStreamEventEvent,
  IStreamEventSkipEvent,
} from "./stream_events_emitter";

/** Object awaited by the `Init` on each clock tick. */
export interface IInitClockTick { position : number;
                                  getCurrentTime : () => number;
                                  buffered : TimeRanges;
                                  duration : number;
                                  bufferGap : number;
                                  state : string;
                                  playbackRate : number;
                                  currentRange : { start : number;
                                                   end : number; } |
                                                 null;
                                  readyState : number;
                                  paused : boolean;
                                  stalled : IStalledStatus |
                                            null;
                                  seeking : boolean; }

export const enum InitEventType {
  Warning = 200,
  ManifestReady,
  ManifestUpdate,
  DecipherabilityUpdate,
  ReloadingMediaSource,
  Stalled,
  Unstalled,
  Loaded,
}

/** Event sent after the Manifest has been loaded and parsed for the first time. */
export interface IManifestReadyEvent {
  type : InitEventType.ManifestReady;
  value : {
    /** The Manifest we just parsed. */
    manifest : Manifest;
  };
}

/** Event sent after the Manifest has been updated. */
export interface IManifestUpdateEvent { type: InitEventType.ManifestUpdate;
                                        value: null; }

/**
 * Event sent after updating the decipherability status of at least one
 * Manifest's Representation.
 * This generally means that some Representation(s) were detected to be
 * undecipherable on the current device.
 */
export interface IDecipherabilityUpdateEvent {
  type: InitEventType.DecipherabilityUpdate;
  value: Array<{ manifest : Manifest;
                 period : Period;
                 adaptation : Adaptation;
                 representation : Representation; }>; }

/** Event sent when a minor happened. */
export interface IWarningEvent { type : InitEventType.Warning;
                                 value : ICustomError; }

/**
 * Event sent when we're starting attach a new MediaSource to the media element
 * (after removing the previous one).
 */
export interface IReloadingMediaSourceEvent { type: InitEventType.ReloadingMediaSource;
                                              value: undefined; }

/** Event sent after the player stalled, leading to buffering. */
export interface IStalledEvent { type : InitEventType.Stalled;
                                 value : IStalledStatus; }

/** Event sent when the player goes out of a stalling situation. */
export interface IUnstalledEvent { type : InitEventType.Unstalled;
                                   value : null; }

/**
 * Event sent just as the content is considered as "loaded".
 * From this point on, the user can reliably play/pause/resume the stream.
 */
export interface ILoadedEvent { type : InitEventType.Loaded;
                                value : {
                                  segmentBuffersStore: SegmentBuffersStore | null;
                                }; }

export { IRepresentationChangeEvent };

/** Events emitted by a `MediaSourceLoader`. */
export type IMediaSourceLoaderEvent = IStalledEvent |
                                      IUnstalledEvent |
                                      ILoadedEvent |
                                      IWarningEvent |
                                      IStreamEventEvent |
                                      IStreamEventSkipEvent |

                                      // Coming from the StreamOrchestrator

                                      IActivePeriodChangedEvent |
                                      IPeriodStreamClearedEvent |
                                      ICompletedStreamEvent |
                                      IPeriodStreamReadyEvent |
                                      INeedsMediaSourceReload |
                                      IAdaptationChangeEvent |
                                      IBitrateEstimationChangeEvent |
                                      INeedsDecipherabilityFlush |
                                      IRepresentationChangeEvent |
                                      IStreamEventAddedSegment<unknown> |
                                      IProtectedSegmentEvent |
                                      IStreamManifestMightBeOutOfSync |
                                      IStreamNeedsManifestRefresh;

/** Every events emitted by the `Init` module. */
export type IInitEvent = IManifestReadyEvent |
                         IManifestUpdateEvent |
                         IReloadingMediaSourceEvent |
                         IDecipherabilityUpdateEvent |
                         IWarningEvent |
                         IEMEDisabledEvent |

                         // Coming from the `EMEManager`

                         IEncryptedEvent |
                         ICreatedMediaKeysEvent |
                         IAttachedMediaKeysEvent |
                         IInitDataIgnoredEvent |
                         ISessionMessageEvent |
                         INoUpdateEvent |
                         ISessionUpdatedEvent |
                         IBlacklistKeysEvent |
                         IBlacklistProtectionDataEvent |

                         // Coming from the `MediaSourceLoader`

                         IStalledEvent |
                         IUnstalledEvent |
                         ILoadedEvent |
                         IStreamEventEvent |
                         IStreamEventSkipEvent |

                         // Coming from the `StreamOrchestrator`

                         IActivePeriodChangedEvent |
                         IPeriodStreamClearedEvent |
                         ICompletedStreamEvent |
                         IPeriodStreamReadyEvent |
                         IAdaptationChangeEvent |
                         IBitrateEstimationChangeEvent |
                         IRepresentationChangeEvent |
                         IStreamEventAddedSegment<unknown>;

/** Events emitted by the `Init` module for directfile contents. */
export type IDirectfileEvent = IStalledEvent |
                               IUnstalledEvent |
                               ILoadedEvent |
                               IWarningEvent |
                               IEMEDisabledEvent |

                               // Coming from the `EMEManager`

                               IEncryptedEvent |
                               ICreatedMediaKeysEvent |
                               IAttachedMediaKeysEvent |
                               IInitDataIgnoredEvent |
                               ISessionMessageEvent |
                               INoUpdateEvent |
                               ISessionUpdatedEvent |
                               IBlacklistKeysEvent |
                               IBlacklistProtectionDataEvent;
