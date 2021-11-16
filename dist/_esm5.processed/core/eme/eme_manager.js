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
import { catchError, concat as observableConcat, EMPTY, filter, ignoreElements, map, merge as observableMerge, mergeMap, of as observableOf, ReplaySubject, shareReplay, take, tap, throwError, } from "rxjs";
import { events, generateKeyRequest, getInitData, } from "../../compat/";
import config from "../../config";
import { EncryptedMediaError } from "../../errors";
import log from "../../log";
import areArraysOfNumbersEqual from "../../utils/are_arrays_of_numbers_equal";
import arrayIncludes from "../../utils/array_includes";
import assertUnreachable from "../../utils/assert_unreachable";
import { concat } from "../../utils/byte_parsing";
import filterMap from "../../utils/filter_map";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import cleanOldStoredPersistentInfo from "./clean_old_stored_persistent_info";
import getSession from "./get_session";
import initMediaKeys from "./init_media_keys";
import SessionEventsListener, { BlacklistedSessionError, } from "./session_events_listener";
import setServerCertificate from "./set_server_certificate";
import InitDataStore from "./utils/init_data_store";
var EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS = config.EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS, EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION = config.EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION;
var onEncrypted$ = events.onEncrypted$;
/**
 * EME abstraction used to communicate with the Content Decryption Module (or
 * CDM) to be able to decrypt contents.
 *
 * The `EMEManager` can be given one or multiple key systems. It will choose the
 * appropriate one depending on user settings and browser support.
 * @param {HTMLMediaElement} mediaElement - The MediaElement which will be
 * associated to a MediaKeys object
 * @param {Array.<Object>} keySystemsConfigs - key system configuration
 * @param {Observable} contentProtections$ - Observable emitting external
 * initialization data.
 * @returns {Observable}
 */
