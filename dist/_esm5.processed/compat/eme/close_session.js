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
import { catchError, map, mergeMap, of as observableOf, race as observableRace, timer as observableTimer, } from "rxjs";
import logger from "../../log";
import castToObservable from "../../utils/cast_to_observable";
/**
 * Close session and returns and observable that emits when
 * the session is closed.
 * @param {MediaKeySession|Object} session
 * @returns {Observable}
 */
export default function closeSession$(session) {
    var sessionId = session.sessionId;
    logger.warn("Removing session", sessionId);
    return observableRace(castToObservable(session.remove().then(function () {
        logger.warn("Session removed with success, closing...", sessionId);
        return session.close()
            .then(function () { logger.warn("Session closed with success!", sessionId); });
    }, function () {
        logger.warn("Session removed with failure, closing...", sessionId);
        return session.close()
            .then(function () { logger.warn("Session closed with success!", sessionId); });
    })), 
    // If the session is not closed after 1000ms, try
    // to call another method on session to guess if
    // session is closed or not.
    observableTimer(1000).pipe(mergeMap(function () {
        var tryToUpdateSession$ = castToObservable(session.update(new Uint8Array(1)));
        return tryToUpdateSession$.pipe(
        // Update has resolved, so we can't know if session is closed
        map(function () {
            throw new Error("Compat: Couldn't know if session is " +
                "closed");
        }), catchError(function (err) {
            // The caught error can tell if session is closed
            // (Chrome may throw this error)
            if (err instanceof Error &&
                err.message === "The session is already closed.") {
                return observableOf(null);
            }
            // The `closed` promise may resolve, even if `close()` result has not
            // (it may happen on Firefox). Wait for it and timeout after 1 second.
            // TODO There is a subtle TypeScript issue there that made casting to
            // a type-compatible type mandatory. If a more elegant solution can
            // be found, it should be preffered.
            var sessionIsClosed$ = castToObservable(session.closed);
            return observableRace(sessionIsClosed$, observableTimer(1000).pipe(map(function () {
                throw new Error("Compat: Couldn't know if session is " +
                    "closed");
            })));
        }));
    })));
}
