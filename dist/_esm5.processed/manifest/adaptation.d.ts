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
import { IParsedAdaptation } from "../parsers/manifest";
import type { IAdaptation, IAdaptationType, IExposedRepresentation } from "./types";
/** List in an array every possible value for the Adaptation's `type` property. */
export declare const SUPPORTED_ADAPTATIONS_TYPE: IAdaptationType[];
/**
 * Create an `IAdaptation`-compatible object, which will declare a single
 * "Adaptation" (i.e. track) of a content.
 * @param {Object} parsedAdaptation
 * @param {Object|undefined} [options]
 * @returns {Object}
 */
export declare function createAdaptationObject(parsedAdaptation: IParsedAdaptation, options?: {
    representationFilter?: IRepresentationFilter | undefined;
    isManuallyAdded?: boolean | undefined;
}): Promise<IAdaptation>;
/**
 * Information describing a single Representation from an Adaptation, to be used
 * in the `representationFilter` API.
 */
export interface IRepresentationInfos {
    bufferType: IAdaptationType;
    language?: string | undefined;
    isAudioDescription?: boolean | undefined;
    isClosedCaption?: boolean | undefined;
    isDub?: boolean | undefined;
    isSignInterpreted?: boolean | undefined;
    normalizedLanguage?: string | undefined;
}
/** Type for the `representationFilter` API. */
export declare type IRepresentationFilter = (representation: IExposedRepresentation, adaptationInfos: IRepresentationInfos) => boolean;
