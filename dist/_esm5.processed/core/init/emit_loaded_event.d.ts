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
import { Observable } from "rxjs";
import { IPlaybackObservation } from "../api";
import SegmentBuffersStore from "../segment_buffers";
import { ILoadedEvent } from "./types";
/**
 * Emit a `ILoadedEvent` once the content can be considered as loaded.
 * @param {Observable} observation$
 * @param {HTMLMediaElement} mediaElement
 * @param {Object|null} segmentBuffersStore
 * @param {boolean} isDirectfile - `true` if this is a directfile content
 * @returns {Observable}
 */
export default function emitLoadedEvent(observation$: Observable<IPlaybackObservation>, mediaElement: HTMLMediaElement, segmentBuffersStore: SegmentBuffersStore | null, isDirectfile: boolean): Observable<ILoadedEvent>;
