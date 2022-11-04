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
import Manifest, { Adaptation, Period, Representation } from "../../manifest";
import { IPlayerError } from "../../public_types";
import SegmentBuffersStore, { IBufferType } from "../segment_buffers";
import { IRepresentationChangeEvent } from "../stream";
import { IDecipherabilityUpdateEvent, ILoadedEvent, IManifestReadyEvent, IManifestUpdateEvent, IReloadingMediaSourceEvent, IStalledEvent, IStallingSituation, IUnstalledEvent, IWarningEvent } from "./types";
/**
 * Construct a "loaded" event.
 * @returns {Object}
 */
declare function loaded(segmentBuffersStore: SegmentBuffersStore | null): ILoadedEvent;
/**
 * Construct a "stalled" event.
 * @param {Object|null} rebuffering
 * @returns {Object}
 */
declare function stalled(rebuffering: IStallingSituation): IStalledEvent;
/**
 * Construct a "stalled" event.
 * @returns {Object}
 */
declare function unstalled(): IUnstalledEvent;
/**
 * Construct a "decipherabilityUpdate" event.
 * @param {Array.<Object>} arg
 * @returns {Object}
 */
declare function decipherabilityUpdate(arg: Array<{
    manifest: Manifest;
    period: Period;
    adaptation: Adaptation;
    representation: Representation;
}>): IDecipherabilityUpdateEvent;
/**
 * Construct a "manifestReady" event.
 * @param {Object} manifest
 * @returns {Object}
 */
declare function manifestReady(manifest: Manifest): IManifestReadyEvent;
/**
 * Construct a "manifestUpdate" event.
 * @returns {Object}
 */
declare function manifestUpdate(): IManifestUpdateEvent;
/**
 * Construct a "representationChange" event.
 * @param {string} type
 * @param {Object} period
 * @returns {Object}
 */
declare function nullRepresentation(type: IBufferType, period: Period): IRepresentationChangeEvent;
/**
 * construct a "warning" event.
 * @param {error} value
 * @returns {object}
 */
declare function warning(value: IPlayerError): IWarningEvent;
/**
 * construct a "reloading-media-source" event.
 * @returns {object}
 */
declare function reloadingMediaSource(): IReloadingMediaSourceEvent;
declare const INIT_EVENTS: {
    loaded: typeof loaded;
    decipherabilityUpdate: typeof decipherabilityUpdate;
    manifestReady: typeof manifestReady;
    manifestUpdate: typeof manifestUpdate;
    nullRepresentation: typeof nullRepresentation;
    reloadingMediaSource: typeof reloadingMediaSource;
    stalled: typeof stalled;
    unstalled: typeof unstalled;
    warning: typeof warning;
};
export default INIT_EVENTS;
