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
import { IAdaptation, ISegment, IPeriod, IRepresentation } from "../../manifest";
import { IContentProtection } from "../eme";
import { IBufferType } from "../segment_buffers";
import { IActivePeriodChangedEvent, IAdaptationChangeEvent, IBitrateEstimationChangeEvent, ICompletedStreamEvent, IEncryptionDataEncounteredEvent, IEndOfStreamEvent, ILockedStreamEvent, INeedsBufferFlushEvent, INeedsDecipherabilityFlush, INeedsMediaSourceReload, IPeriodStreamClearedEvent, IPeriodStreamReadyEvent, IRepresentationChangeEvent, IResumeStreamEvent, IStreamEventAddedSegment, IStreamManifestMightBeOutOfSync, IStreamNeedsManifestRefresh, IStreamTerminatingEvent, IStreamWarningEvent, IWaitingMediaSourceReloadInternalEvent } from "./types";
declare const EVENTS: {
    activePeriodChanged(period: IPeriod): IActivePeriodChangedEvent;
    adaptationChange(bufferType: IBufferType, adaptation: IAdaptation | null, period: IPeriod): IAdaptationChangeEvent;
    addedSegment<T>(content: {
        adaptation: IAdaptation;
        period: IPeriod;
        representation: IRepresentation;
    }, segment: ISegment, buffered: TimeRanges, segmentData: T): IStreamEventAddedSegment<T>;
    bitrateEstimationChange(type: IBufferType, bitrate: number | undefined): IBitrateEstimationChangeEvent;
    streamComplete(bufferType: IBufferType): ICompletedStreamEvent;
    endOfStream(): IEndOfStreamEvent;
    needsManifestRefresh(): IStreamNeedsManifestRefresh;
    manifestMightBeOufOfSync(): IStreamManifestMightBeOutOfSync;
    /**
     * @param {number} reloadAt - Position at which we should reload
     * @param {boolean} reloadOnPause - If `false`, stay on pause after reloading.
     * if `true`, automatically play once reloaded.
     * @returns {Object}
     */
    needsMediaSourceReload(reloadAt: number, reloadOnPause: boolean): INeedsMediaSourceReload;
    /**
     * @param {string} bufferType - The buffer type for which the stream cannot
     * currently load segments.
     * @param {Object} period - The Period for which the stream cannot
     * currently load segments.
     * media source reload is linked.
     * @returns {Object}
     */
    lockedStream(bufferType: IBufferType, period: IPeriod): ILockedStreamEvent;
    needsBufferFlush(): INeedsBufferFlushEvent;
    needsDecipherabilityFlush(position: number, autoPlay: boolean, duration: number): INeedsDecipherabilityFlush;
    periodStreamReady(type: IBufferType, period: IPeriod, adaptation$: Subject<IAdaptation | null>): IPeriodStreamReadyEvent;
    periodStreamCleared(type: IBufferType, period: IPeriod): IPeriodStreamClearedEvent;
    encryptionDataEncountered(initDataInfo: IContentProtection): IEncryptionDataEncounteredEvent;
    representationChange(type: IBufferType, period: IPeriod, representation: IRepresentation): IRepresentationChangeEvent;
    streamTerminating(): IStreamTerminatingEvent;
    resumeStream(): IResumeStreamEvent;
    warning(value: ICustomError): IStreamWarningEvent;
    waitingMediaSourceReload(bufferType: IBufferType, period: IPeriod, position: number, autoPlay: boolean): IWaitingMediaSourceReloadInternalEvent;
};
export default EVENTS;
