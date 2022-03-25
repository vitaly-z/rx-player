import { EMPTY, } from "rxjs";
import { mergeMap } from "rxjs/operators";
/**
 * Push data to the video source buffer.
 * @param {Object} inventoryInfos
 * @param {Function} segmentParser
 * @param {Uint8Array} responseData
 * @param {Object} videoSourceBuffer
 * @returns
 */
export default function pushData(inventoryInfos, segmentParser, responseData, videoSourceBuffer) {
    return segmentParser({
        response: { data: responseData,
            isChunked: false },
        content: inventoryInfos,
    }).pipe(mergeMap(function (parserEvt) {
        if (parserEvt.type !== "parsed-segment") {
            return EMPTY;
        }
        var _a = parserEvt.value, chunkData = _a.chunkData, appendWindow = _a.appendWindow;
        var segmentData = chunkData instanceof ArrayBuffer ?
            new Uint8Array(chunkData) : chunkData;
        return videoSourceBuffer
            .pushChunk({ data: { chunk: segmentData,
                timestampOffset: 0,
                appendWindow: appendWindow,
                initSegment: null,
                codec: inventoryInfos
                    .representation.getMimeTypeString() },
            inventoryInfos: inventoryInfos });
    }));
}
