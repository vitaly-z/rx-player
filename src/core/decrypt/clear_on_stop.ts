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

import { shouldUnsetMediaKeys } from "../../compat/";
import log from "../../log";
import disposeDecryptionResources from "./dispose_decryption_resources";
import MediaKeysInfosStore from "./utils/media_keys_infos_store";

/**
 * Clear DRM-related resources that should be cleared when the current content
 * stops its playback.
 * @param {HTMLMediaElement} mediaElement
 * @returns {Promise}
 */
export default function clearOnStop(
  mediaElement : HTMLMediaElement
) : Promise<unknown> {
  log.info("DRM: Clearing-up DRM session.");
  if (shouldUnsetMediaKeys()) {
    log.info("DRM: disposing current MediaKeys.");
    return disposeDecryptionResources(mediaElement);
  }

  const currentState = MediaKeysInfosStore.getState(mediaElement);
  if (currentState !== null &&
      currentState.keySystemOptions.closeSessionsOnStop === true)
  {
    log.info("DRM: closing all current sessions.");
    return currentState.loadedSessionsStore.closeAllSessions();
  }
  log.info("DRM: Nothing to clear. Returning right away. No state =",
           currentState === null);
  return Promise.resolve();
}
