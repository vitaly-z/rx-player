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
import { IManifest } from "../../manifest";
import { IReadOnlySharedReference } from "../../utils/reference";
import { IReadOnlyPlaybackObserver, PlaybackObserver } from "../api";
import { IStreamOrchestratorPlaybackObservation } from "../stream";
/** Arguments needed to create the Stream's version of the PlaybackObserver. */
export interface IStreamPlaybackObserverArguments {
    /** If true, the player will auto-play when `initialPlayPerformed` becomes `true`. */
    autoPlay: boolean;
    /** Becomes `true` after the initial play has been taken care of. */
    initialPlayPerformed: IReadOnlySharedReference<boolean>;
    /** Becomes `true` after the initial seek has been taken care of. */
    initialSeekPerformed: IReadOnlySharedReference<boolean>;
    /** The last speed requested by the user. */
    speed: IReadOnlySharedReference<number>;
    /** The time the player will seek when `initialSeekPerformed` becomes `true`. */
    startTime: number;
}
/**
 * Create PlaybackObserver for the `Stream` part of the code.
 * @param {Object} playbackObserver
 * @param {Object} args
 * @returns {Observable}
 */
export default function createStreamPlaybackObserver(manifest: IManifest, playbackObserver: PlaybackObserver, { autoPlay, initialPlayPerformed, initialSeekPerformed, speed, startTime }: IStreamPlaybackObserverArguments): IReadOnlyPlaybackObserver<IStreamOrchestratorPlaybackObservation>;
