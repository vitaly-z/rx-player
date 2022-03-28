import { EMPTY, } from "rxjs";
/**
 * Push data to the video source buffer.
 * @param {Object} inventoryInfos
 * @param {Function} segmentParser
 * @param {Uint8Array} responseData
 * @param {Object} videoSourceBuffer
 * @returns
 */
export default function pushData(inventoryInfos, segmentParser, responseData, videoSourceBuffer) {
    var parsed = segmentParser({
        response: { data: responseData,
            isChunked: false },
        content: inventoryInfos,
    });
    if (parsed.segmentType !== "media") {
        return EMPTY;
    }
    var chunkData = parsed.chunkData, appendWindow = parsed.appendWindow;
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
}
