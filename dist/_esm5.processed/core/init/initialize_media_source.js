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
import { combineLatest as observableCombineLatest, filter, finalize, ignoreElements, map, merge as observableMerge, mergeMap, of as observableOf, share, shareReplay, startWith, Subject, switchMap, take, takeUntil, } from "rxjs";
import { shouldReloadMediaSourceOnDecipherabilityUpdate } from "../../compat";
import config from "../../config";
import log from "../../log";
import deferSubscriptions from "../../utils/defer_subscriptions";
import { fromEvent } from "../../utils/event_emitter";
import filterMap from "../../utils/filter_map";
import objectAssign from "../../utils/object_assign";
import ABRManager from "../abr";
import { getCurrentKeySystem, } from "../decrypt";
import openMediaSource from "./create_media_source";
import EVENTS from "./events_generators";
import getInitialTime from "./get_initial_time";
import linkDrmAndContent from "./link_drm_and_content";
import createMediaSourceLoader from "./load_on_media_source";
import manifestUpdateScheduler from "./manifest_update_scheduler";
import throwOnMediaError from "./throw_on_media_error";
/**
 * Begin content playback.
 *
 * Returns an Observable emitting notifications about the content lifecycle.
 * On subscription, it will perform every necessary tasks so the content can
 * play. Among them:
 *
 *   - Creates a MediaSource on the given `mediaElement` and attach to it the
 *     necessary SourceBuffer instances.
 *
 *   - download the content's Manifest and handle its refresh logic
 *
 *   - Perform decryption if needed
 *
 *   - ask for the choice of the wanted Adaptation through events (e.g. to
 *     choose a language)
 *
 *   - requests and push the right segments (according to the Adaptation choice,
 *     the current position, the network conditions etc.)
 *
 * This Observable will throw in the case where a fatal error (i.e. which has
 * stopped content playback) is encountered, with the corresponding error as a
 * payload.
 *
 * This Observable will never complete, it will always run until it is
 * unsubscribed from.
 * Unsubscription will stop playback and reset the corresponding state.
 *
 * @param {Object} args
 * @returns {Observable}
 */
