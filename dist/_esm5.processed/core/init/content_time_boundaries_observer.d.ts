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
import Manifest from "../../manifest";
import { IReadOnlyPlaybackObserver } from "../api";
import { IStreamOrchestratorEvent, IStreamOrchestratorPlaybackObservation } from "../stream";
import { IWarningEvent } from "./types";
/**
 * Observes the position and Adaptations being played and deduce various events
 * related to the available time boundaries:
 *  - Emit when the theoretical duration of the content becomes known or when it
 *    changes.
 *  - Emit warnings when the duration goes out of what is currently
 *    theoretically playable.
 *
 * @param {Object} manifest
 * @param {Observable} streams
 * @param {Object} playbackObserver
 * @returns {Observable}
 */
export default function ContentTimeBoundariesObserver(manifest: Manifest, streams: Observable<IStreamOrchestratorEvent>, playbackObserver: IReadOnlyPlaybackObserver<IContentTimeObserverPlaybackObservation>): Observable<IContentDurationUpdateEvent | IWarningEvent>;
/**
 * Emitted when the duration of the full content (== the last playable position)
 * has changed.
 */
export interface IContentDurationUpdateEvent {
    type: "contentDurationUpdate";
    /** The new theoretical duration, `undefined` if unknown, */
    value: number | undefined;
}
export declare type IContentTimeObserverPlaybackObservation = Pick<IStreamOrchestratorPlaybackObservation, "position">;
