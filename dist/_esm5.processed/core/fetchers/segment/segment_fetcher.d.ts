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
import { ISegmentParserParsedInitChunk, ISegmentParserParsedMediaChunk, ISegmentPipeline } from "../../../transports";
import { IABRMetricsEventValue, IABRRequestBeginEventValue, IABRRequestEndEventValue, IABRRequestProgressEventValue } from "../../abr";
import { IBufferType } from "../../segment_buffers";
/**
 * Create an `ISegmentFetcher` object which will allow to easily fetch and parse
 * segments.
 * An `ISegmentFetcher` also implements a retry mechanism, based on the given
 * `options` argument, which may retry a segment request when it fails.
 *
 * @param {string} bufferType
 * @param {Object} transport
 * @param {Object} callbacks
 * @param {Object} options
 * @returns {Function}
 */
export default function createSegmentFetcher<TLoadedFormat, TSegmentDataType>(bufferType: IBufferType, pipeline: ISegmentPipeline<TLoadedFormat, TSegmentDataType>, callbacks: ISegmentFetcherCreatorCallbacks, options: ISegmentFetcherOptions): ISegmentFetcher<TSegmentDataType>;
export declare type ISegmentFetcher<TSegmentDataType> = (content: ISegmentLoaderContent) => Observable<ISegmentFetcherEvent<TSegmentDataType>>;
/** Event sent by the SegmentFetcher when fetching a segment. */
export declare type ISegmentFetcherEvent<TSegmentDataType> = ISegmentFetcherChunkEvent<TSegmentDataType> | ISegmentFetcherChunkCompleteEvent | ISegmentFetcherRetry;
/**
 * Event sent when a new "chunk" of the segment is available.
 * A segment can contain n chunk(s) for n >= 0.
 */
export interface ISegmentFetcherChunkEvent<TSegmentDataType> {
    type: "chunk";
    /** Parse the downloaded chunk. */
    /**
     * Parse the downloaded chunk.
     *
     * Take in argument the timescale value that might have been obtained by
     * parsing an initialization segment from the same Representation.
     * Can be left to `undefined` if unknown or inexistant, segment parsers should
     * be resilient and still work without that information.
     *
     * @param {number} initTimescale
     * @returns {Object}
     */
    parse(initTimescale?: number): ISegmentParserParsedInitChunk<TSegmentDataType> | ISegmentParserParsedMediaChunk<TSegmentDataType>;
}
/**
 * Event sent when all "chunk" of the segments have been communicated through
 * `ISegmentFetcherChunkEvent` events.
 */
export interface ISegmentFetcherChunkCompleteEvent {
    type: "chunk-complete";
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
 * An Error happened while loading which led to a retry.
 * The request is retried from scratch.
 */
export interface ISegmentFetcherRetry {
    type: "retry";
    value: ICustomError;
}
/**
 * Callbacks that can be bound when creating an `ISegmentFetcher`.
 * Those allows to be notified of an `ISegmentFetcher` various lifecycles and of
 * network information.
 */
export interface ISegmentFetcherCreatorCallbacks {
    /** Called when a segment request begins. */
    onRequestBegin?: (arg: IABRRequestBeginEventValue) => void;
    /** Called when progress information is available on a pending segment request. */
    onProgress?: (arg: IABRRequestProgressEventValue) => void;
    /**
     * Called when a segment request ends (either because it completed, it failed
     * or was canceled).
     */
    onRequestEnd?: (arg: IABRRequestEndEventValue) => void;
    /**
     * Called when network metrics linked to a segment request are available,
     * once the request has terminated.
     * This callback may be called before or after the corresponding
     * `onRequestEnd` callback, you should not rely on the order between the two.
     */
    onMetrics?: (arg: IABRMetricsEventValue) => void;
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
}
/**
 * @param {string} bufferType
 * @param {Object}
 * @returns {Object}
 */
export declare function getSegmentFetcherOptions(bufferType: string, { maxRetryRegular, maxRetryOffline, lowLatencyMode }: {
    maxRetryRegular?: number | undefined;
    maxRetryOffline?: number | undefined;
    lowLatencyMode: boolean;
}): ISegmentFetcherOptions;
