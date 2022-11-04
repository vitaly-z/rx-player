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
import { IPlayerError } from "../../../public_types";
import { ISegmentParserParsedInitChunk, ISegmentParserParsedMediaChunk, ISegmentPipeline } from "../../../transports";
import { CancellationSignal } from "../../../utils/task_canceller";
import { IMetricsCallbackPayload, IRequestBeginCallbackPayload, IRequestEndCallbackPayload, IRequestProgressCallbackPayload } from "../../adaptive";
import { IBufferType } from "../../segment_buffers";
import CdnPrioritizer from "../cdn_prioritizer";
/**
 * Create an `ISegmentFetcher` object which will allow to easily fetch and parse
 * segments.
 * An `ISegmentFetcher` also implements a retry mechanism, based on the given
 * `options` argument, which may retry a segment request when it fails.
 *
 * @param {string} bufferType
 * @param {Object} pipeline
 * @param {Object} lifecycleCallbacks
 * @param {Object} options
 * @returns {Function}
 */
export default function createSegmentFetcher<TLoadedFormat, TSegmentDataType>(bufferType: IBufferType, pipeline: ISegmentPipeline<TLoadedFormat, TSegmentDataType>, cdnPrioritizer: CdnPrioritizer | null, lifecycleCallbacks: ISegmentFetcherLifecycleCallbacks, options: ISegmentFetcherOptions): ISegmentFetcher<TSegmentDataType>;
/**
 * Defines the `ISegmentFetcher` function which allows to load a single segment.
 *
 * Loaded data is entirely communicated through callbacks present in the
 * `callbacks` arguments.
 *
 * The returned Promise only gives an indication of if the request ended with
 * success or on error.
 */
export declare type ISegmentFetcher<TSegmentDataType> = (
/** Information on the segment wanted. */
content: ISegmentLoaderContent, 
/** Callbacks the `ISegmentFetcher` will call as it loads the data. */
callbacks: ISegmentFetcherCallbacks<TSegmentDataType>, 
/** CancellationSignal allowing to cancel the request. */
cancellationSignal: CancellationSignal) => Promise<void>;
/**
 * Callbacks given to an `ISegmentFetcher` allowing to be notified on its
 * inner request's various events.
 */
export interface ISegmentFetcherCallbacks<TSegmentDataType> {
    /** Called when a decodable chunk of the whole segment is available. */
    onChunk(parse: (initTimescale: number | undefined) => ISegmentParserParsedInitChunk<TSegmentDataType> | ISegmentParserParsedMediaChunk<TSegmentDataType>): void;
    /**
     * Callback called when all decodable chunks of the loaded segment have been
     * communicated through the `onChunk` callback.
     */
    onAllChunksReceived(): void;
    /**
     * Callback called when the segment request has to restart from scratch. */
    onRetry(error: IPlayerError): void;
}
/** Content used by the segment loader as a context to load a new segment. */
export interface ISegmentLoaderContent {
    manifest: Manifest;
    period: Period;
    adaptation: Adaptation;
    representation: Representation;
    segment: ISegment;
}
/**
 * Callbacks given when creating an `ISegmentFetcher`, allowing to be notified
 * on high-level metadata about performed requests.
 */
export interface ISegmentFetcherLifecycleCallbacks {
    /** Called when a segment request begins. */
    onRequestBegin?: (arg: IRequestBeginCallbackPayload) => void;
    /** Called when progress information is available on a pending segment request. */
    onProgress?: (arg: IRequestProgressCallbackPayload) => void;
    /**
     * Called when a segment request ends (either because it completed, it failed
     * or was canceled).
     */
    onRequestEnd?: (arg: IRequestEndCallbackPayload) => void;
    /**
     * Called when network metrics linked to a segment request are available,
     * once the request has terminated.
     * This callback may be called before or after the corresponding
     * `onRequestEnd` callback, you should not rely on the order between the two.
     */
    onMetrics?: (arg: IMetricsCallbackPayload) => void;
}
/** Options allowing to configure an `ISegmentFetcher`'s behavior. */
export interface ISegmentFetcherOptions {
    /**
     * Initial delay to wait if a request fails before making a new request, in
     * milliseconds.
     */
    baseDelay: number;
    /**
     * Maximum delay to wait if a request fails before making a new request, in
     * milliseconds.
     */
    maxDelay: number;
    /**
     * Maximum number of retries to perform on "regular" errors (e.g. due to HTTP
     * status, integrity errors, timeouts...).
     */
    maxRetryRegular: number;
    /**
     * Maximum number of retries to perform when it appears that the user is
     * currently offline.
     */
    maxRetryOffline: number;
    /**
     * Timeout after which request are aborted and, depending on other options,
     * retried.
     * To set to `-1` for no timeout.
     */
    requestTimeout: number;
}
/**
 * @param {string} bufferType
 * @param {Object}
 * @returns {Object}
 */
export declare function getSegmentFetcherOptions(bufferType: string, { maxRetryRegular, maxRetryOffline, lowLatencyMode, requestTimeout }: {
    maxRetryRegular?: number | undefined;
    maxRetryOffline?: number | undefined;
    requestTimeout?: number | undefined;
    lowLatencyMode: boolean;
}): ISegmentFetcherOptions;
