import { Observable } from "rxjs";
import { AudioVideoSegmentBuffer } from "../../../core/segment_buffers/implementations";
import { IAdaptation, IManifest, IPeriod, IRepresentation, ISegment } from "../../../manifest";
import { ISegmentParserParsedMediaChunk } from "../../../transports";
/**
 * Push data to the video source buffer.
 * @param {Object} inventoryInfos
 * @param {Function} segmentParser
 * @param {Uint8Array} responseData
 * @param {Object} videoSourceBuffer
 * @returns
 */
export default function pushData(inventoryInfos: {
    manifest: IManifest;
    period: IPeriod;
    adaptation: IAdaptation;
    representation: IRepresentation;
    segment: ISegment;
    start: number;
    end: number;
}, parsed: ISegmentParserParsedMediaChunk<Uint8Array | ArrayBuffer>, videoSourceBuffer: AudioVideoSegmentBuffer): Observable<void>;
