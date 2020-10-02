import { Observable } from "rxjs";
import { ISegmentLoaderContent, ISegmentLoaderEvent } from "../../../core/fetchers/segment/create_segment_loader";
import { ISegment } from "../../../manifest";
import { IContentInfos } from "./types";
export interface ICancellableRequest {
    data?: Uint8Array;
    error?: Error;
    onData?: (data: Uint8Array) => void;
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
export declare function createRequest(segmentLoader: (x: ISegmentLoaderContent) => Observable<ISegmentLoaderEvent<Uint8Array | ArrayBuffer | null>>, contentInfos: IContentInfos, segment: ISegment): ICancellableRequest;
/**
 * Free requests :
 * - Cancel the subscription to the observable
 * - Delete the request from the requests Map.
 * @param {string} segmentId
 */
export declare function freeRequest(segmentId: string): void;
