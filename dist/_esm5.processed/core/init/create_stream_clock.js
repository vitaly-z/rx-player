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
import { combineLatest as observableCombineLatest, } from "rxjs";
import { map } from "rxjs/operators";
/**
 * Create clock Observable for the `Stream` part of the code.
 * @param {Observable} initClock$
 * @param {Object} streamClockArgument
 * @returns {Observable}
 */
export default function createStreamClock(initClock$, _a) {
    var autoPlay = _a.autoPlay, initialPlayPerformed = _a.initialPlayPerformed, initialSeekPerformed = _a.initialSeekPerformed, manifest = _a.manifest, speed$ = _a.speed$, startTime = _a.startTime;
    return observableCombineLatest([initClock$, speed$]).pipe(map(function (_a) {
        var tick = _a[0], speed = _a[1];
        var isLive = manifest.isLive;
        return {
            position: tick.position,
            getCurrentTime: tick.getCurrentTime,
            duration: tick.duration,
            isPaused: initialPlayPerformed.getValue() ? tick.paused :
                !autoPlay,
            liveGap: isLive ? manifest.getMaximumPosition() - tick.position :
                Infinity,
            readyState: tick.readyState,
            speed: speed,
            // wantedTimeOffset is an offset to add to the timing's current time to have
            // the "real" wanted position.
            // For now, this is seen when the media element has not yet seeked to its
            // initial position, the currentTime will most probably be 0 where the
            // effective starting position will be _startTime_.
            // Thus we initially set a wantedTimeOffset equal to startTime.
            wantedTimeOffset: initialSeekPerformed.getValue() ? 0 :
                startTime - tick.position,
        };
    }));
}
