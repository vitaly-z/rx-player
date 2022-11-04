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
import Manifest from "../../manifest";
/**
 * Keep the MediaSource's duration up-to-date with what is being played.
 * @class MediaDurationUpdater
 */
export default class MediaDurationUpdater {
    private _subscription;
    /**
     * The last known audio Adaptation (i.e. track) chosen for the last Period.
     * Useful to determinate the duration of the current content.
     * `undefined` if the audio track for the last Period has never been known yet.
     * `null` if there are no chosen audio Adaptation.
     */
    private _lastKnownDuration;
    /**
     * Create a new `MediaDurationUpdater` that will keep the given MediaSource's
     * duration as soon as possible.
     * This duration will be updated until the `stop` method is called.
     * @param {Object} manifest - The Manifest currently played.
     * For another content, you will have to create another `MediaDurationUpdater`.
     * @param {MediaSource} mediaSource - The MediaSource on which the content is
     * pushed.
     */
    constructor(manifest: Manifest, mediaSource: MediaSource);
    /**
     * By default, the `MediaDurationUpdater` only set a safe estimate for the
     * MediaSource's duration.
     * A more precize duration can be set by communicating to it a more precize
     * media duration through `updateKnownDuration`.
     * If the duration becomes unknown, `undefined` can be given to it so the
     * `MediaDurationUpdater` goes back to a safe estimate.
     * @param {number | undefined} newDuration
     */
    updateKnownDuration(newDuration: number | undefined): void;
    /**
     * Stop the `MediaDurationUpdater` from updating and free its resources.
     * Once stopped, it is not possible to start it again, beside creating another
     * `MediaDurationUpdater`.
     */
    stop(): void;
}
