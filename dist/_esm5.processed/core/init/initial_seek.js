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
import { Observable, timer } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";
import log from "../../log";
/**
 *
 * @param time
 * @param mediaElement
 */
function initialSeek$(time, mediaElement) {
    return new Observable(function (obs) {
        var timeToSeek = typeof time === "function" ? time() :
            time;
        mediaElement.currentTime = timeToSeek;
        if (mediaElement.currentTime !== timeToSeek) {
            obs.error();
        }
        else {
            obs.next();
        }
        return obs.complete();
    });
}
/**
 *
 * @param time
 * @param mediaElement
 * @param currentTry
 */
export default function initialSeekWithBackOff$(time, mediaElement, currentTry) {
    if (currentTry === void 0) { currentTry = 0; }
    return initialSeek$(time, mediaElement).pipe(catchError(function () {
        if (currentTry >= 4) {
            throw new Error("SamsungError:Too much seek retries.");
        }
        var newCurrentTry = currentTry + 1;
        var delay = newCurrentTry * 10;
        log.info("SamsungDebug: Retrying initial seek.", delay, currentTry + 1);
        return timer(delay).pipe(mergeMap(function () {
            return initialSeekWithBackOff$(time, mediaElement, newCurrentTry);
        }));
    }));
}
