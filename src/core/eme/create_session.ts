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
import { IMediaKeySessionStores } from "./types";
import isSessionUsable from "./utils/is_session_usable";
import LoadedSessionsStore from "./utils/loaded_sessions_store";
import PersistentSessionsStore from "./utils/persistent_sessions_store";
import ProcessedInitDataRecord from "./utils/processed_init_data_record";

/**
 * Create a new Session or load a persistent one on the given MediaKeys,
 * according to wanted settings and what is currently stored.
 *
 * If session creating fails, remove the oldest MediaKeySession loaded and
 * retry.
 * /!\ This only creates new sessions.
 * It will fail if loadedSessionsStore already has a MediaKeySession with
 * the given InitDataRecord.
 * @param {Object} stores
 * @param {Object} initDataRecord
 * @param {string} wantedSessionType
 * @returns {Observable}
 */
export default function createSession(
  stores : IMediaKeySessionStores,
  initDataRecord : ProcessedInitDataRecord,
  wantedSessionType : MediaKeySessionType
) : Observable<ICreateSessionEvent> {
  return observableDefer(() => {
    const { loadedSessionsStore,
            persistentSessionsStore } = stores;

    if (wantedSessionType === "temporary") {
      return createTemporarySession(loadedSessionsStore, initDataRecord);
    } else if (persistentSessionsStore === null) {
      log.warn("EME: Cannot create persistent MediaKeySession, " +
               "PersistentSessionsStore not created.");
      return createTemporarySession(loadedSessionsStore, initDataRecord);
    }
    return createAndTryToRetrievePersistentSession(loadedSessionsStore,
                                                   persistentSessionsStore,
                                                   initDataRecord);
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
  initDataRecord : ProcessedInitDataRecord
) : Observable<INewSessionCreatedEvent> {
  return observableDefer(() => {
    log.info("EME: Creating a new temporary session");
    const entry = loadedSessionsStore.createSession(initDataRecord, "temporary");
    return observableOf({ type: "created-session" as const,
                          value: entry });
  });
}

/**
 * Create a persistent MediaKeySession and try to load on it a previous
 * MediaKeySession linked to the same InitDataRecord.
 * @param {Object} loadedSessionsStore
 * @param {Object} persistentSessionsStore
 * @param {Object} initDataRecord
 * @returns {Observable}
 */
function createAndTryToRetrievePersistentSession(
  loadedSessionsStore : LoadedSessionsStore,
  persistentSessionsStore : PersistentSessionsStore,
  initDataRecord : ProcessedInitDataRecord
) : Observable<INewSessionCreatedEvent | IPersistentSessionRecoveryEvent> {
  return observableDefer(() => {
    log.info("EME: Creating persistent MediaKeySession");

    const entry = loadedSessionsStore
      .createSession(initDataRecord, "persistent-license");
    const storedEntry = persistentSessionsStore.getAndReuse(entry.initDataRecord);

    if (storedEntry === null) {
      return observableOf({ type: "created-session" as const,
                            value: entry });
    }

    /**
     * Helper function to close and restart the current persistent session
     * considered, and re-create it from scratch.
     * @returns {Observable}
     */
    const recreatePersistentSession = () : Observable<INewSessionCreatedEvent> => {
      log.info("EME: Removing previous persistent session.");
      if (persistentSessionsStore.get(initDataRecord) !== null) {
        persistentSessionsStore.delete(initDataRecord);
      }
      return loadedSessionsStore.closeSession(entry.mediaKeySession)
        .pipe(map(() => {
          const newEntry = loadedSessionsStore.createSession(initDataRecord,
                                                             "persistent-license");
          return { type: "created-session" as const,
                   value: newEntry };
        }));
    };

    return loadSession(entry.mediaKeySession, storedEntry.sessionId).pipe(
      mergeMap((hasLoadedSession) : Observable<ICreateSessionEvent> => {
        if (!hasLoadedSession) {
          log.warn("EME: No data stored for the loaded session");
          persistentSessionsStore.delete(initDataRecord);
          return observableOf({ type: "created-session" as const,
                                value: entry });
        }

        if (hasLoadedSession && isSessionUsable(entry.mediaKeySession)) {
          persistentSessionsStore.add(initDataRecord, entry.mediaKeySession);
          log.info("EME: Succeeded to load persistent session.");
          return observableOf({ type: "loaded-persistent-session" as const,
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
  type : "created-session";
  value : {
    mediaKeySession : MediaKeySession |
                      ICustomMediaKeySession;
    sessionType : MediaKeySessionType;
    initDataRecord : ProcessedInitDataRecord;
  };
}

export interface IPersistentSessionRecoveryEvent {
  type : "loaded-persistent-session";
  value : {
    mediaKeySession : MediaKeySession |
                      ICustomMediaKeySession;
    sessionType : MediaKeySessionType;
    initDataRecord : ProcessedInitDataRecord;
  };
}

export type ICreateSessionEvent = INewSessionCreatedEvent |
                                  IPersistentSessionRecoveryEvent;
