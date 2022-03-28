import { Observable } from "rxjs";
import { ISegmentLoaderContent, ISegmentLoaderEvent } from "../../../core/fetchers/segment/create_segment_loader";
import { ISegment } from "../../../manifest";
import { IContentInfos } from "./types";
/**
 * Load needed segments, from already running requests or by running new ones.
 * @param {Array.<Object>} segments
 * @param {Map} currentRequests
 * @param {Function} segmentLoader
 * @param {Object} contentInfos
 * @returns {Object}
 */
export default function loadSegments(segments: ISegment[], segmentLoader: (x: ISegmentLoaderContent) => Observable<ISegmentLoaderEvent<Uint8Array | ArrayBuffer | null>>, contentInfos: IContentInfos): Observable<Array<{
    segment: ISegment;
    data: Uint8Array;
}>>;
