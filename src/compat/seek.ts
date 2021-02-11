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

import { ReplaySubject } from "rxjs";

// import { isTizen } from "./browser_detection";

const isSeekingWithPausePlay$ = new ReplaySubject<boolean>();
isSeekingWithPausePlay$.next(false);

export { isSeekingWithPausePlay$ };
export default function seek(mediaElement: HTMLMediaElement, seekAt: number): void {
  if (mediaElement.paused) {
    mediaElement.currentTime = seekAt;
    return;
  }
  isSeekingWithPausePlay$.next(true);
  mediaElement.pause();
  mediaElement.currentTime = seekAt;
  /* eslint-disable @typescript-eslint/no-floating-promises */
  mediaElement.play().then(() => isSeekingWithPausePlay$.next(false));
}
