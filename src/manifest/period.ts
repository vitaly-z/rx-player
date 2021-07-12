/**
 * Copyright 2015 CANAL+ Group
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  ICustomError,
  isKnownError,
  MediaError,
} from "../errors";
import {
  IManifestStreamEvent,
  IParsedPeriod,
} from "../parsers/manifest";
import arrayFind from "../utils/array_find";
import objectValues from "../utils/object_values";
import Adaptation, {
  IRepresentationFilter,
} from "./adaptation";
import {
  IAdaptationType,
  IHDRInformation,
} from "./types";

    // if (trackOrganizer !== undefined) {
    //   let callFinished = false;

    //   const self = this;
    //   const currTracks = this.getAdaptations();
    //   function createNewTrackFrom(trackId : string) : string {
    //     if (callFinished) {
    //       throw new Error("You cannot call `createNewTrackFrom` once the " +
    //                       "`trackOrganizer` call has ended,");
    //     }
    //     const ogTrack = arrayFind(currTracks, ({ id }) => id === trackId);
    //     if (ogTrack === undefined ||
    //         (ogTrack.type !== "audio" &&
    //           ogTrack.type !== "video" &&
    //           ogTrack.type !== "text"))
    //     {
    //       throw new Error("Cannot create new track. " +
    //                       `Base track "${trackId}" not found.`);
    //     }
    //     let adaptationsForType = self.adaptations[ogTrack.type];
    //     if (adaptationsForType === undefined) {
    //       adaptationsForType = [];
    //       self.adaptations[ogTrack.type] = adaptationsForType;
    //     }
    //     const newTrackId = "TODO";
    //     const newAdaptation = ogTrack.clone(newTrackId, []);
    //     adaptationsForType.push

    //     return newTrackId;
    //   }
    // }

/** Structure listing every `Adaptation` in a Period. */
export type IManifestAdaptations = Partial<Record<IAdaptationType, Adaptation[]>>;

interface ITrackOrganizerAudioRepresentation {
  id : string;
  bitrate? : number | undefined;
  codec? : string | undefined;
}

export interface ITrackOrganizerAudioTrack {
  language : string;
  normalized : string;
  audioDescription : boolean;
  dub? : boolean | undefined;
  id : number|string;
  representations: ITrackOrganizerAudioRepresentation[];
}

interface ITrackOrganizerVideoRepresentation {
  id : string;
  bitrate? : number | undefined;
  width? : number | undefined;
  height? : number | undefined;
  codec? : string | undefined;
  frameRate? : string | undefined;
  hdrInfo?: IHDRInformation | undefined;
}

interface ITrackOrganizerTextRepresentation {
  id : string;
  bitrate? : number | undefined;
  codec? : string | undefined;
}

export interface ITrackOrganizerTextTrack {
  language : string;
  normalized : string;
  closedCaption : boolean;
  id : number;
  representations : ITrackOrganizerTextRepresentation[];
}

/** Video track returned by the TrackChoiceManager. */
export interface ITrackOrganizerVideoTrack {
  id : number;
  signInterpreted? : boolean | undefined;
  isTrickModeTrack? : boolean | undefined;
  trickModeTracks?: ITrackOrganizerVideoTrack[];
  representations: ITrackOrganizerVideoRepresentation[];
}


export interface ITrackOrganizerTracksInformation {
  periodStart : number;
  periodEnd : number | undefined;
  audioTracks : ITrackOrganizerAudioTrack[];
  videoTracks : ITrackOrganizerVideoTrack[];
}

export interface ITrackOrganizerCallbacks {
  createNewTrackFrom(trackId : string) : string;
  moveRepresentation(
    representationId : string,
    oldTrackId : string,
    newTrackId : string
  ) : void;
  removeRepresentation(representationId : string, trackId : string) : void;
  removeTrack(representationId : string) : void;
}

export type ITrackOrganizer = (
  tracksInfo : ITrackOrganizerTracksInformation,
  callbacks : ITrackOrganizerCallbacks
) => void;

/**
 * Class representing the tracks and qualities available from a given time
 * period in the the Manifest.
 * @class Period
 */
export default class Period {
  /** ID uniquely identifying the Period in the Manifest. */
  public readonly id : string;

  /** Every 'Adaptation' in that Period, per type of Adaptation. */
  public adaptations : IManifestAdaptations;

  /** Absolute start time of the Period, in seconds. */
  public start : number;

  /**
   * Duration of this Period, in seconds.
   * `undefined` for still-running Periods.
   */
  public duration? : number;

