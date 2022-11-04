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
import { Adaptation, Period } from "../../../manifest";
import { IAudioTrackSwitchingMode } from "../../../public_types";
import { SegmentBuffer } from "../../segment_buffers";
export declare type IAdaptationSwitchStrategy = {
    type: "continue";
    value: undefined;
} | {
    type: "clean-buffer";
    value: Array<{
        start: number;
        end: number;
    }>;
} | {
    type: "flush-buffer";
    value: Array<{
        start: number;
        end: number;
    }>;
} | {
    type: "needs-reload";
    value: undefined;
};
export interface IAdaptationSwitchOptions {
    /** RxPlayer's behavior when switching the audio track. */
    audioTrackSwitchingMode: IAudioTrackSwitchingMode;
    /** Behavior when a new video and/or audio codec is encountered. */
    onCodecSwitch: "continue" | "reload";
}
/**
 * Find out what to do when switching Adaptation, based on the current
 * situation.
 * @param {Object} segmentBuffer
 * @param {Object} period
 * @param {Object} adaptation
 * @param {Object} playbackInfo
 * @returns {Object}
 */
export default function getAdaptationSwitchStrategy(segmentBuffer: SegmentBuffer, period: Period, adaptation: Adaptation, playbackInfo: {
    currentTime: number;
    readyState: number;
}, options: IAdaptationSwitchOptions): IAdaptationSwitchStrategy;
