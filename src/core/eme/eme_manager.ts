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
  catchError,
  concat as observableConcat,
  EMPTY,
  filter,
  ignoreElements,
  map,
  mapTo,
  merge as observableMerge,
  mergeMap,
  Observable,
  of as observableOf,
  shareReplay,
  take,
  tap,
} from "rxjs";
import {
  events,
  generateKeyRequest,
  getInitData,
  ICustomMediaKeySystemAccess,
} from "../../compat/";
import config from "../../config";
import { EncryptedMediaError } from "../../errors";
import log from "../../log";
import areArraysOfNumbersEqual from "../../utils/are_arrays_of_numbers_equal";
import arrayFind from "../../utils/array_find";
import arrayIncludes from "../../utils/array_includes";
import assertUnreachable from "../../utils/assert_unreachable";
import { concat } from "../../utils/byte_parsing";
import filterMap from "../../utils/filter_map";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import createSharedReference from "../../utils/reference";
import cleanOldStoredPersistentInfo from "./clean_old_stored_persistent_info";
import createOrLoadSession from "./get_session";
import initMediaKeys from "./init_media_keys";
import SessionEventsListener, {
  BlacklistedSessionError,
} from "./session_events_listener";
import setServerCertificate from "./set_server_certificate";
import {
  IAttachedMediaKeysEvent,
  IContentProtection,
  ICreatedMediaKeysEvent,
  IEMEManagerEvent,
  IEMEWarningEvent,
  IInitializationDataInfo,
  IKeySystemOption,
  MediaKeySessionLoadingType,
} from "./types";
import KeySessionRecord, {
  areAllKeyIdContainedIn,
  areSomeKeyIdContainedIn,
} from "./utils/processed_init_data_record";

const { EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS,
        EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION } = config;
