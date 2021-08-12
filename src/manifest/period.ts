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
  MediaError,
} from "../errors";
import {
  IManifestStreamEvent,
  IParsedPeriod,
} from "../parsers/manifest";
import arrayFind from "../utils/array_find";
import arrayFindIndex from "../utils/array_find_index";
import objectValues from "../utils/object_values";
import Adaptation, {
  IRepresentationFilter,
} from "./adaptation";
import {
  IAdaptationType,
  IHDRInformation,
} from "./types";

export interface ITrackOrganizerTrackInfo {
  language? : string;
  normalizedLanguage? : string;
  isAudioDescription? : boolean;
  isClosedCaption? : boolean;
  isDub? : boolean;
  isSignInterpreted?: boolean;
  representations : ITrackOrganizerRepresentation[];
}

export interface ITrackOrganizerRepresentation {
  id : string;
  height? : number;
  width? : number;
  bitrate? : number;
  frameRate? : string;
  codecs? : string;
  mimeType? : string;
  hdrInfo? : IHDRInformation;
}
export interface ITrackOrganizerModifiers {
  createNewTrackFor(representationIds : string[]) : void;
  removeRepresentation(representationId : string) : void;
}

export type ITrackOrganizer = (
  trackType : string,
  trackInfo : ITrackOrganizerTrackInfo,
  trackModifiers : ITrackOrganizerModifiers
) => void;

/** Structure listing every `Adaptation` in a Period. */
export type IManifestAdaptations = Partial<Record<IAdaptationType, Adaptation[]>>;

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

  /**
   * Array containing every errors that happened when the Period has been
   * created, in the order they have happened.
   */
  public readonly parsingErrors : ICustomError[];

  /** Array containing every stream event happening on the period */
  public streamEvents : IManifestStreamEvent[];

  /**
   * @constructor
   * @param {Object} args
   * @param {function|undefined} [representationFilter]
   */
  constructor(
    args : IParsedPeriod,
    representationFilter? : IRepresentationFilter,
    trackOrganizer? : ITrackOrganizer
  ) {
    this.parsingErrors = [];
    this.id = args.id;
    this.adaptations = (Object.keys(args.adaptations) as IAdaptationType[])
      .reduce<IManifestAdaptations>((acc, type) => {
        const adaptationsForType = args.adaptations[type];
        if (adaptationsForType == null) {
          return acc;
        }
        const filteredAdaptations = adaptationsForType
          .map((adaptation) : Adaptation|null => {
            const newAdaptation = new Adaptation(adaptation, { representationFilter });

            const representations = newAdaptation.representations;
            if (typeof trackOrganizer === "function") {
              const formattedReps : ITrackOrganizerRepresentation[] =
                representations.reduce((repAcc, rep) => {
                  if (!rep.isSupported) {
                    return repAcc;
                  }
                  repAcc.push({ id: rep.id,
                                height: rep.height,
                                width: rep.width,
                                bitrate: rep.bitrate,
                                frameRate : rep.frameRate,
                                codecs: rep.codecs,
                                mimeType: rep.mimeType,
                                hdrInfo: rep.hdrInfo });
                  return repAcc;
                }, [] as ITrackOrganizerRepresentation[]);
              const trackInfo = { language: newAdaptation.language,
                                  normalizedLanguage: newAdaptation.normalizedLanguage,
                                  isAudioDescription: newAdaptation.isAudioDescription,
                                  isClosedCaption: newAdaptation.isClosedCaption,
                                  isDub: newAdaptation.isDub,
                                  isSignInterpreted: newAdaptation.isSignInterpreted,
                                  representations: formattedReps };

              let callFinished = false;
              trackOrganizer(newAdaptation.type, trackInfo, {
                createNewTrackFor(representationIds) {
                  if (callFinished) {
                    throw new Error(
                      "`createNewTrackFor` modifier called after `trackOrganizer` call."
                    );
                  }
                  const toMove = representationIds.map((representationId) => {
                    const idx = arrayFindIndex(representations, ({ id }) => {
                      return id === representationId;
                    });
                    if (idx < 0) {
                      throw new Error("Wanted Representation to remove not found");
                    }
                    return representations.splice(idx, 1)[0];
                  });
                  // XXX TODO ID
                  adaptation.representations = [];
                  new Adaptation(adaptation, { baseRepresentations: toMove });
                },
                removeRepresentation(representationId) {
                  if (callFinished) {
                    throw new Error("`removeRepresentation` modifier called after " +
                                    "`trackOrganizer` call.");
                  }
                  const idx = arrayFindIndex(representations, ({ id }) => {
                    return id === representationId;
                  });
                  if (idx < 0) {
                    throw new Error("Wanted Representation to remove not found");
                  }
                  representations.splice(idx, 1);
                },
              });
              callFinished = true;
            }
            this.parsingErrors.push(...newAdaptation.parsingErrors);
            return newAdaptation;
          })
          .filter((adaptation) : adaptation is Adaptation =>
            adaptation !== null && adaptation.representations.length > 0
          );
        if (filteredAdaptations.every(adaptation => !adaptation.isSupported) &&
            adaptationsForType.length > 0 &&
            (type === "video" || type === "audio")
        ) {
          throw new MediaError("MANIFEST_PARSE_ERROR",
                               "No supported " + type + " adaptations");
        }

        if (filteredAdaptations.length > 0) {
          acc[type] = filteredAdaptations;
        }
        return acc;
      }, {});

    if (!Array.isArray(this.adaptations.video) &&
        !Array.isArray(this.adaptations.audio))
    {
      throw new MediaError("MANIFEST_PARSE_ERROR",
                           "No supported audio and video tracks.");
    }

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