  /**
   * Absolute end time of the Period, in seconds.
   * `undefined` for still-running Periods.
   */
  public end? : number;

  /** Array containing every stream event happening on the period */
  public streamEvents : IManifestStreamEvent[];

  /**
   * @constructor
   * @param {Object} args
   * @param {function|undefined} [representationFilter]
   */
  constructor(
    args : IParsedPeriod,
    representationFilter? : IRepresentationFilter
  ) {
    this.id = args.id;
    this.adaptations = (Object.keys(args.adaptations) as IAdaptationType[])
      .reduce<IManifestAdaptations>((acc, type) => {
        const adaptationsForType = args.adaptations[type];
        if (adaptationsForType == null) {
          return acc;
        }
        const filteredAdaptations = adaptationsForType
          .map((adaptation) : Adaptation|null => {
            return new Adaptation(adaptation, { representationFilter });
            // XXX TODO
            // Emit lazily?
            // if (newAdaptation.representations.length > 0 &&
            //     !newAdaptation.isSupported)
            // {
            //   log.warn("Incompatible codecs for adaptation", newAdaptation);
            //   const error = new MediaError(
            //     "MANIFEST_INCOMPATIBLE_CODECS_ERROR",
            //     "An Adaptation contains only incompatible codecs.");
            //   this.parsingErrors.push(error);
            // }
          })
          .filter((adaptation) : adaptation is Adaptation =>
            adaptation !== null && adaptation.representations.length > 0
          );

        // // XXX TODO
        // // Throw lazily?
        // if (filteredAdaptations.every(adaptation => !adaptation.isSupported) &&
        //     adaptationsForType.length > 0 &&
        //     (type === "video" || type === "audio")
        // ) {
        //   throw new MediaError("MANIFEST_PARSE_ERROR",
        //                        `A Period has only unsupported ${type} Adaptations`);
        // }

        if (filteredAdaptations.length > 0) {
          acc[type] = filteredAdaptations;
        }
        return acc;
      }, {});

    // // XXX TODO
    // // Throw lazily?
    // if (!Array.isArray(this.adaptations.video) &&
    //     !Array.isArray(this.adaptations.audio))
    // {
    //   throw new MediaError("MANIFEST_PARSE_ERROR",
    //                        "A Period has no supported audio nor video tracks.");
    // }

    this.duration = args.duration;
    this.start = args.start;

    if (this.duration != null && this.start != null) {
      this.end = this.start + this.duration;
    }
    this.streamEvents = args.streamEvents === undefined ?
      [] :
      args.streamEvents;
  }

  /**
   * Returns every `Adaptations` (or `tracks`) linked to that Period, in an
   * Array.
   * @returns {Array.<Object>}
   */
  getAdaptations() : Adaptation[] {
    const adaptationsByType = this.adaptations;
    return objectValues(adaptationsByType).reduce<Adaptation[]>(
      // Note: the second case cannot happen. TS is just being dumb here
      (acc, adaptations) => adaptations != null ? acc.concat(adaptations) :
                                                  acc,
      []);
  }

  /**
   * Returns every `Adaptations` (or `tracks`) linked to that Period for a
   * given type.
   * @param {string} adaptationType
   * @returns {Array.<Object>}
   */
  getAdaptationsForType(adaptationType : IAdaptationType) : Adaptation[] {
    const adaptationsForType = this.adaptations[adaptationType];
    return adaptationsForType == null ? [] :
                                        adaptationsForType;
  }

  /**
   * Returns the Adaptation linked to the given ID.
   * @param {number|string} wantedId
   * @returns {Object|undefined}
   */
  getAdaptation(wantedId : string) : Adaptation|undefined {
    return arrayFind(this.getAdaptations(), ({ id }) => wantedId === id);
  }

  /**
   * Returns Adaptations that contain Representations in supported codecs.
   * @param {string|undefined} type - If set filter on a specific Adaptation's
   * type. Will return for all types if `undefined`.
   * @returns {Array.<Adaptation>}
   */
  getSupportedAdaptations(type? : IAdaptationType) : Adaptation[] {
    if (type === undefined) {
      return this.getAdaptations().filter(ada => {
        // XXX TODO check that isSupported == false includes no representations
        return ada.isSupported;
      });
    }
    const adaptationsForType = this.adaptations[type];
    if (adaptationsForType === undefined) {
      return [];
    }
    return adaptationsForType.filter(ada => {
      return ada.isSupported;
    });
  }
}
