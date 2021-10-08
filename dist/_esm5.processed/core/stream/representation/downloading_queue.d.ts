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
import { ICustomError } from "../../../errors";
import Manifest, { Adaptation, ISegment, Period, Representation } from "../../../manifest";
import { ISegmentParserParsedInitSegment, ISegmentParserParsedSegment } from "../../../transports";
import { IReadOnlySharedReference } from "../../../utils/reference";
import { IPrioritizedSegmentFetcher } from "../../fetchers";
import { IQueuedSegment } from "../types";
/**
 * Class scheduling segment downloads for a single Representation.
 * @class DownloadingQueue
 */
export default class DownloadingQueue<T> {
    /** Context of the Representation that will be loaded through this DownloadingQueue. */
    private _content;
    /**
     * Observable doing segment requests and emitting related events.
     * We only can have maximum one at a time.
     * `null` when `start` has never been called.
     */
    private _currentObs$;
    /**
     * Current queue of segments scheduled for download.
     *
     * Segments whose request are still pending are still in that queue. Segments
     * are only removed from it once their request has succeeded.
     */
    private _downloadQueue;
    /**
     * Pending request for the initialization segment.
     * `null` if no request is pending for it.
     */
    private _initSegmentRequest;
    /**
     * Pending request for a media (i.e. non-initialization) segment.
     * `null` if no request is pending for it.
     */
    private _mediaSegmentRequest;
    /** Interface used to load segments. */
    private _segmentFetcher;
    /** Emit the timescale anounced in the initialization segment once parsed. */
    private _initSegmentMetadata$;
    /**
     * Some media segments might have been loaded and are only awaiting for the
     * initialization segment to be parsed before being parsed themselves.
     * This `Set` will contain the `id` property of all segments that are
     * currently awaiting this event.
     */
    private _mediaSegmentsAwaitingInitMetadata;
    /**
     * Create a new `DownloadingQueue`.
     *
     * @param {Object} content - The context of the Representation you want to
     * load segments for.
     * @param {Object} downloadQueue - Queue of segments you want to load.
     * @param {Object} segmentFetcher - Interface to facilitate the download of
     * segments.
     * @param {boolean} hasInitSegment - Declare that an initialization segment
     * will need to be downloaded.
     *
     * A `DownloadingQueue` ALWAYS wait for the initialization segment to be
     * loaded and parsed before parsing a media segment.
     *
     * In cases where no initialization segment exist, this would lead to the
     * `DownloadingQueue` waiting indefinitely for it.
     *
     * By setting that value to `false`, you anounce to the `DownloadingQueue`
     * that it should not wait for an initialization segment before parsing a
     * media segment.
     */
    constructor(content: IDownloadingQueueContext, downloadQueue: IReadOnlySharedReference<IDownloadQueueItem>, segmentFetcher: IPrioritizedSegmentFetcher<T>, hasInitSegment: boolean);
    /**
     * Returns the initialization segment currently being requested.
     * Returns `null` if no initialization segment request is pending.
     * @returns {Object}
     */
    getRequestedInitSegment(): ISegment | null;
    /**
     * Returns the media segment currently being requested.
     * Returns `null` if no media segment request is pending.
     * @returns {Object}
     */
    getRequestedMediaSegment(): ISegment | null;
    /**
     * Start the current downloading queue, emitting events as it loads and parses
     * initialization and media segments.
     *
     * If it was already started, returns the same - shared - Observable.
     * @returns {Observable}
     */
    start(): Observable<IDownloadingQueueEvent<T>>;
    /**
     * Internal logic performing media segment requests.
     * @returns {Observable}
     */
    private _requestMediaSegments;
    /**
     * Internal logic performing initialization segment requests.
     * @param {Object} queuedInitSegment
     * @returns {Observable}
     */
    private _requestInitSegment;
}
/** Event sent by the DownloadingQueue. */
export declare type IDownloadingQueueEvent<T> = IParsedInitSegmentEvent<T> | IParsedSegmentEvent<T> | IEndOfSegmentEvent | ILoaderRetryEvent | IEndOfQueueEvent;
/**
 * Notify that the initialization segment has been fully loaded and parsed.
 *
 * You can now push that segment to its corresponding buffer and use its parsed
 * metadata.
 *
 * Only sent if an initialization segment exists (when the `DownloadingQueue`'s
 * `hasInitSegment` constructor option has been set to `true`).
 * In that case, an `IParsedInitSegmentEvent` will always be sent before any
 * `IParsedSegmentEvent` event is sent.
 */
export declare type IParsedInitSegmentEvent<T> = ISegmentParserParsedInitSegment<T> & {
    segment: ISegment;
    type: "parsed-init";
};
/**
 * Notify that a media chunk (decodable sub-part of a media segment) has been
 * loaded and parsed.
 *
 * If an initialization segment exists (when the `DownloadingQueue`'s
 * `hasInitSegment` constructor option has been set to `true`), an
 * `IParsedSegmentEvent` will always be sent AFTER the `IParsedInitSegmentEvent`
 * event.
 *
 * It can now be pushed to its corresponding buffer. Note that there might be
 * multiple `IParsedSegmentEvent` for a single segment, if that segment is
 * divided into multiple decodable chunks.
 * You will know that all `IParsedSegmentEvent` have been loaded for a given
 * segment once you received the `IEndOfSegmentEvent` for that segment.
 */
export declare type IParsedSegmentEvent<T> = ISegmentParserParsedSegment<T> & {
    segment: ISegment;
    type: "parsed-media";
};
/** Notify that a media or initialization segment has been fully-loaded. */
export interface IEndOfSegmentEvent {
    type: "end-of-segment";
    value: {
        segment: ISegment;
    };
}
/**
 * Notify that a media or initialization segment request is retried.
 * This happened most likely because of an HTTP error.
 */
export interface ILoaderRetryEvent {
    type: "retry";
    value: {
        segment: ISegment;
        error: ICustomError;
    };
}
/**
 * Notify that the media segment queue is now empty.
 * This can be used to re-check if any segment are now needed.
 */
export interface IEndOfQueueEvent {
    type: "end-of-queue";
    value: null;
}
/**
 * Structure of the object that has to be emitted through the `downloadQueue`
 * Observable, to signal which segments are currently needed.
 */
export interface IDownloadQueueItem {
    /**
     * A potential initialization segment that needs to be loaded and parsed.
     * It will generally be requested in parralel of the first media segments.
     *
     * Can be set to `null` if you don't need to load the initialization segment
     * for now.
     *
     * If the `DownloadingQueue`'s `hasInitSegment` constructor option has been
     * set to `true`, no media segment will be parsed before the initialization
     * segment has been loaded and parsed.
     */
    initSegment: IQueuedSegment | null;
    /**
     * The queue of media segments currently needed for download.
     *
     * Those will be loaded from the first element in that queue to the last
     * element in it.
     *
     * Note that any media segments in the segment queue will only be parsed once
     * either of these is true:
     *   - An initialization segment has been loaded and parsed by this
     *     `DownloadingQueue` instance.
     *   - The `DownloadingQueue`'s `hasInitSegment` constructor option has been
     *     set to `false`.
     */
    segmentQueue: IQueuedSegment[];
}
/** Context for segments downloaded through the DownloadingQueue. */
export interface IDownloadingQueueContext {
    /** Adaptation linked to the segments you want to load. */
    adaptation: Adaptation;
    /** Manifest linked to the segments you want to load. */
    manifest: Manifest;
    /** Period linked to the segments you want to load. */
    period: Period;
    /** Representation linked to the segments you want to load. */
    representation: Representation;
}
