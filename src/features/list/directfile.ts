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

// eslint-disable-next-line max-len
import MediaElementTrackChoiceManager from "../../core/api/tracks_management/media_element_track_choice_manager";
import directfile from "../../core/init/directfile_content_initializer";
import { IFeaturesObject } from "../types";

/**
 * Add ability to play file natively played by the browser
 * (`directfile` transport)
 * @param {Object} features
 */
function addDirectfileFeature(features : IFeaturesObject) : void {
  features.directfile = {
    initDirectFile: directfile,
    mediaElementTrackChoiceManager: MediaElementTrackChoiceManager,
  };
}

export { addDirectfileFeature as DIRECTFILE };
export default addDirectfileFeature;
