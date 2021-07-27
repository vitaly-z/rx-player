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
import Manifest, { Adaptation, ISegment, Period, Representation } from "../../manifest";
/**
 * Payload needed to add progress information for a request to the
 * PendingRequestsStore.
 */
export interface IProgressEventValue {
    /** Current duration since the request started, in ms. */
    duration: number;
    /** Unique ID identifying the request this progress information is for. */
    id: string | number;
    /** Current downloaded size, in bytes. */
    size: number;
    /** `performance.now()` at the time this progress event was generated. */
    timestamp: number;
    /** Total size of the segment to download, in bytes. */
    totalSize: number;
}
/** Payload needed to add a request to the PendingRequestsStore. */
export interface IBeginRequestValue {
    /**
     * Unique ID that will identify the request to send it events and remove it
     * from the PendingRequestsStore.
     */
    id: string | number;
    /** Time at which the corresponding segment begins, in seconds. */
    time: number;
    /** Duration of the corresponding segment being downloaded, in seconds. */
    duration: number;
    /** `Performance.now()` corresponding to the time at which the request began. */
    requestTimestamp: number;
    /** Context associated to the segment. */
    content: IRequestInfoContent;
}
/** Information linked to a segment request, stored in the PendingRequestsStore. */
export interface IRequestInfo {
    /** Duration of the corresponding segment being downloaded, in seconds. */
    duration: number;
    /** Information on the current progress made by this request. */
    progress: IProgressEventValue[];
    /** `Performance.now()` corresponding to the time at which the request began. */
    requestTimestamp: number;
    /** Time at which the corresponding segment begins, in seconds. */
    time: number;
    /** Context associated to the segment. */
    content: IRequestInfoContent;
}
/** Information on the progress made by a request. */
export interface IProgressEventValue {
    /** Current duration since the request started, in ms. */
    duration: number;
    /** Unique ID identifying the request this progress information is for. */
    id: string | number;
    /** Current downloaded size, in bytes. */
    size: number;
    /** `performance.now()` at the time this progress event was generated. */
    timestamp: number;
    /** Total size of the segment to download, in bytes. */
    totalSize: number;
}
/** Content linked to a segment request. */
export interface IRequestInfoContent {
    manifest: Manifest;
    period: Period;
    adaptation: Adaptation;
    representation: Representation;
    segment: ISegment;
}
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
     * @param {string} id
     * @param {Object} payload
     */
    add(payload: IBeginRequestValue): void;
    /**
     * Notify of the progress of a currently pending request.
     * @param {Object} progress
     */
    addProgress(progress: IProgressEventValue): void;
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
