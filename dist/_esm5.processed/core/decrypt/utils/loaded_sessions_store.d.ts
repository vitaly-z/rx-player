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
import { ICustomMediaKeys, ICustomMediaKeySession } from "../../../compat";
import { IProcessedProtectionData } from "../types";
import KeySessionRecord from "./key_session_record";
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
    private readonly _mediaKeys;
    /** Store unique MediaKeySession information per initialization data. */
    private _storage;
    /**
     * Create a new LoadedSessionsStore, which will store information about
     * loaded MediaKeySessions on the given MediaKeys instance.
     * @param {MediaKeys} mediaKeys
     */
    constructor(mediaKeys: MediaKeys | ICustomMediaKeys);
    /**
     * Create a new MediaKeySession and store it in this store.
     * @param {Object} initializationData
     * @param {string} sessionType
     * @returns {Object}
     */
    createSession(initData: IProcessedProtectionData, sessionType: MediaKeySessionType): IStoredSessionEntry;
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
    reuse(initializationData: IProcessedProtectionData): IStoredSessionEntry | null;
    /**
     * Close a MediaKeySession and remove its related stored information from the
     * `LoadedSessionsStore`.
     * Emit when done.
     * @param {Object} mediaKeySession
     * @returns {Promise}
     */
    closeSession(mediaKeySession: MediaKeySession | ICustomMediaKeySession): Promise<boolean>;
    /**
     * Returns the number of stored MediaKeySessions in this LoadedSessionsStore.
     * @returns {number}
     */
    getLength(): number;
    /**
     * Returns information about all stored MediaKeySession, in the order in which
     * the MediaKeySession have been created.
     * @returns {Array.<Object>}
     */
    getAll(): IStoredSessionEntry[];
    /**
     * Close all sessions in this store.
     * Emit `null` when done.
     * @returns {Promise}
     */
    closeAllSessions(): Promise<void>;
    private getIndex;
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
    keySessionRecord: KeySessionRecord;
    /** The MediaKeySession created. */
    mediaKeySession: MediaKeySession | ICustomMediaKeySession;
    /**
     * The MediaKeySessionType (e.g. "temporary" or "persistent-license") with
     * which the MediaKeySession was created.
     */
    sessionType: MediaKeySessionType;
}
