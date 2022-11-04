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
import { CancellationSignal } from "../../../utils/task_canceller";
import { SegmentBuffer } from "../../segment_buffers";
/**
 * Run the garbage collector.
 *
 * Try to clean up buffered ranges from a low gcGap at first.
 * If it does not succeed to clean up space, use a higher gcCap.
 *
 * @param {number} currentPosition
 * @param {Object} bufferingQueue
 * @param {Object} cancellationSignal
 * @returns {Promise}
 */
export default function forceGarbageCollection(currentPosition: number, bufferingQueue: SegmentBuffer, cancellationSignal: CancellationSignal): Promise<void>;
