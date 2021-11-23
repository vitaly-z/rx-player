import { Observable } from "rxjs";
import { ISegmentFetcher } from "../../../core/fetchers/segment/segment_fetcher";
import { ISegment } from "../../../manifest";
import { ISegmentParserParsedInitSegment, ISegmentParserParsedSegment } from "../../../transports";
import { IContentInfos } from "./types";
/**
 * Load needed segments, from already running requests or by running new ones.
 * @param {Array.<Object>} segments
 * @param {Map} currentRequests
 * @param {Function} segmentLoader
 * @param {Object} contentInfos
 * @returns {Object}
 */
export default function loadSegments(segments: ISegment[], segmentFetcher: ISegmentFetcher<ArrayBuffer | Uint8Array>, contentInfos: IContentInfos): Observable<Array<{
    segment: ISegment;
    data: ISegmentParserParsedSegment<ArrayBuffer | Uint8Array> | ISegmentParserParsedInitSegment<ArrayBuffer | Uint8Array>;
}>>;
