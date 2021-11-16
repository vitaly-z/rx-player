import { ISegmentFetcher } from "../../../core/fetchers/segment/segment_fetcher";
import { ISegment } from "../../../manifest";
import { ISegmentParserParsedInitChunk, ISegmentParserParsedMediaChunk } from "../../../transports";
import { IContentInfos } from "./types";
export interface ICancellableRequest {
    data?: ISegmentParserParsedInitChunk<Uint8Array | ArrayBuffer> | ISegmentParserParsedMediaChunk<Uint8Array | ArrayBuffer>;
    error?: Error;
    onData?: (data: ISegmentParserParsedInitChunk<Uint8Array | ArrayBuffer> | ISegmentParserParsedMediaChunk<Uint8Array | ArrayBuffer>) => void;
    onError?: (err: Error) => void;
    cancel: () => void;
}
/**
 * Create a request that is cancallable and which does not depends
 * on a specific task.
 * @param {Function} segmentLoader
 * @param {Object} contentInfos
 * @param {Object} segment
 * @returns {Object}
 */
export declare function createRequest(segmentFetcher: ISegmentFetcher<ArrayBuffer | Uint8Array>, contentInfos: IContentInfos, segment: ISegment): ICancellableRequest;
/**
 * Free requests :
 * - Cancel the subscription to the observable
 * - Delete the request from the requests Map.
 * @param {string} segmentId
 */
export declare function freeRequest(segmentId: string): void;