const { onEncrypted$ } = events;

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
export default function EMEManager(
  mediaElement : HTMLMediaElement,
  keySystemsConfigs: IKeySystemOption[],
  contentProtections$ : Observable<IContentProtection>
) : Observable<IEMEManagerEvent> {
  log.debug("EME: Starting EMEManager logic.");

  /**
   * Contains information linked to initialization data processed for the
   * current content.
   * Allows to prevent unnecessary initialization data processing (e.g. avoid
   * unneeded license requests, unnecessary CDM negociations etc.).
   */
  // XXX TODO

  /**
   * Contains information about all key sessions loaded for this current
   * content.
   * This object is most notably used to check which keys are already obtained,
   * thus avoiding to perform new unnecessary license requests and CDM interactions.
   */
  const currentSessions : IActiveSessionInfo[] = [];

  /**
   * When `true`, wait before processing newly-received initialization data.
   *
   * In certain cases where licenses might contain multiple keys, we might want
   * to avoid loading multiple licenses with keys in common. Using this lock to
   * prevent multiple parallel license requests allows to prevent that situation
   * from happening.
   * TODO this way of doing-it is very error-prone for now. A more readable
   * solution has to be found.
   */
  const initDataLock = createSharedReference<boolean>(false);

  /** Emit the MediaKeys instance and its related information when ready. */
  const mediaKeysInit$ = initMediaKeysAndSetServerCertificate(mediaElement,
                                                              keySystemsConfigs)
    .pipe(shareReplay()); // Share side-effects and cache success}

  /** Emit when the MediaKeys instance has been attached the HTMLMediaElement. */
  const attachedMediaKeys$ : Observable<IAttachedMediaKeysEvent> = mediaKeysInit$.pipe(
    filter((e) : e is IAttachedMediaKeysEvent => e.type === "attached-media-keys"),
    take(1));

  /** Parsed `encrypted` events coming from the HTMLMediaElement. */
  const mediaEncryptedEvents$ = onEncrypted$(mediaElement).pipe(
    tap((evt) => {
      log.debug("EME: Encrypted event received from media element.", evt);
    }),
    filterMap<MediaEncryptedEvent, IInitializationDataInfo, null>(
      (evt) => getInitData(evt), null));

  /** Encryption events coming from the `contentProtections$` argument. */
  const externalEvents$ = contentProtections$.pipe(
    tap((evt) => { log.debug("EME: Encrypted event received from Player", evt); }));

  /** Emit events signaling that an encryption initialization data is encountered. */
  const initializationData$ = observableMerge(externalEvents$, mediaEncryptedEvents$)
    .pipe(mergeMap((val => {
      return initDataLock.asObservable().pipe(
        filter(isLocked => !isLocked),
        take(1),
        mapTo(val));
    })));

  /** Create MediaKeySessions and handle the corresponding events. */
  const bindSession$ = initializationData$.pipe(

    // Add MediaKeys info once available
    mergeMap((initializationData) => attachedMediaKeys$.pipe(
      map((mediaKeysEvt) : [IInitializationDataInfo, IAttachedMediaKeysEvent] =>
        [ initializationData, mediaKeysEvt ]))),

    mergeMap(([initializationData, mediaKeysEvent]) => {
      /**
       * If set, a currently-used key session is already compatible to this
       * initialization data.
       */
      const compatibleSessionInfo = arrayFind(currentSessions, (x) => {
        return x.record.isCompatibleWith(initializationData);
      });

      const { mediaKeySystemAccess, stores, options } = mediaKeysEvent.value;
      const { loadedSessionsStore } = mediaKeysEvent.value.stores;

      if (compatibleSessionInfo !== undefined) {
        // Check if the compatible session is blacklisted
        const blacklistedSessionError = compatibleSessionInfo.blacklistedSessionError;
        if (!isNullOrUndefined(blacklistedSessionError)) {
          if (initializationData.type === undefined ||
              initializationData.content === undefined)
          {
            log.error("EME: This initialization data has already been blacklisted " +
                      "but the current content is not known.");
            return EMPTY;
          } else {
            log.info("EME: This initialization data has already been blacklisted. " +
                     "Blacklisting the related content.");
            const { manifest } = initializationData.content;
            manifest.addUndecipherableProtectionData(initializationData);
            return EMPTY;
          }
        }

        // Check if the current key id(s) has been blacklisted by this session
        if (compatibleSessionInfo.keyStatuses !== undefined &&
            initializationData.keyIds !== undefined)
        {
          /**
           * If set to `true`, the Representation(s) linked to this
           * initialization data's key id should be marked as "not decipherable".
           */
          let isUndecipherable;

          if (options.singleLicensePer === "init-data") {
            // Note: In the default "init-data" mode, we only avoid a
            // Representation if the key id was originally explicitely
            // blacklisted (and not e.g. if its key was just not present in
            // the license).
            //
            // This is to enforce v3.x.x retro-compatibility: we cannot
            // fallback from a Representation unless some RxPlayer option
            // documentating this behavior has been set.
            const { blacklisted } = compatibleSessionInfo.keyStatuses;
            isUndecipherable = areSomeKeyIdContainedIn(initializationData.keyIds,
                                                       blacklisted);
          } else {
            // In any other mode, as soon as not all of this initialization
            // data's linked key ids are explicitely whitelisted, we can mark
            // the corresponding Representation as "not decipherable".
            // This is because we've no such retro-compatibility guarantee to
            // make there.
            const { whitelisted } = compatibleSessionInfo.keyStatuses;
            isUndecipherable = !areAllKeyIdContainedIn(initializationData.keyIds,
                                                       whitelisted);
          }

          if (isUndecipherable) {
            if (initializationData.content === undefined) {
              log.error("EME: Cannot forbid key id, the content is unknown.");
              return EMPTY;
            }
            log.info("EME: Current initialization data is linked to blacklisted keys. " +
                     "Marking Representations as not decipherable");
            initializationData.content.manifest.updateDeciperabilitiesBasedOnKeyIds({
              blacklistedKeyIDs: initializationData.keyIds,
              whitelistedKeyIds: [],
            });
            return EMPTY;
          }
        }

        // If we reached here, it means that this initialization data is not
        // blacklisted in any way.
        // Search loaded session and put it on top of the cache if it exists.
        const entry = loadedSessionsStore.reuse(initializationData);
        if (entry !== null) {
          log.debug("EME: Init data already processed. Skipping it.");
          return EMPTY;
        }

        // Session not found in `loadedSessionsStore`, it might have been closed
        // since.
        // Remove from `currentSessions` and start again.
        const indexOf = currentSessions.indexOf(compatibleSessionInfo);
        if (indexOf === -1) {
          log.error("EME: Unable to remove processed init data: not found.");
        } else {
          log.debug("EME: A session from a processed init data is not available " +
                    "anymore. Re-processing it.");
          currentSessions.splice(indexOf, 1);
        }
      }

      // If we reached here, we did not handle this initialization data yet for
      // the current content.

      if (options.singleLicensePer === "content") {
        const firstCreatedSession = arrayFind(currentSessions, (x) =>
          x.source === "created-session");

        if (firstCreatedSession !== undefined) {
          // We already fetched a `singleLicensePer: "content"` license, yet the
          // current initialization data was not yet handled.
          // It means that we'll never handle it and we should thus blacklist it.

          const keyIds = initializationData.keyIds;
          if (keyIds === undefined) {
            log.warn("EME: Initialization data linked to unknown key id, we'll " +
              "not able to fallback from it.");
            return EMPTY;
          }

          firstCreatedSession.record.associateKeyIds(keyIds);
          if (initializationData.content !== undefined) {
            initializationData.content.manifest
              .updateDeciperabilitiesBasedOnKeyIds({ blacklistedKeyIDs: keyIds,
                                                     whitelistedKeyIds: [] });
          }
          return EMPTY;
        }
      }

      // Because we typically only want to create a single new session in a
      // `singleLicensePer: "content"` mode, we will temprarily lock new
      // initialization data from being processed while we're still
      // processing that one.
      // XXX TODO
      initDataLock.setValue(true);

      let wantedSessionType : MediaKeySessionType;
      if (options.persistentLicense !== true) {
        wantedSessionType = "temporary";
      } else if (!canCreatePersistentSession(mediaKeySystemAccess)) {
        log.warn("EME: Cannot create \"persistent-license\" session: not supported");
        wantedSessionType = "temporary";
      } else {
        wantedSessionType = "persistent-license";
      }

      const maxSessionCacheSize = typeof options.maxSessionCacheSize === "number" ?
        options.maxSessionCacheSize :
        EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS;
      return createOrLoadSession(initializationData,
                                 stores,
                                 wantedSessionType,
                                 maxSessionCacheSize)
        .pipe(mergeMap((sessionEvt) =>  {
          // Trick to use TypeScript to explicitely check all possible event types
          switch (sessionEvt.type) {
            case MediaKeySessionLoadingType.Created:
            case MediaKeySessionLoadingType.LoadedOpenSession:
            case MediaKeySessionLoadingType.LoadedPersistentSession:
              break;
            default:
              assertUnreachable(sessionEvt);
          }

          const sessionInfo : IActiveSessionInfo = {
            record: sessionEvt.value.keySessionRecord,
            source: sessionEvt.type,
            keyStatuses: undefined,
            blacklistedSessionError: null,
          };
          currentSessions.push(sessionInfo);

          if (options.singleLicensePer === "init-data") {
            initDataLock.setValue(false);
          }

          let generateRequest$ = EMPTY;
          if (sessionEvt.type === "created-session") {
            // `generateKeyRequest` awaits a single Uint8Array containing all
            // initialization data.
            const concatInitData =
              concat(...initializationData.values.map(i => i.data));
            generateRequest$ = generateKeyRequest(sessionEvt.value.mediaKeySession,
                                                  initializationData.type,
                                                  concatInitData).pipe(
              catchError((error: unknown) => {
                throw new EncryptedMediaError(
                  "KEY_GENERATE_REQUEST_ERROR",
                  error instanceof Error ? error.toString() :
                  "Unknown error");
              }),
              ignoreElements());
          }

          const { mediaKeySession,
                  sessionType } = sessionEvt.value;

          /**
           * We only store persistent sessions once its keys are known.
           * This boolean allows to know if this session has already been
           * persisted or not.
           */
          let isSessionPersisted = false;

          return observableMerge(SessionEventsListener(mediaKeySession,
                                                       options,
                                                       mediaKeySystemAccess.keySystem,
                                                       initializationData),
                                 generateRequest$)
            .pipe(
              mergeMap(function onSessionEvent(evt) {
                if (evt.type !== "keys-update") {
                  return observableOf(evt);
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
                const expectedKeyIds = initializationData.keyIds;
                if (expectedKeyIds !== undefined &&
                    options.singleLicensePer !== "init-data")
                {
                  const missingKeyIds = expectedKeyIds.filter(expected => {
                    return (
                      !evt.value.whitelistedKeyIds.some(whitelisted =>
                        areArraysOfNumbersEqual(whitelisted, expected)) &&
                      !evt.value.blacklistedKeyIDs.some(blacklisted =>
                        areArraysOfNumbersEqual(blacklisted, expected))
                    );
                  });
                  if (missingKeyIds.length > 0) {
                    evt.value.blacklistedKeyIDs.push(...missingKeyIds) ;
                  }
                }

                const allKeyStatuses = [...evt.value.whitelistedKeyIds,
                                        ...evt.value.blacklistedKeyIDs];
                sessionInfo.record.associateKeyIds(allKeyStatuses);
                sessionInfo.keyStatuses = {
                  whitelisted: evt.value.whitelistedKeyIds,
                  blacklisted: evt.value.blacklistedKeyIDs,
                };

                if ((evt.value.whitelistedKeyIds.length !== 0 ||
                     evt.value.blacklistedKeyIDs.length !== 0) &&
                    sessionType === "persistent-license" &&
                    stores.persistentSessionsStore !== null &&
                    isSessionPersisted)
                {
                  const { persistentSessionsStore } = stores;
                  cleanOldStoredPersistentInfo(
                    persistentSessionsStore,
                    EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION - 1);
                  persistentSessionsStore.add(sessionInfo.record, mediaKeySession);
                  isSessionPersisted = true;
                }
                if (initializationData.content !== undefined) {
                  initializationData.content.manifest
                    .updateDeciperabilitiesBasedOnKeyIds(evt.value);
                }

                // Now that key ids update have been processed, we can remove
                // the lock if it was active.
                initDataLock.setValue(false);
                return EMPTY;
              }),

              catchError(function onSessionError(err) {
                if (!(err instanceof BlacklistedSessionError)) {
                  initDataLock.setValue(false);
                  throw err;
                }

                sessionInfo.blacklistedSessionError = err;

                const { sessionError } = err;
                if (initializationData.type === undefined) {
                  log.error("EME: Current session blacklisted and content not known. " +
                            "Throwing.");
                  sessionError.fatal = true;
                  throw sessionError;
                }

                log.warn("EME: Current session blacklisted. Blacklisting content.");
                if (initializationData.content !== undefined) {
                  const { manifest } = initializationData.content;
                  log.info("Init: blacklisting Representations based on " +
                           "protection data.");
                  manifest.addUndecipherableProtectionData(initializationData);
                }

                initDataLock.setValue(false);
                return observableOf({ type: "warning" as const,
                                      value: sessionError });
              }));
        }));
    }));

  return observableMerge(mediaKeysInit$, bindSession$);
}

/**
 * Returns `true` if the given MediaKeySystemAccess can create
 * "persistent-license" MediaKeySessions.
 * @param {MediaKeySystemAccess} mediaKeySystemAccess
 * @returns {Boolean}
 */
function canCreatePersistentSession(
  mediaKeySystemAccess : MediaKeySystemAccess | ICustomMediaKeySystemAccess
) : boolean {
  const { sessionTypes } = mediaKeySystemAccess.getConfiguration();
  return sessionTypes !== undefined &&
         arrayIncludes(sessionTypes, "persistent-license");
}

/**
 * @param {HTMLMediaElement} mediaElement - The MediaElement which will be
 * associated to a MediaKeys object
 * @param {Array.<Object>} keySystemsConfigs - key system configuration
 * @returns {Observable}
 */
function initMediaKeysAndSetServerCertificate(
  mediaElement : HTMLMediaElement,
  keySystemsConfigs: IKeySystemOption[]
) : Observable<IEMEWarningEvent | IAttachedMediaKeysEvent | ICreatedMediaKeysEvent> {
  return initMediaKeys(mediaElement, keySystemsConfigs).pipe(mergeMap((mediaKeysEvt) => {
    if (mediaKeysEvt.type !== "attached-media-keys") {
      return observableOf(mediaKeysEvt);
    }
    const { mediaKeys, options } = mediaKeysEvt.value;
    const { serverCertificate } = options;
    if (isNullOrUndefined(serverCertificate)) {
      return observableOf(mediaKeysEvt);
    }
    return observableConcat(setServerCertificate(mediaKeys, serverCertificate),
                            observableOf(mediaKeysEvt));
  }));
}

// /**
//  * Data relative to encryption initialization data already handled for the
//  * current content.
//  */
// interface IProcessedDataItem {
//   /**
//    * Linked KeySessionRecord.
//    * Allows to check for compatibility with future incoming initialization
//    * data.
//    */
//   // XXX TODO
//   initData : IInitializationDataInfo;

//   sessionInfo : null | IActiveSessionInfo;
// }

interface IActiveSessionInfo {
  record : KeySessionRecord;

  keyStatuses : undefined | {
    whitelisted : Uint8Array[];
    blacklisted : Uint8Array[];
  };

  /** Source of the MediaKeySession linked to that record. */
  source : MediaKeySessionLoadingType;

  /**
   * If different than `null`, all initialization data compatible with this
   * processed initialization data has been blacklisted with this corresponding
   * error.
   */
  blacklistedSessionError : BlacklistedSessionError | null;
}
