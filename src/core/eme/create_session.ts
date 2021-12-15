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
  defer as observableDefer,
  map,
  mergeMap,
  Observable,
  of as observableOf,
} from "rxjs";
import {
  ICustomMediaKeySession,
  loadSession,
} from "../../compat";
import log from "../../log";
import {
  IInitializationDataInfo,
  IMediaKeySessionStores,
  MediaKeySessionLoadingType,
} from "./types";
import isSessionUsable from "./utils/is_session_usable";
import LoadedSessionsStore from "./utils/loaded_sessions_store";
import PersistentSessionsStore from "./utils/persistent_sessions_store";
import KeySessionRecord from "./utils/processed_init_data_record";

/**
 * Create a new Session or load a persistent one on the given MediaKeys,
 * according to wanted settings and what is currently stored.
 *
 * If session creating fails, remove the oldest MediaKeySession loaded and
 * retry.
 * /!\ This only creates new sessions.
 * It will fail if loadedSessionsStore already has a MediaKeySession with
 * the given initData.
 * @param {Object} stores
 * @param {Object} initData
 * @param {string} wantedSessionType
 * @returns {Observable}
 */
export default function createSession(
  stores : IMediaKeySessionStores,
  initData : IInitializationDataInfo,
  wantedSessionType : MediaKeySessionType
) : Observable<ICreateSessionEvent> {
  return observableDefer(() => {
    const { loadedSessionsStore,
            persistentSessionsStore } = stores;

    if (wantedSessionType === "temporary") {
      return createTemporarySession(loadedSessionsStore, initData);
    } else if (persistentSessionsStore === null) {
      log.warn("EME: Cannot create persistent MediaKeySession, " +
               "PersistentSessionsStore not created.");
      return createTemporarySession(loadedSessionsStore, initData);
    }
    return createAndTryToRetrievePersistentSession(loadedSessionsStore,
                                                   persistentSessionsStore,
                                                   initData);
  });
}

/**
 * Create a new temporary MediaKeySession linked to the given initData and
 * initDataType.
 * @param {Object} loadedSessionsStore
 * @param {Object} initData
 * @returns {Observable}
 */
function createTemporarySession(
  loadedSessionsStore : LoadedSessionsStore,
  initData : IInitializationDataInfo
) : Observable<INewSessionCreatedEvent> {
  return observableDefer(() => {
    log.info("EME: Creating a new temporary session");
    const entry = loadedSessionsStore.createSession(initData, "temporary");
    return observableOf({ type: MediaKeySessionLoadingType.Created as const,
                          value: entry });
  });
}

/**
 * Create a persistent MediaKeySession and try to load on it a previous
 * MediaKeySession linked to the same initialization data.
 * @param {Object} loadedSessionsStore
 * @param {Object} persistentSessionsStore
 * @param {Object} initData
 * @returns {Observable}
 */
function createAndTryToRetrievePersistentSession(
  loadedSessionsStore : LoadedSessionsStore,
  persistentSessionsStore : PersistentSessionsStore,
  initData : IInitializationDataInfo
) : Observable<INewSessionCreatedEvent | IPersistentSessionRecoveryEvent> {
  return observableDefer(() => {
    log.info("EME: Creating persistent MediaKeySession");

    const entry = loadedSessionsStore
      .createSession(initData, "persistent-license");
    const storedEntry = persistentSessionsStore.getAndReuse(entry.keySessionRecord);

    if (storedEntry === null) {
      return observableOf({ type: MediaKeySessionLoadingType.Created as const,
                            value: entry });
    }

    /**
     * Helper function to close and restart the current persistent session
     * considered, and re-create it from scratch.
     * @returns {Observable}
     */
    const recreatePersistentSession = () : Observable<INewSessionCreatedEvent> => {
      log.info("EME: Removing previous persistent session.");
      if (persistentSessionsStore.get(entry.keySessionRecord) !== null) {
        persistentSessionsStore.delete(entry.keySessionRecord);
      }
      return loadedSessionsStore.closeSession(entry.mediaKeySession)
        .pipe(map(() => {
          const newEntry = loadedSessionsStore.createSession(initData,
                                                             "persistent-license");
          return { type: MediaKeySessionLoadingType.Created,
                   value: newEntry };
        }));
    };

    return loadSession(entry.mediaKeySession, storedEntry.sessionId).pipe(
      mergeMap((hasLoadedSession) : Observable<ICreateSessionEvent> => {
        if (!hasLoadedSession) {
          log.warn("EME: No data stored for the loaded session");
          persistentSessionsStore.delete(entry.keySessionRecord);
          return observableOf({ type: MediaKeySessionLoadingType.Created,
                                value: entry });
        }

        if (hasLoadedSession && isSessionUsable(entry.mediaKeySession)) {
          persistentSessionsStore.add(entry.keySessionRecord, entry.mediaKeySession);
          log.info("EME: Succeeded to load persistent session.");
          return observableOf({ type: MediaKeySessionLoadingType.LoadedPersistentSession,
                                value: entry });
        }

        // Unusable persistent session: recreate a new session from scratch.
        log.warn("EME: Previous persistent session not usable anymore.");
        return recreatePersistentSession();
      }),
      catchError((err : unknown) : Observable<INewSessionCreatedEvent> => {
        log.warn("EME: Unable to load persistent session: " +
                 (err instanceof Error ? err.toString() :
                                         "Unknown Error"));
        return recreatePersistentSession();
      })
    );
  });
}

export interface INewSessionCreatedEvent {
  type : MediaKeySessionLoadingType.Created;
  value : {
    mediaKeySession : MediaKeySession |
                      ICustomMediaKeySession;
    sessionType : MediaKeySessionType;
    keySessionRecord : KeySessionRecord;
  };
}

export interface IPersistentSessionRecoveryEvent {
  type : MediaKeySessionLoadingType.LoadedPersistentSession;
  value : {
    mediaKeySession : MediaKeySession |
                      ICustomMediaKeySession;
    sessionType : MediaKeySessionType;
    keySessionRecord : KeySessionRecord;
  };
}

export type ICreateSessionEvent = INewSessionCreatedEvent |
                                  IPersistentSessionRecoveryEvent;
