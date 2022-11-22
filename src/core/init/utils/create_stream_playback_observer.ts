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

import { IWorkerPlaybackObservation } from "../../../main";
import Manifest from "../../../manifest";
import createSharedReference, {
  IReadOnlySharedReference,
} from "../../../utils/reference";
import { CancellationSignal } from "../../../utils/task_canceller";
import {
  IPlaybackObservation,
  IReadOnlyPlaybackObserver,
} from "../../api";
import { IStreamOrchestratorPlaybackObservation } from "../../stream";

/** Arguments needed to create the Stream's version of the PlaybackObserver. */
export interface IStreamPlaybackObserverArguments {
  /** The last speed requested by the user. */
  speed : IReadOnlySharedReference<number>;
}

/**
 * Create PlaybackObserver for the `Stream` part of the code.
 * @param {Object} manifest
 * @param {Object} playbackObserver
 * @param {Object} args
 * @returns {Object}
 */
export default function createStreamPlaybackObserver(
  manifest : Manifest,
  playbackObserver : IReadOnlyPlaybackObserver<IWorkerPlaybackObservation>,
  { speed } : IStreamPlaybackObserverArguments
) : IReadOnlyPlaybackObserver<IStreamOrchestratorPlaybackObservation> {
  return playbackObserver.deriveReadOnlyObserver(function transform(
    observationRef : IReadOnlySharedReference<IPlaybackObservation>,
    cancellationSignal : CancellationSignal
  ) : IReadOnlySharedReference<IStreamOrchestratorPlaybackObservation> {
    const newRef = createSharedReference(constructStreamPlaybackObservation());

    speed.onUpdate(emitStreamPlaybackObservation, {
      clearSignal: cancellationSignal,
      emitCurrentValue: false,
    });

    observationRef.onUpdate(emitStreamPlaybackObservation, {
      clearSignal: cancellationSignal,
      emitCurrentValue: false,
    });

    cancellationSignal.register(() => {
      newRef.finish();
    });

    return newRef;

    function constructStreamPlaybackObservation() {
      const observation = observationRef.getValue();
      const lastSpeed = speed.getValue();
      // let pendingPosition : number | undefined;
      // if (!initialSeekPerformed.getValue()) {
      //   pendingPosition = startTime;
      // } else if (!manifest.isDynamic || manifest.isLastPeriodKnown) {
      //   // HACK: When the position is actually further than the maximum
      //   // position for a finished content, we actually want to be loading
      //   // the last segment before ending.
      //   // For now, this behavior is implicitely forced by making as if we
      //   // want to seek one second before the period's end (despite never
      //   // doing it).
      //   const lastPeriod = manifest.periods[manifest.periods.length - 1];
      //   if (lastPeriod !== undefined &&
      //       lastPeriod.end !== undefined &&
      //       observation.position > lastPeriod.end)
      //   {
      //     pendingPosition = lastPeriod.end - 1;
      //   }
      // }

      return {
        // TODO more exact according to the current Adaptation chosen?
        maximumPosition: manifest.getMaximumSafePosition(),
        position: observation.position,
        duration: observation.duration,
        paused: observation.paused,
        readyState: observation.readyState,
        speed: lastSpeed,
      };
    }

    function emitStreamPlaybackObservation() {
      newRef.setValue(constructStreamPlaybackObservation());
    }
  });
}
