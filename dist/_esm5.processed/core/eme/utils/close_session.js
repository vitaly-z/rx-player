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
import { of as observableOf, timer, race as observableRace, } from "rxjs";
import { catchError, mergeMap, take, tap, } from "rxjs/operators";
import { closeSession, } from "../../../compat";
import { onKeyMessage$, onKeyStatusesChange$ } from "../../../compat/event_listeners";
import config from "../../../config";
import log from "../../../log";
var EME_SESSION_CLOSING_MAX_RETRY = config.EME_SESSION_CLOSING_MAX_RETRY, EME_SESSION_CLOSING_INITIAL_DELAY = config.EME_SESSION_CLOSING_INITIAL_DELAY, EME_SESSION_CLOSING_MAX_DELAY = config.EME_SESSION_CLOSING_MAX_DELAY;
/**
 * Close a MediaKeySession with multiple attempts if needed and do not throw if
 * this action throws an error.
 * Emits then complete when done.
 * @param {MediaKeySession} mediaKeySession
 * @returns {Observable}
 */
export default function safelyCloseMediaKeySession(mediaKeySession) {
    return recursivelyTryToCloseMediaKeySession(0);
    /**
     * Perform a new attempt at closing the MediaKeySession.
     * If this operation fails due to a not-"callable" (an EME term)
     * MediaKeySession, retry based on either a timer or on MediaKeySession
     * events, whichever comes first.
     * Emits then complete when done.
     * @param {number} retryNb - The attempt number starting at 0.
     * @returns {Observable}
     */
    function recursivelyTryToCloseMediaKeySession(retryNb) {
        console.warn("EME: Trying to close a MediaKeySession", mediaKeySession.sessionId, retryNb);
        return closeSession(mediaKeySession).pipe(tap(function () {
            console.warn("EME: Succeeded to close MediaKeySession", mediaKeySession.sessionId);
        }), catchError(function (err) {
            // Unitialized MediaKeySession may not close properly until their
            // corresponding `generateRequest` or `load` call are handled by the
            // browser.
            // In that case the EME specification tells us that the browser is
            // supposed to reject the `close` call with an InvalidStateError.
            if (!(err instanceof Error) || err.name !== "InvalidStateError" ||
                mediaKeySession.sessionId !== "") {
                return failToCloseSession(err);
            }
            // We will retry either:
            //   - when an event indicates that the MediaKeySession is
            //     initialized (`callable` is the proper EME term here)
            //   - after a delay, raising exponentially
            var nextRetryNb = retryNb + 1;
            if (nextRetryNb > EME_SESSION_CLOSING_MAX_RETRY) {
                return failToCloseSession(err);
            }
            var delay = Math.min(Math.pow(2, retryNb) * EME_SESSION_CLOSING_INITIAL_DELAY, EME_SESSION_CLOSING_MAX_DELAY);
            console.warn("EME: attempt to close a mediaKeySession failed, " +
                "scheduling retry...", delay, mediaKeySession.sessionId);
            return observableRace([timer(delay),
                onKeyStatusesChange$(mediaKeySession),
                onKeyMessage$(mediaKeySession)])
                .pipe(take(1), mergeMap(function () { return recursivelyTryToCloseMediaKeySession(nextRetryNb); }));
        }));
    }
    /**
     * Log error anouncing that we could not close the MediaKeySession and emits
     * then complete through Observable.
     * TODO Emit warning?
     * @returns {Observable}
     */
    function failToCloseSession(err) {
        log.error("EME: Could not close MediaKeySession: " +
            (err instanceof Error ? err.toString() :
                "Unknown error"));
        return observableOf(null);
    }
}