export default function InitializeOnMediaSource(_a) {
    var adaptiveOptions = _a.adaptiveOptions, autoPlay = _a.autoPlay, bufferOptions = _a.bufferOptions, keySystems = _a.keySystems, lowLatencyMode = _a.lowLatencyMode, manifest$ = _a.manifest$, manifestFetcher = _a.manifestFetcher, mediaElement = _a.mediaElement, minimumManifestUpdateInterval = _a.minimumManifestUpdateInterval, playbackObserver = _a.playbackObserver, segmentFetcherCreator = _a.segmentFetcherCreator, speed = _a.speed, startAt = _a.startAt, textTrackOptions = _a.textTrackOptions;
    /** Choose the right "Representation" for a given "Adaptation". */
    var abrManager = new ABRManager(adaptiveOptions);
    /**
     * Create and open a new MediaSource object on the given media element on
     * subscription.
     * Multiple concurrent subscriptions on this Observable will obtain the same
     * created MediaSource.
     * The MediaSource will be closed when subscriptions are down to 0.
     */
    var openMediaSource$ = openMediaSource(mediaElement).pipe(shareReplay({ refCount: true }));
    /** Send content protection initialization data. */
    var protectedSegments$ = new Subject();
    /** Initialize decryption capabilities and MediaSource. */
    var drmEvents$ = linkDrmAndContent(mediaElement, keySystems, protectedSegments$, openMediaSource$)
        .pipe(
    // Because multiple Observables here depend on this Observable as a source,
    // we prefer deferring Subscription until those Observables are themselves
    // all subscribed to.
    // This is needed because `drmEvents$` might send events synchronously
    // on subscription. In that case, it might communicate those events directly
    // after the first Subscription is done, making the next subscription miss
    // out on those events, even if that second subscription is done
    // synchronously after the first one.
    // By calling `deferSubscriptions`, we ensure that subscription to
    // `drmEvents$` effectively starts after a very short delay, thus
    // ensuring that no such race condition can occur.
    deferSubscriptions(), share());
    /**
     * Translate errors coming from the media element into RxPlayer errors
     * through a throwing Observable.
     */
    var mediaError$ = throwOnMediaError(mediaElement);
    var mediaSourceReady$ = drmEvents$.pipe(filter(function (evt) {
        return evt.type === "decryption-ready" || evt.type === "decryption-disabled";
    }), map(function (e) { return e.value; }), take(1));
    /** Load and play the content asked. */
    var loadContent$ = observableCombineLatest([manifest$, mediaSourceReady$]).pipe(mergeMap(function (_a) {
        var manifestEvt = _a[0], _b = _a[1], drmSystemId = _b.drmSystemId, initialMediaSource = _b.mediaSource;
        if (manifestEvt.type === "warning") {
            return observableOf(manifestEvt);
        }
        var manifest = manifestEvt.manifest;
        log.debug("Init: Calculating initial time");
        var initialTime = getInitialTime(manifest, lowLatencyMode, startAt);
        log.debug("Init: Initial time calculated:", initialTime);
        var mediaSourceLoader = createMediaSourceLoader({
            abrManager: abrManager,
            bufferOptions: objectAssign({ textTrackOptions: textTrackOptions, drmSystemId: drmSystemId }, bufferOptions),
            manifest: manifest,
            mediaElement: mediaElement,
            playbackObserver: playbackObserver,
            segmentFetcherCreator: segmentFetcherCreator,
            speed: speed,
        });
        // handle initial load and reloads
        var recursiveLoad$ = recursivelyLoadOnMediaSource(initialMediaSource, initialTime, autoPlay);
        // Emit when we want to manually update the manifest.
        var scheduleRefresh$ = new Subject();
        var manifestUpdate$ = manifestUpdateScheduler({ initialManifest: manifestEvt, manifestFetcher: manifestFetcher, minimumManifestUpdateInterval: minimumManifestUpdateInterval, scheduleRefresh$: scheduleRefresh$ });
        var manifestEvents$ = observableMerge(fromEvent(manifest, "manifestUpdate")
            .pipe(map(function () { return EVENTS.manifestUpdate(); })), fromEvent(manifest, "decipherabilityUpdate")
            .pipe(map(EVENTS.decipherabilityUpdate)));
        return observableMerge(manifestEvents$, manifestUpdate$, recursiveLoad$)
            .pipe(startWith(EVENTS.manifestReady(manifest)), finalize(function () { scheduleRefresh$.complete(); }));
        /**
         * Load the content defined by the Manifest in the mediaSource given at the
         * given position and playing status.
         * This function recursively re-call itself when a MediaSource reload is
         * wanted.
         * @param {MediaSource} mediaSource
         * @param {number} startingPos
         * @param {boolean} shouldPlay
         * @returns {Observable}
         */
        function recursivelyLoadOnMediaSource(mediaSource, startingPos, shouldPlay) {
            var reloadMediaSource$ = new Subject();
            var mediaSourceLoader$ = mediaSourceLoader(mediaSource, startingPos, shouldPlay)
                .pipe(filterMap(function (evt) {
                switch (evt.type) {
                    case "needs-manifest-refresh":
                        scheduleRefresh$.next({ completeRefresh: false,
                            canUseUnsafeMode: true });
                        return null;
                    case "manifest-might-be-out-of-sync":
                        var OUT_OF_SYNC_MANIFEST_REFRESH_DELAY = config.getCurrent().OUT_OF_SYNC_MANIFEST_REFRESH_DELAY;
                        scheduleRefresh$.next({
                            completeRefresh: true,
                            canUseUnsafeMode: false,
                            delay: OUT_OF_SYNC_MANIFEST_REFRESH_DELAY,
                        });
                        return null;
                    case "needs-media-source-reload":
                        reloadMediaSource$.next(evt.value);
                        return null;
                    case "needs-decipherability-flush":
                        var keySystem = getCurrentKeySystem(mediaElement);
                        if (shouldReloadMediaSourceOnDecipherabilityUpdate(keySystem)) {
                            reloadMediaSource$.next(evt.value);
                            return null;
                        }
                        // simple seek close to the current position
                        // to flush the buffers
                        var position = evt.value.position;
                        if (position + 0.001 < evt.value.duration) {
                            playbackObserver.setCurrentTime(mediaElement.currentTime + 0.001);
                        }
                        else {
                            playbackObserver.setCurrentTime(position);
                        }
                        return null;
                    case "encryption-data-encountered":
                        protectedSegments$.next(evt.value);
                        return null;
                    case "needs-buffer-flush":
                        playbackObserver.setCurrentTime(mediaElement.currentTime + 0.001);
                        return null;
                }
                return evt;
            }, null));
            var currentLoad$ = mediaSourceLoader$.pipe(takeUntil(reloadMediaSource$));
            var handleReloads$ = reloadMediaSource$.pipe(switchMap(function (reloadOrder) {
                return openMediaSource(mediaElement).pipe(mergeMap(function (newMS) { return recursivelyLoadOnMediaSource(newMS, reloadOrder.position, reloadOrder.autoPlay); }), startWith(EVENTS.reloadingMediaSource()));
            }));
            return observableMerge(handleReloads$, currentLoad$);
        }
    }));
    return observableMerge(loadContent$, mediaError$, drmEvents$.pipe(ignoreElements()));
}
