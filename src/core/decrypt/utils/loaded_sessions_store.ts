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

import PPromise from "pinkie";
import {
  ICustomMediaKeys,
  ICustomMediaKeySession,
} from "../../../compat";
import log from "../../../log";
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
import { IInitializationDataInfo } from "../types";
import safelyCloseMediaKeySession from "./close_session";
import KeySessionRecord from "./processed_init_data_record";

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
   * @param {Object} initializationData
   * @param {string} sessionType
   * @returns {Object}
   */
  public createSession(
    initData : IInitializationDataInfo,
    sessionType : MediaKeySessionType
  ) : IStoredSessionEntry {
    const keySessionRecord = new KeySessionRecord(initData);
    const mediaKeySession = this._mediaKeys.createSession(sessionType);
    const entry = { mediaKeySession, sessionType, keySessionRecord };
    if (!isNullOrUndefined(mediaKeySession.closed)) {
      mediaKeySession.closed
        .then(() => {
          const index = this.getIndex(keySessionRecord);
          if (index >= 0 &&
              this._storage[index].mediaKeySession === mediaKeySession)
          {
            this._storage.splice(index, 1);
          }
        })
        .catch((e : unknown) => {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          log.warn(`DRM-LSS: MediaKeySession.closed rejected: ${e}`);
        });
    }

    log.debug("DRM-LSS: Add MediaKeySession", entry);
    this._storage.push({ keySessionRecord, mediaKeySession, sessionType });
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
  ) : IStoredSessionEntry | null {
    for (let i = this._storage.length; i >= 0; i--) {
      const stored = this._storage[i];
      if (stored.keySessionRecord.isCompatibleWith(initializationData)) {
        this._storage.splice(i, 1);
        this._storage.push(stored);
        return { keySessionRecord: stored.keySessionRecord,
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
   * @returns {Promise}
   */
  public async closeSession(
    mediaKeySession : MediaKeySession | ICustomMediaKeySession
  ) : Promise<boolean> {
    let entry;
    for (const stored of this._storage) {
      if (stored.mediaKeySession === mediaKeySession) {
        entry = stored;
        break;
      }
    }
    if (entry === undefined) {
      log.warn("DRM-LSS: No MediaKeySession found with " +
               "the given initData and initDataType");
      return PPromise.resolve(false);
    }
    await safelyCloseMediaKeySession(entry.mediaKeySession);
    return PPromise.resolve(true);
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
   * @returns {Promise}
   */
  public async closeAllSessions() : Promise<void> {
    const allEntries = this._storage;
    log.debug("DRM-LSS: Closing all current MediaKeySessions", allEntries.length);

    // re-initialize the storage, so that new interactions with the
    // `LoadedSessionsStore` do not rely on MediaKeySessions we're in the
    // process of removing
    this._storage = [];

    const closingProms = allEntries
      .map((entry) => safelyCloseMediaKeySession(entry.mediaKeySession));
    await PPromise.all(closingProms);
  }

  private getIndex(record : KeySessionRecord) : number {
    for (let i = 0; i < this._storage.length; i++) {
      const stored = this._storage[i];
      if (stored.keySessionRecord === record) {
        return i;
      }
    }
    return -1;
  }
}

/** Information linked to a `MediaKeySession` created by the `LoadedSessionsStore`. */
export interface IStoredSessionEntry {
  /**
   * The `KeySessionRecord` linked to the MediaKeySession.
   * It keeps track of all key ids that are currently known to be associated to
   * the MediaKeySession.
   *
   * Initially only assiociated with the initialization data given, you may want
   * to add to it other key ids if you find out that there are also linked to
   * that session.
   *
   * Regrouping all those key ids into the `KeySessionRecord` in that way allows
   * the `LoadedSessionsStore` to perform compatibility checks when future
   * initialization data is encountered.
   */
  keySessionRecord : KeySessionRecord;

  /** The MediaKeySession created. */
  mediaKeySession : MediaKeySession |
                    ICustomMediaKeySession;

  /**
   * The MediaKeySessionType (e.g. "temporary" or "persistent-license") with
   * which the MediaKeySession was created.
   */
  sessionType : MediaKeySessionType;
}
