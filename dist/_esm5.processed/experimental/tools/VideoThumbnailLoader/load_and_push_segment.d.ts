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
import { ISegmentFetcher, ISegmentLoaderContent } from "../../../core/fetchers/segment/segment_fetcher";
import { AudioVideoSegmentBuffer } from "../../../core/segment_buffers/implementations";
import { CancellationSignal } from "../../../utils/task_canceller";
/**
 * @param {Object} segmentInfo
 * @param {Object} segmentBuffer
 * @param {Object} segmentFetcher
 * @param {Object} cancelSignal
 * @returns {Promise}
 */
export default function loadAndPushSegment(segmentInfo: ISegmentLoaderContent, segmentBuffer: AudioVideoSegmentBuffer, segmentFetcher: ISegmentFetcher<ArrayBuffer | Uint8Array>, cancelSignal: CancellationSignal): Promise<unknown>;
