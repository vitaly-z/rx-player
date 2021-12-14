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
  concat as observableConcat,
  defer as observableDefer,
  EMPTY,
  ignoreElements,
  merge as observableMerge,
  Observable,
  of as observableOf,
} from "rxjs";
import {
  ICustomMediaKeys,
  ICustomMediaKeySession,
} from "../../../compat";
import log from "../../../log";
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
import { IInitializationDataInfo } from "../types";
import safelyCloseMediaKeySession from "./close_session";
import ProcessedInitDataRecord from "./processed_init_data_record";

/**
 * Create and store MediaKeySessions linked to a single MediaKeys
 * instance.
 *
 * Keep track of sessionTypes and of the initialization data each
 * MediaKeySession is created for.
 * @class LoadedSessionsStore
 */
export default class LoadedSessionsStore {
  /** MediaKeys instance on which the MediaKeySessions are created. */
  private readonly _mediaKeys : MediaKeys|ICustomMediaKeys;

  /** Store unique MediaKeySession information per initialization data. */
  private _storage : IStoredSessionEntry[];

  /**
   * Create a new LoadedSessionsStore, which will store information about
   * loaded MediaKeySessions on the given MediaKeys instance.
   * @param {MediaKeys} mediaKeys
   */
  constructor(mediaKeys : MediaKeys|ICustomMediaKeys) {
    this._mediaKeys = mediaKeys;
    this._storage = [];
  }

  /**
   * Create a new MediaKeySession and store it in this store.
   * @throws {EncryptedMediaError}
   * @param {Object} initializationData
   * @param {string} sessionType
   * @returns {MediaKeySession}
   */
  public createSession(
    initDataRecord : ProcessedInitDataRecord,
    sessionType : MediaKeySessionType
  ) : IStoredSessionEntry {
    const mediaKeySession = this._mediaKeys.createSession(sessionType);
    const entry = { mediaKeySession, sessionType, initDataRecord };
    if (!isNullOrUndefined(mediaKeySession.closed)) {
      mediaKeySession.closed
        .then(() => {
          const index = this.getIndex(initDataRecord);
          if (index >= 0 &&
              this._storage[index].mediaKeySession === mediaKeySession)
          {
            this._storage.splice(index, 1);
          }
        })
        .catch((e : unknown) => {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          log.warn(`EME-LSS: MediaKeySession.closed rejected: ${e}`);
        });
    }

    log.debug("EME-LSS: Add MediaKeySession", entry);
    this._storage.push({ initDataRecord, mediaKeySession, sessionType });
    return entry;
  }

  /**
   * Find a stored entry compatible with the initialization data given and moves
   * this entry at the end of the `LoadedSessionsStore`''s storage, returned by
   * its `getAll` method.
   *
   * This can be used for example to tell when a previously-stored
   * entry is re-used to then be able to implement a caching replacement
   * algorithm based on the least-recently-used values by just evicting the first
   * values returned by `getAll`.
   * @param {Object} initializationData
   * @returns {Object|null}
   */
  public reuse(
    initializationData : IInitializationDataInfo
  ) : IStoredSessionData | null {
    for (let i = this._storage.length; i >= 0; i--) {
      const stored = this._storage[i];
      if (stored.initDataRecord.isCompatibleWith(initializationData)) {
        this._storage.splice(i, 1);
        this._storage.push(stored);
        return { initDataRecord: stored.initDataRecord,
                 mediaKeySession: stored.mediaKeySession,
                 sessionType: stored.sessionType };
      }
    }
    return null;
  }

  /**
   * Close a MediaKeySession and remove its related stored information from the
   * `LoadedSessionsStore`.
   * Emit when done.
   * @param {Object} mediaKeySession
   * @returns {Observable}
   */
  public closeSession(
    mediaKeySession : MediaKeySession | ICustomMediaKeySession
  ) : Observable<unknown> {
    return observableDefer(() => {
      let entry;
      for (const stored of this._storage) {
        if (stored.mediaKeySession === mediaKeySession) {
          entry = stored;
          break;
        }
      }
      if (entry === undefined) {
        log.warn("EME-LSS: No MediaKeySession found with " +
                 "the given initData and initDataType");
        return EMPTY;
      }
      return safelyCloseMediaKeySession(entry.mediaKeySession);
    });
  }

  /**
   * Returns the number of stored MediaKeySessions in this LoadedSessionsStore.
   * @returns {number}
   */
  public getLength() : number {
    return this._storage.length;
  }

  /**
   * Returns information about all stored MediaKeySession, in the order in which
   * the MediaKeySession have been created.
   * @returns {Array.<Object>}
   */
  public getAll() : IStoredSessionEntry[] {
    return this._storage;
  }

  /**
   * Close all sessions in this store.
   * Emit `null` when done.
   * @returns {Observable}
   */
  public closeAllSessions() : Observable<null> {
    return observableDefer(() => {
      const closing$ = this._storage
        .map((entry) => safelyCloseMediaKeySession(entry.mediaKeySession));

      log.debug("EME-LSS: Closing all current MediaKeySessions", closing$.length);

      // re-initialize the storage, so that new interactions with the
      // `LoadedSessionsStore` do not rely on MediaKeySessions we're in the
      // process of removing
      this._storage = [];

      return observableConcat(observableMerge(...closing$).pipe(ignoreElements()),
                              observableOf(null));
    });
  }

  private getIndex(record : ProcessedInitDataRecord) : number {
    for (let i = 0; i < this._storage.length; i++) {
      const stored = this._storage[i];
      if (stored.initDataRecord === record) {
        return i;
      }
    }
    return -1;
  }
}

/** Stored MediaKeySession data assiociated to an initialization data. */
interface IStoredSessionEntry {
  /** The initialization data linked to the MediaKeySession. */
  initDataRecord : ProcessedInitDataRecord;
  /** The MediaKeySession created. */
  mediaKeySession : MediaKeySession |
                    ICustomMediaKeySession;
  /** The MediaKeySessionType (e.g. "temporary" or "persistent-license"). */
  sessionType : MediaKeySessionType;
}

/** MediaKeySession information. */
export interface IStoredSessionData {
  /** The MediaKeySession created. */
  mediaKeySession : MediaKeySession |
                    ICustomMediaKeySession;
  /** The MediaKeySessionType (e.g. "temporary" or "persistent-license"). */
  sessionType : MediaKeySessionType;
  /** The `ProcessedInitDataRecord` linked to the MediaKeySession. */
  initDataRecord : ProcessedInitDataRecord;
}
