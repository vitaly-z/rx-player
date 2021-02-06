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
import SegmentBuffersStore, {
  IBufferType,
} from "../segment_buffers";
import { IRepresentationChangeEvent, StreamEventType } from "../stream";
import {
  IDecipherabilityUpdateEvent,
  ILoadedEvent,
  IManifestReadyEvent,
  IManifestUpdateEvent,
  InitEventType,
  IReloadingMediaSourceEvent,
  IStalledEvent,
  IUnstalledEvent,
  IWarningEvent,
} from "./types";

/**
 * Construct a "loaded" event.
 * @returns {Object}
 */
function loaded(segmentBuffersStore : SegmentBuffersStore | null) : ILoadedEvent {
  return { type: InitEventType.Loaded, value: { segmentBuffersStore } };
}

/**
 * Construct a "stalled" event.
 * @param {Object|null} stalling
 * @returns {Object}
 */
function stalled(stalling : IStalledStatus) : IStalledEvent {
  return { type: InitEventType.Stalled, value: stalling };
}

/**
 * Construct a "stalled" event.
 * @param {Object|null} stalling
 * @returns {Object}
 */
function unstalled() : IUnstalledEvent {
  return { type: InitEventType.Unstalled, value: null };
}

/**
 * Construct a "decipherabilityUpdate" event.
 * @param {Array.<Object>} arg
 * @returns {Object}
 */
function decipherabilityUpdate(
  arg : Array<{ manifest : Manifest;
                period : Period;
                adaptation : Adaptation;
                representation : Representation; }>
) : IDecipherabilityUpdateEvent {
  return { type: InitEventType.DecipherabilityUpdate, value: arg };
}

/**
 * Construct a "manifestReady" event.
 * @param {Object} manifest
 * @returns {Object}
 */
function manifestReady(
  manifest : Manifest
) : IManifestReadyEvent {
  return { type: InitEventType.ManifestReady, value: { manifest } };
}

/**
 * Construct a "manifestUpdate" event.
 * @returns {Object}
 */
function manifestUpdate() : IManifestUpdateEvent {
  return { type: InitEventType.ManifestUpdate, value: null };
}

/**
 * Construct a "representationChange" event.
 * @param {string} type
 * @param {Object} period
 * @returns {Object}
 */
function nullRepresentation(
  type : IBufferType,
  period : Period
) : IRepresentationChangeEvent {
  return { type: StreamEventType.RepresentationChange,
           value: { type,
                    representation: null,
                    period } };
}

/**
 * construct a "warning" event.
 * @param {error} value
 * @returns {object}
 */
function warning(value : ICustomError) : IWarningEvent {
  return { type: InitEventType.Warning, value };
}

/**
 * construct a "reloading-media-source" event.
 * @returns {object}
 */
function reloadingMediaSource() : IReloadingMediaSourceEvent {
  return { type: InitEventType.ReloadingMediaSource, value: undefined };
}

const INIT_EVENTS = { loaded,
                      decipherabilityUpdate,
                      manifestReady,
                      manifestUpdate,
                      nullRepresentation,
                      reloadingMediaSource,
                      stalled,
                      unstalled,
                      warning };

export default INIT_EVENTS;
