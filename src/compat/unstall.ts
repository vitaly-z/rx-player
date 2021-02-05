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

import { isTizen } from "./browser_detection";

/**
 * Unstall needs player to seek at a given position (in case of a discontinuity,
 * or even just if playback is stuck).
 * On some targets, seek may be slow or provoque a stall by itself. In that case,
 * try to pause and play playback to unstall.
 * @param {HTMLMediaElement} mediaElement
 * @param {number} seekPositionToUnstall
 * @returns {Object}
 */
export default function unstall(mediaElement: HTMLMediaElement,
                                seekPositionToUnstall: number): void {
  if (isTizen) {
    mediaElement.pause();
  }
  mediaElement.currentTime = seekPositionToUnstall;
  if (isTizen) {
    /* eslint-disable-next-line @typescript-eslint/no-floating-promises */
    mediaElement.play();
  }
}
