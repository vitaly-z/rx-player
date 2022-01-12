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
import { combineLatest as observableCombineLatest, concat as observableConcat, distinctUntilChanged, EMPTY, ignoreElements, interval, map, mergeMap, pairwise, scan, startWith, switchMap, tap, of as observableOf, } from "rxjs";
import config from "../../../config";
import { fromEvent } from "../../../utils/event_emitter";
import refreshScheduledEventsList from "./refresh_scheduled_events_list";
var STREAM_EVENT_EMITTER_POLL_INTERVAL = config.STREAM_EVENT_EMITTER_POLL_INTERVAL;
/**
 * Tells if a stream event has a duration
 * @param {Object} evt
 * @returns {Boolean}
 */
function isFiniteStreamEvent(evt) {
    return evt.end !== undefined;
}
/**
 * Get events from manifest and emit each time an event has to be emitted
 * @param {Object} manifest
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
function streamEventsEmitter(manifest, mediaElement, observation$) {
    var eventsBeingPlayed = new WeakMap();
    var lastScheduledEvents = [];
    var scheduledEvents$ = fromEvent(manifest, "manifestUpdate").pipe(startWith(null), scan(function (oldScheduledEvents) {
        return refreshScheduledEventsList(oldScheduledEvents, manifest);
    }, []));
    /**
     * Examine playback situation from playback observations to emit stream events and
     * prepare set onExit callbacks if needed.
     * @param {Array.<Object>} scheduledEvents
     * @param {Object} oldObservation
     * @param {Object} newObservation
     * @returns {Observable}
     */
    function emitStreamEvents$(scheduledEvents, oldObservation, newObservation) {
        var previousTime = oldObservation.currentTime;
        var isSeeking = newObservation.isSeeking, currentTime = newObservation.currentTime;
        var eventsToSend = [];
        var eventsToExit = [];
        for (var i = 0; i < scheduledEvents.length; i++) {
            var event_1 = scheduledEvents[i];
            var start = event_1.start;
            var end = isFiniteStreamEvent(event_1) ? event_1.end :
                undefined;
            var isBeingPlayed = eventsBeingPlayed.has(event_1);
            if (isBeingPlayed) {
                if (start > currentTime ||
                    (end !== undefined && currentTime >= end)) {
                    if (isFiniteStreamEvent(event_1)) {
                        eventsToExit.push(event_1.publicEvent);
                    }
                    eventsBeingPlayed.delete(event_1);
                }
            }
            else if (start <= currentTime &&
                end !== undefined &&
                currentTime < end) {
                eventsToSend.push({ type: "stream-event",
                    value: event_1.publicEvent });
                eventsBeingPlayed.set(event_1, true);
            }
            else if (previousTime < start &&
                currentTime >= (end !== null && end !== void 0 ? end : start)) {
                if (isSeeking) {
                    eventsToSend.push({ type: "stream-event-skip",
                        value: event_1.publicEvent });
                }
                else {
                    eventsToSend.push({ type: "stream-event",
                        value: event_1.publicEvent });
                    if (isFiniteStreamEvent(event_1)) {
                        eventsToExit.push(event_1.publicEvent);
                    }
                }
            }
        }
        return observableConcat(eventsToSend.length > 0 ? observableOf.apply(void 0, eventsToSend) :
            EMPTY, eventsToExit.length > 0 ? observableOf.apply(void 0, eventsToExit).pipe(tap(function (evt) {
            if (typeof evt.onExit === "function") {
                evt.onExit();
            }
        }), 
        // NOTE As of now (RxJS 7.4.0), RxJS defines `ignoreElements` default
        // first type parameter as `any` instead of the perfectly fine `unknown`,
        // leading to linter issues, as it forbids the usage of `any`.
        // This is why we're disabling the eslint rule.
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-argument */
        ignoreElements()) : EMPTY);
    }
    /**
     * This pipe allows to control wether the polling should occur, if there
     * are scheduledEvents, or not.
     */
    return scheduledEvents$.pipe(tap(function (scheduledEvents) { return lastScheduledEvents = scheduledEvents; }), map(function (evt) { return evt.length > 0; }), distinctUntilChanged(), switchMap(function (hasEvents) {
        if (!hasEvents) {
            return EMPTY;
        }
        return observableCombineLatest([
            interval(STREAM_EVENT_EMITTER_POLL_INTERVAL).pipe(startWith(null)),
            observation$,
        ]).pipe(map(function (_a) {
            var _ = _a[0], observation = _a[1];
            var seeking = observation.seeking;
            return { isSeeking: seeking,
                currentTime: mediaElement.currentTime };
        }), pairwise(), mergeMap(function (_a) {
            var oldObservation = _a[0], newObservation = _a[1];
            return emitStreamEvents$(lastScheduledEvents, oldObservation, newObservation);
        }));
    }));
}
export default streamEventsEmitter;
