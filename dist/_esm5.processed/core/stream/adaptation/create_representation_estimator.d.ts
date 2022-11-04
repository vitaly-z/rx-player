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
import Manifest, { Adaptation, Period, Representation } from "../../../manifest";
import { IPlayerError } from "../../../public_types";
import { IReadOnlySharedReference } from "../../../utils/reference";
import { CancellationSignal } from "../../../utils/task_canceller";
import { IABREstimate, IRepresentationEstimatorPlaybackObservation, IRepresentationEstimator, IRepresentationEstimatorCallbacks } from "../../adaptive";
import { IReadOnlyPlaybackObserver } from "../../api";
/**
 * Produce estimates to know which Representation should be played.
 * @param {Object} content - The Manifest, Period and Adaptation wanted.
 * @param {Object} representationEstimator - `IRepresentationEstimator` which
 * will produce Representation estimates.
 * @param {Object} currentRepresentation - Reference emitting the
 * currently-loaded Representation.
 * @param {Object} playbackObserver - Allows to observe the current playback
 * conditions.
 * @param {Function} onFatalError - Callback called when a fatal error was
 * thrown. Once this callback is called, no estimate will be produced.
 * @param {Object} cancellationSignal - `CancellationSignal` allowing to abort
 * the production of estimates (and clean-up all linked resources).
 * @returns {Object} - Returns an object with the following properties:
 *   - `estimateRef`: Reference emitting the last estimate
 *   - `abrCallbacks`: Callbacks allowing to report back network and playback
 *     activities to improve the estimates given.
 */
export default function getRepresentationEstimate(content: {
    manifest: Manifest;
    period: Period;
    adaptation: Adaptation;
}, representationEstimator: IRepresentationEstimator, currentRepresentation: IReadOnlySharedReference<Representation | null>, playbackObserver: IReadOnlyPlaybackObserver<IRepresentationEstimatorPlaybackObservation>, onFatalError: (err: IPlayerError) => void, cancellationSignal: CancellationSignal): {
    estimateRef: IReadOnlySharedReference<IABREstimate>;
    abrCallbacks: IRepresentationEstimatorCallbacks;
};
