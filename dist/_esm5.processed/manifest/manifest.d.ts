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
import { ICustomError } from "../errors";
import { IParsedManifest } from "../parsers/manifest";
import { IRepresentationFilter } from "./adaptation";
import { IManifest, ISupplementaryImageTrack, ISupplementaryTextTrack } from "./types";
/**
 * Create an `IManifest`-compatible object, which will list all characteristics
 * about a media content, regardless of the streaming protocol.
 * @param {Object} parsedAdaptation
 * @param {Object} options
 * @returns {Array.<Object>} Tuple of two values:
 *   1. The parsed Manifest as an object
 *   2. Array containing every minor errors that happened when the Manifest has
 *      been created, in the order they have happened..
 */
export declare function createManifestObject(parsedManifest: IParsedManifest, options: IManifestParsingOptions): Promise<[IManifest, ICustomError[]]>;
/** Options given to the `Manifest` constructor. */
interface IManifestParsingOptions {
    /** Text tracks to add manually to the Manifest instance. */
    supplementaryTextTracks?: ISupplementaryTextTrack[] | undefined;
    /** Image tracks to add manually to the Manifest instance. */
    supplementaryImageTracks?: ISupplementaryImageTrack[] | undefined;
    /** External callback peforming an automatic filtering of wanted Representations. */
    representationFilter?: IRepresentationFilter | undefined;
    /** Optional URL that points to a shorter version of the Manifest used
     * for updates only. When using this URL for refresh, the manifest will be
     * updated with the partial update type. If this URL is undefined, then the
     * manifest will be updated fully when it needs to be refreshed, and it will
     * fetched through the original URL. */
    manifestUpdateUrl?: string | undefined;
}
export { IManifestParsingOptions };
