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
import { ISegment } from "../../manifest";
export interface IProgressEventValue {
    duration: number;
    /** Unique ID for the request. */
    id: string | number;
    /** Current downloaded size, in bytes. */
    size: number;
    /** Timestamp of the progress event since unix epoch, in ms. */
    timestamp: number;
    /** Total size to download, in bytes. */
    totalSize: number;
}
export interface IBeginRequestValue {
    /** Unique ID for the request. */
    id: string | number;
    /** Metadata on the requested segment. */
    segment: ISegment;
    /** Unix timestamp at which the request began, in ms. */
    requestTimestamp: number;
}
export interface IRequestInfo {
    /** Metadata on the requested segment. */
    segment: ISegment;
    /** Progress events for this request. */
    progress: IProgressEventValue[];
    /** Unix timestamp at which the request began, in ms. */
    requestTimestamp: number;
}
export interface IProgressEventValue {
    /** Current duration for the request, in ms. */
    duration: number;
    /** Unique ID for the request. */
    id: string | number;
    /** Current downloaded size, in bytes. */
    size: number;
    /** Timestamp of the progress event since unix epoch, in ms. */
    timestamp: number;
    /** Total size to download, in bytes. */
    totalSize: number;
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
