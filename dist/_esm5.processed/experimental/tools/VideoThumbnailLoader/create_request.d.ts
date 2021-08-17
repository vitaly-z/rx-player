import { ISegmentFetcher } from "../../../core/fetchers/segment/segment_fetcher";
import { ISegment } from "../../../manifest";
import { ISegmentParserParsedInitSegment, ISegmentParserParsedSegment } from "../../../transports";
import { IContentInfos } from "./types";
export interface ICancellableRequest {
    data?: ISegmentParserParsedInitSegment<Uint8Array | ArrayBuffer> | ISegmentParserParsedSegment<Uint8Array | ArrayBuffer>;
    error?: Error;
    onData?: (data: ISegmentParserParsedInitSegment<Uint8Array | ArrayBuffer> | ISegmentParserParsedSegment<Uint8Array | ArrayBuffer>) => void;
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
