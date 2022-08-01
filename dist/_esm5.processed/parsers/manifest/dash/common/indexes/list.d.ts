import { IRepresentationIndex, ISegment } from "../../../../../manifest";
import { IEMSG } from "../../../../containers/isobmff";
import { IResolvedBaseUrl } from "../resolve_base_urls";
/**
 * Index property defined for a SegmentList RepresentationIndex
 * This object contains every property needed to generate an ISegment for a
 * given media time.
 */
export interface IListIndex {
    /**
     * Duration of each element in the list, in the timescale given (see
     * timescale and list properties.)
     */
    duration: number;
    /** Byte range for a possible index of segments in the server. */
    indexRange?: [number, number] | undefined;
    /**
     * Temporal offset, in the current timescale (see timescale), to add to the
     * presentation time (time a segment has at decoding time) to obtain the
     * corresponding media time (original time of the media segment in the index
     * and on the media file).
     * For example, to look for a segment beginning at a second `T` on a
     * HTMLMediaElement, we actually will look for a segment in the index
     * beginning at:
     * ```
     * T * timescale + indexTimeOffset
     * ```
     */
    indexTimeOffset: number;
    /** Information on the initialization segment. */
    initialization?: {
        /** URLs to access the initialization segment. */
        mediaURLs: string[] | null;
        /** possible byte range to request it. */
        range?: [number, number] | undefined;
    } | undefined;
    /** Information on the list of segments for this index. */
    list: Array<{
        /** URLs of the segment. */
        mediaURLs: string[] | null;
        /** Possible byte-range of the segment. */
        mediaRange?: [number, number] | undefined;
    }>;
    /**
     * Timescale to convert a time given here into seconds.
     * This is done by this simple operation:
     * ``timeInSeconds = timeInIndex * timescale``
     */
    timescale: number;
}
/**
 * `index` Argument for a SegmentList RepresentationIndex.
 * Most of the properties here are already defined in IListIndex.
 */
export interface IListIndexIndexArgument {
    duration?: number | undefined;
    indexRange?: [number, number] | undefined;
    initialization?: {
        media?: string | undefined;
        range?: [number, number] | undefined;
    };
    list: Array<{
        media?: string | undefined;
        mediaRange?: [number, number] | undefined;
    }>;
    /**
     * Offset present in the index to convert from the mediaTime (time declared in
     * the media segments and in this index) to the presentationTime (time wanted
     * when decoding the segment).  Basically by doing something along the line
     * of:
     * ```
     * presentationTimeInSeconds =
     *   mediaTimeInSeconds -
     *   presentationTimeOffsetInSeconds +
     *   periodStartInSeconds
     * ```
     * The time given here is in the current
     * timescale (see timescale)
     */
    presentationTimeOffset?: number | undefined;
    timescale?: number | undefined;
}
/** Aditional context needed by a SegmentList RepresentationIndex. */
export interface IListIndexContextArgument {
    /** Start of the period concerned by this RepresentationIndex, in seconds. */
    periodStart: number;
    /** End of the period concerned by this RepresentationIndex, in seconds. */
    periodEnd: number | undefined;
    /** Base URL for the Representation concerned. */
    representationBaseURLs: IResolvedBaseUrl[];
    /** ID of the Representation concerned. */
    representationId?: string | undefined;
    /** Bitrate of the Representation concerned. */
    representationBitrate?: number | undefined;
    isEMSGWhitelisted: (inbandEvent: IEMSG) => boolean;
}
export default class ListRepresentationIndex implements IRepresentationIndex {
    /** Underlying structure to retrieve segment information. */
    private _index;
    /** Start of the period concerned by this RepresentationIndex, in seconds. */
    protected _periodStart: number;
    /** End of the period concerned by this RepresentationIndex, in seconds. */
    protected _periodEnd: number | undefined;
    private _isEMSGWhitelisted;
    /**
     * @param {Object} index
     * @param {Object} context
     */
    constructor(index: IListIndexIndexArgument, context: IListIndexContextArgument);
    /**
     * Construct init Segment.
     * @returns {Object}
     */
    getInitSegment(): ISegment;
    /**
     * @param {Number} fromTime
     * @param {Number} duration
     * @returns {Array.<Object>}
     */
    getSegments(fromTime: number, dur: number): ISegment[];
    /**
     * Returns whether the Manifest should be refreshed based on the
     * `ListRepresentationIndex`'s state and the time range the player is
     * currently considering.
     * @param {Number} _fromTime
     * @param {Number} _toTime
     * @returns {Boolean}
     */
    shouldRefresh(_fromTime: number, _toTime: number): boolean;
    /**
     * Returns first position in this index, in seconds.
     * @returns {Number}
     */
    getFirstPosition(): number;
    /**
     * Returns last position in this index, in seconds.
     * @returns {Number}
     */
    getLastPosition(): number;
    /**
     * Returns true if a Segment returned by this index is still considered
     * available.
     * @param {Object} segment
     * @returns {Boolean}
     */
    isSegmentStillAvailable(): true;
    /**
     * We do not check for discontinuity in SegmentList-based indexes.
     * @returns {null}
     */
    checkDiscontinuity(): null;
    /**
     * @returns {boolean}
     */
    areSegmentsChronologicallyGenerated(): boolean;
    /**
     * SegmentList should not be updated.
     * @returns {Boolean}
     */
    canBeOutOfSyncError(): false;
    /**
     * @returns {Boolean}
     */
    isFinished(): true;
    /**
     * @returns {Boolean}
     */
    isInitialized(): true;
    /**
     * @param {Object} newIndex
     */
    _replace(newIndex: ListRepresentationIndex): void;
    /**
     * @param {Object} newIndex
     */
    _update(): void;
}
