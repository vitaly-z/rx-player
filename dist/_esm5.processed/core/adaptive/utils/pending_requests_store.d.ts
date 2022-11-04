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
import Manifest, { Adaptation, ISegment, Period, Representation } from "../../../manifest";
/**
 * Store information about pending requests, like information about:
 *   - for which segments they are
 *   - how the request's progress goes
 * @class PendingRequestsStore
 */
export default class PendingRequestsStore {
    private _currentRequests;
    constructor();
    /**
     * Add information about a new pending request.
     * @param {Object} payload
     */
    add(payload: IPendingRequestStoreBegin): void;
    /**
     * Notify of the progress of a currently pending request.
     * @param {Object} progress
     */
    addProgress(progress: IPendingRequestStoreProgress): void;
    /**
     * Remove a request previously set as pending.
     * @param {string} id
     */
    remove(id: string): void;
    /**
     * Returns information about all pending requests, in segment's chronological
     * order.
     * @returns {Array.<Object>}
     */
    getRequests(): IRequestInfo[];
}
/**
 * Payload needed to add progress information for a request to the
 * PendingRequestsStore.
 */
export interface IPendingRequestStoreProgress {
    /** Amount of time since the request has started, in seconds. */
    duration: number;
    /**
     * Same `id` value used to identify that request at the time the corresponding
     * `IABRRequestBeginEventValue` was sent.
     */
    id: string;
    /** Current downloaded size, in bytes. */
    size: number;
    /** Value of `performance.now` at the time this progression report was available. */
    timestamp: number;
    /**
     * Total size of the segment to download (including already-loaded data),
     * in bytes.
     */
    totalSize: number;
}
/** Payload needed to add a request to the PendingRequestsStore. */
export interface IPendingRequestStoreBegin {
    /**
     * String identifying this request.
     *
     * Only one request communicated to the current `RepresentationEstimator`
     * should have this `id` at the same time.
     */
    id: string;
    /** Value of `performance.now` at the time the request began.  */
    requestTimestamp: number;
    /** Context associated to the segment. */
    content: IRequestInfoContent;
}
/** Information linked to a segment request, stored in the PendingRequestsStore. */
export interface IRequestInfo {
    /** Information on the current progress made by this request. */
    progress: IPendingRequestStoreProgress[];
    /** `Performance.now()` corresponding to the time at which the request began. */
    requestTimestamp: number;
    /** Context associated to the segment. */
    content: IRequestInfoContent;
}
/** Content linked to a segment request. */
export interface IRequestInfoContent {
    manifest: Manifest;
    period: Period;
    adaptation: Adaptation;
    representation: Representation;
    segment: ISegment;
}