export default function EMEManager(mediaElement, keySystemsConfigs, contentProtections$) {
    log.debug("EME: Starting EMEManager logic.");
    /**
     * Keep track of all decryption keys handled by this instance of the
     * `EMEManager`.
     * This allows to avoid creating multiple MediaKeySessions handling the same
     * decryption keys.
     */
    var contentSessions = new InitDataStore();
    /**
     * Keep track of which initialization data have been blacklisted in the
     * current instance of the `EMEManager`.
     * If the same initialization data is encountered again, we can directly emit
     * the same `BlacklistedSessionError`.
     */
    var blacklistedInitData = new InitDataStore();
    /** Emit the MediaKeys instance and its related information when ready. */
    var mediaKeysInit$ = initMediaKeys(mediaElement, keySystemsConfigs)
        .pipe(mergeMap(function (mediaKeysEvt) {
        if (mediaKeysEvt.type !== "attached-media-keys") {
            return observableOf(mediaKeysEvt);
        }
        var _a = mediaKeysEvt.value, mediaKeys = _a.mediaKeys, options = _a.options;
        var serverCertificate = options.serverCertificate;
        if (isNullOrUndefined(serverCertificate)) {
            return observableOf(mediaKeysEvt);
        }
        return observableConcat(setServerCertificate(mediaKeys, serverCertificate), observableOf(mediaKeysEvt));
    }), shareReplay()); // Share side-effects and cache success
    /** Emit when the MediaKeys instance has been attached the HTMLMediaElement. */
    var attachedMediaKeys$ = mediaKeysInit$.pipe(filter(function (evt) {
        return evt.type === "attached-media-keys";
    }), take(1));
    /** Parsed `encrypted` events coming from the HTMLMediaElement. */
    var mediaEncryptedEvents$ = onEncrypted$(mediaElement).pipe(tap(function (evt) {
        log.debug("EME: Encrypted event received from media element.", evt);
    }), filterMap(function (evt) { return getInitData(evt); }, null), shareReplay({ refCount: true })); // multiple Observables listen to that one
    // as soon as the EMEManager is subscribed
    /** Encryption events coming from the `contentProtections$` argument. */
    var externalEvents$ = contentProtections$.pipe(tap(function (evt) { log.debug("EME: Encrypted event received from Player", evt); }));
    /** Emit events signaling that an encryption initialization data is encountered. */
    var initializationData$ = observableMerge(externalEvents$, mediaEncryptedEvents$);
    /** Create MediaKeySessions and handle the corresponding events. */
    var bindSession$ = initializationData$.pipe(
    // Add attached MediaKeys info once available
    mergeMap(function (initializationData) { return attachedMediaKeys$.pipe(map(function (mediaKeysEvt) {
        return [initializationData, mediaKeysEvt];
    })); }), 
    /* Attach server certificate and create/reuse MediaKeySession */
    mergeMap(function (_a) {
        var initializationData = _a[0], mediaKeysEvent = _a[1];
        var _b = mediaKeysEvent.value, mediaKeySystemAccess = _b.mediaKeySystemAccess, stores = _b.stores, options = _b.options;
        var blacklistError = blacklistedInitData.get(initializationData);
        if (blacklistError !== undefined) {
            if (initializationData.type === undefined) {
                log.error("EME: The current session has already been blacklisted " +
                    "but the current content is not known. Throwing.");
                var sessionError_1 = blacklistError.sessionError;
                sessionError_1.fatal = true;
                return throwError(function () { return sessionError_1; });
            }
            log.warn("EME: The current session has already been blacklisted. " +
                "Blacklisting content.");
            return observableOf({ type: "blacklist-protection-data",
                value: initializationData });
        }
        var lastKeyUpdate$ = new ReplaySubject(1);
        // First, check that this initialization data is not already handled
        if (options.singleLicensePer === "content" && !contentSessions.isEmpty()) {
            var keyIds_1 = initializationData.keyIds;
            if (keyIds_1 === undefined) {
                log.warn("EME: Initialization data linked to unknown key id, we'll " +
                    "not able to fallback from it.");
                return observableOf({ type: "init-data-ignored",
                    value: { initializationData: initializationData } });
            }
            var firstSession_1 = contentSessions.getAll()[0];
            return firstSession_1.lastKeyUpdate$.pipe(mergeMap(function (evt) {
                var hasAllNeededKeyIds = keyIds_1.every(function (keyId) {
                    for (var i = 0; i < evt.whitelistedKeyIds.length; i++) {
                        if (areArraysOfNumbersEqual(evt.whitelistedKeyIds[i], keyId)) {
                            return true;
                        }
                    }
                });
                if (!hasAllNeededKeyIds) {
                    // Not all keys are available in the current session, blacklist those
                    return observableOf({ type: "keys-update",
                        value: { blacklistedKeyIDs: keyIds_1,
                            whitelistedKeyIds: [] } });
                }
                // Already handled by the current session.
                // Move corresponding session on top of the cache if it exists
                var loadedSessionsStore = mediaKeysEvent.value.stores.loadedSessionsStore;
                loadedSessionsStore.reuse(firstSession_1.initializationData);
                return observableOf({ type: "init-data-ignored",
                    value: { initializationData: initializationData } });
            }));
        }
        else if (!contentSessions.storeIfNone(initializationData, { initializationData: initializationData, lastKeyUpdate$: lastKeyUpdate$ })) {
            log.debug("EME: Init data already received. Skipping it.");
            return observableOf({ type: "init-data-ignored",
                value: { initializationData: initializationData } });
        }
        var wantedSessionType;
        if (options.persistentLicense !== true) {
            wantedSessionType = "temporary";
        }
        else if (!canCreatePersistentSession(mediaKeySystemAccess)) {
            log.warn("EME: Cannot create \"persistent-license\" session: not supported");
            wantedSessionType = "temporary";
        }
        else {
            wantedSessionType = "persistent-license";
        }
        var maxSessionCacheSize = typeof options.maxSessionCacheSize === "number" ?
            options.maxSessionCacheSize :
            EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS;
        return getSession(initializationData, stores, wantedSessionType, maxSessionCacheSize)
            .pipe(mergeMap(function (sessionEvt) {
            switch (sessionEvt.type) {
                case "cleaning-old-session":
                    contentSessions.remove(sessionEvt.value.initializationData);
                    return EMPTY;
                case "cleaned-old-session":
                    return EMPTY;
                case "created-session":
                case "loaded-open-session":
                case "loaded-persistent-session":
                    // Do nothing, just to check every possibility is taken
                    break;
                default: // Use TypeScript to check if all possibilities have been checked
                    assertUnreachable(sessionEvt);
            }
            var _a = sessionEvt.value, mediaKeySession = _a.mediaKeySession, sessionType = _a.sessionType;
            /**
             * We only store persistent sessions once its keys are known.
             * This boolean allows to know if this session has already been
             * persisted or not.
             */
            var isSessionPersisted = false;
            // `generateKeyRequest` awaits a single Uint8Array containing all
            // initialization data.
            var concatInitData = concat.apply(void 0, initializationData.values.map(function (i) { return i.data; }));
            var generateRequest$ = sessionEvt.type !== "created-session" ?
                EMPTY :
                generateKeyRequest(mediaKeySession, initializationData.type, concatInitData).pipe(catchError(function (error) {
                    throw new EncryptedMediaError("KEY_GENERATE_REQUEST_ERROR", error instanceof Error ? error.toString() :
                        "Unknown error");
                }), ignoreElements());
            return observableMerge(SessionEventsListener(mediaKeySession, options, mediaKeySystemAccess.keySystem, initializationData), generateRequest$)
                .pipe(map(function (evt) {
                var _a;
                if (evt.type !== "keys-update") {
                    return evt;
                }
                // We want to add the current key ids in the blacklist if it is
                // not already there.
                //
                // We only do that when `singleLicensePer` is set to something
                // else than the default `"init-data"` because this logic:
                //   1. might result in a quality fallback, which is a v3.x.x
                //      breaking change if some APIs (like `singleLicensePer`)
                //      aren't used.
                //   2. Rely on the EME spec regarding key statuses being well
                //      implemented on all supported devices, which we're not
                //      sure yet. Because in any other `singleLicensePer`, we
                //      need a good implementation anyway, it doesn't matter
                //      there.
                var expectedKeyIds = initializationData.keyIds;
                if (expectedKeyIds !== undefined &&
                    options.singleLicensePer !== "init-data") {
                    var missingKeyIds = expectedKeyIds.filter(function (expected) {
                        return (!evt.value.whitelistedKeyIds.some(function (whitelisted) {
                            return areArraysOfNumbersEqual(whitelisted, expected);
                        }) &&
                            !evt.value.blacklistedKeyIDs.some(function (blacklisted) {
                                return areArraysOfNumbersEqual(blacklisted, expected);
                            }));
                    });
                    if (missingKeyIds.length > 0) {
                        (_a = evt.value.blacklistedKeyIDs).push.apply(_a, missingKeyIds);
                    }
                }
                lastKeyUpdate$.next(evt.value);
                if ((evt.value.whitelistedKeyIds.length === 0 &&
                    evt.value.blacklistedKeyIDs.length === 0) ||
                    sessionType === "temporary" ||
                    stores.persistentSessionsStore === null ||
                    isSessionPersisted) {
                    return evt;
                }
                var persistentSessionsStore = stores.persistentSessionsStore;
                cleanOldStoredPersistentInfo(persistentSessionsStore, EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION - 1);
                persistentSessionsStore.add(initializationData, mediaKeySession);
                isSessionPersisted = true;
                return evt;
            }), catchError(function (err) {
                if (!(err instanceof BlacklistedSessionError)) {
                    throw err;
                }
                blacklistedInitData.store(initializationData, err);
                var sessionError = err.sessionError;
                if (initializationData.type === undefined) {
                    log.error("EME: Current session blacklisted and content not known. " +
                        "Throwing.");
                    sessionError.fatal = true;
                    throw sessionError;
                }
                log.warn("EME: Current session blacklisted. Blacklisting content.");
                return observableOf({ type: "warning",
                    value: sessionError }, { type: "blacklist-protection-data",
                    value: initializationData });
            }));
        }));
    }));
    return observableMerge(mediaKeysInit$, mediaEncryptedEvents$
        .pipe(map(function (evt) { return ({ type: "encrypted-event-received",
        value: evt }); })), bindSession$);
}
/**
 * Returns `true` if the given MediaKeySystemAccess can create
 * "persistent-license" MediaKeySessions.
 * @param {MediaKeySystemAccess} mediaKeySystemAccess
 * @returns {Boolean}
 */
function canCreatePersistentSession(mediaKeySystemAccess) {
    var sessionTypes = mediaKeySystemAccess.getConfiguration().sessionTypes;
    return sessionTypes !== undefined &&
        arrayIncludes(sessionTypes, "persistent-license");
}
