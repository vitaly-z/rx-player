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
import { Observable } from "rxjs";
import { IManifest, IPeriod } from "../../../manifest";
import { IReadOnlySharedReference } from "../../../utils/reference";
import ABRManager from "../../abr";
import type { IReadOnlyPlaybackObserver } from "../../api";
import { SegmentFetcherCreator } from "../../fetchers";
import SegmentBuffersStore from "../../segment_buffers";
import { IPeriodStreamPlaybackObservation, IPeriodStreamOptions } from "../period";
import { IStreamOrchestratorEvent } from "../types";
export declare type IStreamOrchestratorPlaybackObservation = IPeriodStreamPlaybackObservation;
/** Options tweaking the behavior of the StreamOrchestrator. */
export declare type IStreamOrchestratorOptions = IPeriodStreamOptions & {
    wantedBufferAhead: IReadOnlySharedReference<number>;
    maxBufferAhead: IReadOnlySharedReference<number>;
    maxBufferBehind: IReadOnlySharedReference<number>;
};
/**
 * Create and manage the various Stream Observables needed for the content to
 * play:
 *
 *   - Create or dispose SegmentBuffers depending on the chosen Adaptations.
 *
 *   - Push the right segments to those SegmentBuffers depending on the user's
 *     preferences, the current position, the bandwidth, the decryption
 *     conditions...
 *
 *   - Concatenate Streams for adaptation from separate Periods at the right
 *     time, to allow smooth transitions between periods.
 *
 *   - Emit various events to notify of its health and issues
 *
 * @param {Object} content
 * @param {Observable} playbackObserver - Emit position information
 * @param {Object} abrManager - Emit bitrate estimates and best Representation
 * to play.
 * @param {Object} segmentBuffersStore - Will be used to lazily create
 * SegmentBuffer instances associated with the current content.
 * @param {Object} segmentFetcherCreator - Allow to download segments.
 * @param {Object} options
 * @returns {Observable}
 */
export default function StreamOrchestrator(content: {
    manifest: IManifest;
    initialPeriod: IPeriod;
}, playbackObserver: IReadOnlyPlaybackObserver<IStreamOrchestratorPlaybackObservation>, abrManager: ABRManager, segmentBuffersStore: SegmentBuffersStore, segmentFetcherCreator: SegmentFetcherCreator, options: IStreamOrchestratorOptions): Observable<IStreamOrchestratorEvent>;
