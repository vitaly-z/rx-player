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

import {
  combineLatest as observableCombineLatest,
  distinctUntilChanged,
  EMPTY,
  filter,
  fromEvent as observableFromEvent,
  interval as observableInterval,
  map,
  merge as observableMerge,
  Observable,
  of as observableOf,
  startWith,
  Subscription,
  switchMap,
  take,
  tap,
} from "rxjs";
import {
  onSourceOpen$,
  onSourceClose$,
  onSourceEnded$,
} from "../../compat/event_listeners";
import log from "../../log";
import Manifest from "../../manifest";
import { fromEvent } from "../../utils/event_emitter";
import createSharedReference, {
  ISharedReference,
} from "../../utils/reference";

/** Number of seconds in a regular year. */
const YEAR_IN_SECONDS = 365 * 24 * 3600;

/**
 * Keep the MediaSource's duration up-to-date with what is being played.
 * @class MediaDurationUpdater
 */
export default class MediaDurationUpdater {
  private _subscription : Subscription;
  /**
   * The last known audio Adaptation (i.e. track) chosen for the last Period.
   * Useful to determinate the duration of the current content.
   * `undefined` if the audio track for the last Period has never been known yet.
   * `null` if there are no chosen audio Adaptation.
   */
  private _lastKnownDuration : ISharedReference<number | undefined>;

  /**
   * Create a new `MediaDurationUpdater` that will keep the given MediaSource's
   * duration as soon as possible.
   * This duration will be updated until the `stop` method is called.
   * @param {Object} manifest - The Manifest currently played.
   * For another content, you will have to create another `MediaDurationUpdater`.
   * @param {MediaSource} mediaSource - The MediaSource on which the content is
   * pushed.
   * @param {HTMLMediaElement} mediaElement
   */
  constructor(
    manifest : Manifest,
    mediaSource : MediaSource,
    mediaElement : HTMLMediaElement
  ) {
    this._lastKnownDuration = createSharedReference(undefined);
    this._subscription = isMediaSourceOpened$(mediaSource).pipe(
      switchMap((canUpdate) =>
        canUpdate ? observableCombineLatest([this._lastKnownDuration.asObservable(),
                                             fromEvent(manifest, "manifestUpdate")
                                               .pipe(startWith(null))]) :
                    EMPTY
      ),
      switchMap(([lastKnownDuration]) =>
        whenSourceBuffersEndedUpdates$(mediaSource.sourceBuffers).pipe(
          take(1)
        ).pipe(tap(() => {
          setMediaSourceDuration(mediaSource,
                                 mediaElement,
                                 manifest,
                                 lastKnownDuration);
        }))
      )).subscribe();
  }

  /**
   * By default, the `MediaDurationUpdater` only set a safe estimate for the
   * MediaSource's duration.
   * A more precize duration can be set by communicating to it a more precize
   * media duration through `updateKnownDuration`.
   * If the duration becomes unknown, `undefined` can be given to it so the
   * `MediaDurationUpdater` goes back to a safe estimate.
   * @param {number | undefined} newDuration
   */
  public updateKnownDuration(
    newDuration : number | undefined
  ) : void {
    this._lastKnownDuration.setValue(newDuration);
  }

  /**
   * Stop the `MediaDurationUpdater` from updating and free its resources.
   * Once stopped, it is not possible to start it again, beside creating another
   * `MediaDurationUpdater`.
   */
  public stop() {
    this._subscription.unsubscribe();
  }
}

/**
 * Checks that duration can be updated on the MediaSource, and then
 * sets it.
 *
 * Returns either:
 *   - the new duration it has been updated to if it has
 *   - `null` if it hasn'nt been updated
 *
 * @param {MediaSource} mediaSource
 * @param {HTMLMediaElement} mediaElement
 * @param {Object} manifest
 * @returns {Observable.<number | null>}
 */
function setMediaSourceDuration(
  mediaSource: MediaSource,
  mediaElement: HTMLMediaElement,
  manifest: Manifest,
  knownDuration : number | undefined
): number | null {
  let newDuration  = knownDuration;

  if (newDuration === undefined) {
    if (manifest.isDynamic) {
      const maxPotentialPos = manifest.getLivePosition() ??
                              manifest.getMaximumSafePosition();
      // Some targets poorly support setting a very high number for durations.
      // Yet, in dynamic contents, we would prefer setting a value as high as possible
      // to still be able to seek anywhere we want to (even ahead of the Manifest if
      // we want to). As such, we put it at a safe default value of 2^32 excepted
      // when the maximum position is already relatively close to that value, where
      // we authorize exceptionally going over it.
      newDuration =  Math.max(Math.pow(2, 32), maxPotentialPos + YEAR_IN_SECONDS);
    } else {
      newDuration = manifest.getMaximumSafePosition();
    }
  }

  // XXX TODO check all that shit, with SourceBuffers perhaps.
  const bufferedLen = mediaElement.buffered.length;
  if ((bufferedLen > 0 && mediaElement.buffered.end(bufferedLen - 1) >= newDuration)) {
    // We already buffered further than the duration we want to set.
    // Keep the duration that was set at that time as a security.
    return null;
  }
  if (isNaN(mediaSource.duration) || !isFinite(mediaSource.duration) ||
      newDuration - mediaSource.duration > 0.01) {
    try {
      log.info("Init: Updating duration", newDuration);
      mediaSource.duration = newDuration;
    } catch (err) {
      log.warn("Duration Updater: Can't update duration on the MediaSource.", err);
      return null;
    }
    return newDuration;
  }
  return null;
}

/**
 * Returns an Observable which will emit only when all the SourceBuffers ended
 * all pending updates.
 * @param {SourceBufferList} sourceBuffers
 * @returns {Observable}
 */
function whenSourceBuffersEndedUpdates$(
  sourceBuffers: SourceBufferList
) : Observable<undefined> {
  if (sourceBuffers.length === 0) {
    return observableOf(undefined);
  }
  const sourceBufferUpdatingStatuses : Array<Observable<boolean>> = [];

  for (let i = 0; i < sourceBuffers.length; i++) {
    const sourceBuffer = sourceBuffers[i];
    sourceBufferUpdatingStatuses.push(
      observableMerge(
        observableFromEvent(sourceBuffer, "updatestart").pipe(map(() => true)),
        observableFromEvent(sourceBuffer, "update").pipe(map(() => false)),
        observableInterval(500).pipe(map(() => sourceBuffer.updating))
      ).pipe(
        startWith(sourceBuffer.updating),
        distinctUntilChanged()
      )
    );
  }
  return observableCombineLatest(sourceBufferUpdatingStatuses).pipe(
    filter((areUpdating) => {
      return areUpdating.every((isUpdating) => !isUpdating);
    }),
    map(() => undefined)
  );
}

/**
 * Emit a boolean that tells if the media source is opened or not.
 * @param {MediaSource} mediaSource
 * @returns {Object}
 */
function isMediaSourceOpened$(mediaSource: MediaSource): Observable<boolean> {
  return observableMerge(onSourceOpen$(mediaSource).pipe(map(() => true)),
                         onSourceEnded$(mediaSource).pipe(map(() => false)),
                         onSourceClose$(mediaSource).pipe(map(() => false))
  ).pipe(
    startWith(mediaSource.readyState === "open"),
    distinctUntilChanged()
  );
}
/* eslint-enable @typescript-eslint/no-unsafe-argument */
