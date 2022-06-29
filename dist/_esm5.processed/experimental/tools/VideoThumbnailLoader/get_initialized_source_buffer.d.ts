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
import { ISegmentFetcher } from "../../../core/fetchers/segment/segment_fetcher";
import { AudioVideoSegmentBuffer } from "../../../core/segment_buffers/implementations";
import { IContentInfos } from "./types";
/**
 * Get video source buffer :
 * - If it is already created for the media element, then reuse it.
 * - Else, create a new one and load and append the init segment.
 * @param {Object} contentInfos
 * @param {HTMLVideoElement} element
 * @returns {Observable}
 */
export declare function getInitializedSourceBuffer$(contentInfos: IContentInfos, element: HTMLVideoElement, segmentFetcher: ISegmentFetcher<ArrayBuffer | Uint8Array>): Observable<AudioVideoSegmentBuffer>;
/**
 * Reset the source buffers
 * @returns {void}
 */
export declare function disposeMediaSource(): void;
