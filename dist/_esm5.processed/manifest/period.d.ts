import { IManifestStreamEvent, IParsedPeriod } from "../parsers/manifest";
import { IPlayerError, IRepresentationFilter } from "../public_types";
import Adaptation from "./adaptation";
import { IAdaptationType } from "./types";
/** Structure listing every `Adaptation` in a Period. */
export declare type IManifestAdaptations = Partial<Record<IAdaptationType, Adaptation[]>>;
/**
 * Class representing the tracks and qualities available from a given time
 * period in the the Manifest.
 * @class Period
 */
export default class Period {
    /** ID uniquely identifying the Period in the Manifest. */
    readonly id: string;
    /** Every 'Adaptation' in that Period, per type of Adaptation. */
    adaptations: IManifestAdaptations;
    /** Absolute start time of the Period, in seconds. */
    start: number;
    /**
     * Duration of this Period, in seconds.
     * `undefined` for still-running Periods.
     */
    duration: number | undefined;
    /**
     * Absolute end time of the Period, in seconds.
     * `undefined` for still-running Periods.
     */
    end: number | undefined;
    /**
     * Array containing every errors that happened when the Period has been
     * created, in the order they have happened.
     */
    readonly contentWarnings: IPlayerError[];
    /** Array containing every stream event happening on the period */
    streamEvents: IManifestStreamEvent[];
    /**
     * @constructor
     * @param {Object} args
     * @param {function|undefined} [representationFilter]
     */
    constructor(args: IParsedPeriod, representationFilter?: IRepresentationFilter | undefined);
    /**
     * Returns every `Adaptations` (or `tracks`) linked to that Period, in an
     * Array.
     * @returns {Array.<Object>}
     */
    getAdaptations(): Adaptation[];
    /**
     * Returns every `Adaptations` (or `tracks`) linked to that Period for a
     * given type.
     * @param {string} adaptationType
     * @returns {Array.<Object>}
     */
    getAdaptationsForType(adaptationType: IAdaptationType): Adaptation[];
    /**
     * Returns the Adaptation linked to the given ID.
     * @param {number|string} wantedId
     * @returns {Object|undefined}
     */
    getAdaptation(wantedId: string): Adaptation | undefined;
    /**
     * Returns Adaptations that contain Representations in supported codecs.
     * @param {string|undefined} type - If set filter on a specific Adaptation's
     * type. Will return for all types if `undefined`.
     * @returns {Array.<Adaptation>}
     */
    getSupportedAdaptations(type?: IAdaptationType): Adaptation[];
    /**
     * Returns true if the give time is in the time boundaries of this `Period`.
     * @param {number} time
     * @returns {boolean}
     */
    containsTime(time: number): boolean;
}
