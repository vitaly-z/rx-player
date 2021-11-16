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
import { Observable, Subject } from "rxjs";
import { ICustomError } from "../../../errors";
import Manifest, { Adaptation, ISegment, Period, Representation } from "../../../manifest";
import { ISegmentParserParsedInitChunk, ISegmentParserParsedMediaChunk, ISegmentPipeline } from "../../../transports";
import { IABRMetricsEvent, IABRRequestBeginEvent, IABRRequestEndEvent, IABRRequestProgressEvent } from "../../abr";
import { IBufferType } from "../../segment_buffers";
/**
 * Create a function which will fetch and parse segments.
 * @param {string} bufferType
 * @param {Object} transport
 * @param {Subject} requests$
 * @param {Object} options
 * @returns {Function}
 */
export default function createSegmentFetcher<LoadedFormat, TSegmentDataType>(bufferType: IBufferType, pipeline: ISegmentPipeline<LoadedFormat, TSegmentDataType>, requests$: Subject<IABRMetricsEvent | IABRRequestBeginEvent | IABRRequestProgressEvent | IABRRequestEndEvent>, options: ISegmentFetcherOptions): ISegmentFetcher<TSegmentDataType>;
export declare type ISegmentFetcher<TSegmentDataType> = (content: ISegmentLoaderContent) => Observable<ISegmentFetcherEvent<TSegmentDataType>>;
/** Event sent by the SegmentFetcher when fetching a segment. */
export declare type ISegmentFetcherEvent<TSegmentDataType> = ISegmentFetcherChunkCompleteEvent | ISegmentFetcherChunkEvent<TSegmentDataType> | ISegmentFetcherWarning;
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
/** An Error happened while loading (usually a request error). */
export interface ISegmentFetcherWarning {
    type: "warning";
    value: ICustomError;
}
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
    maxRetryRegular?: number;
    maxRetryOffline?: number;
    lowLatencyMode: boolean;
}): ISegmentFetcherOptions;
