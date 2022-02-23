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
import { concat as observableConcat, defer as observableDefer, EMPTY, merge as observableMerge, of as observableOf, } from "rxjs";
import { ignoreElements } from "rxjs/operators";
import { EncryptedMediaError } from "../../../errors";
import log from "../../../log";
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
import safelyCloseMediaKeySession from "./close_session";
import InitDataStore from "./init_data_store";
/**
 * Create and store MediaKeySessions linked to a single MediaKeys
 * instance.
 *
 * Keep track of sessionTypes and of the initialization data each
 * MediaKeySession is created for.
 * @class LoadedSessionsStore
 */
var LoadedSessionsStore = /** @class */ (function () {
    /**
     * Create a new LoadedSessionsStore, which will store information about
     * loaded MediaKeySessions on the given MediaKeys instance.
     * @param {MediaKeys} mediaKeys
     */
    function LoadedSessionsStore(mediaKeys) {
        this._mediaKeys = mediaKeys;
        this._storage = new InitDataStore();
    }
    /**
     * Returns the stored MediaKeySession information related to the
     * given initDataType and initData if found.
     * Returns `null` if no such MediaKeySession is stored.
     * @param {Object} initializationData
     * @returns {Object|null}
     */
    LoadedSessionsStore.prototype.get = function (initializationData) {
        var entry = this._storage.get(initializationData);
        return entry === undefined ? null :
            { mediaKeySession: entry.mediaKeySession,
                sessionType: entry.sessionType };
    };
    /**
     * Like `get` but also moves the corresponding MediaKeySession to the end of
     * its internal storage, as returned by the `getAll` method.
     *
     * This can be used for example to tell when a previously-stored
     * initialization data is re-used to then be able to implement a caching
     * replacement algorithm based on the least-recently-used values by just
     * evicting the first values returned by `getAll`.
     * @param {Object} initializationData
     * @returns {Object|null}
     */
    LoadedSessionsStore.prototype.getAndReuse = function (initializationData) {
        var entry = this._storage.getAndReuse(initializationData);
        return entry === undefined ? null :
            { mediaKeySession: entry.mediaKeySession,
                sessionType: entry.sessionType };
    };
    /**
     * Moves the corresponding MediaKeySession to the end of its internal storage,
     * as returned by the `getAll` method.
     *
     * This can be used to signal that a previously-stored initialization data is
     * re-used to then be able to implement a caching replacement algorithm based
     * on the least-recently-used values by just evicting the first values
     * returned by `getAll`.
     *
     * Returns `true` if the corresponding session was found in the store, `false`
     * otherwise.
     * @param {Object} initializationData
     * @returns {boolean}
     */
    LoadedSessionsStore.prototype.reuse = function (initializationData) {
        return this._storage.getAndReuse(initializationData) !== undefined;
    };
    /**
     * Create a new MediaKeySession and store it in this store.
     * @throws {EncryptedMediaError}
     * @param {Object} initializationData
     * @param {string} sessionType
     * @returns {MediaKeySession}
     */
    LoadedSessionsStore.prototype.createSession = function (initializationData, sessionType) {
        var _this = this;
        if (this._storage.get(initializationData) !== undefined) {
            throw new EncryptedMediaError("MULTIPLE_SESSIONS_SAME_INIT_DATA", "This initialization data was already stored.");
        }
        var mediaKeySession = this._mediaKeys.createSession(sessionType);
        var entry = { mediaKeySession: mediaKeySession, sessionType: sessionType, initializationData: initializationData };
        if (!isNullOrUndefined(mediaKeySession.closed)) {
            mediaKeySession.closed
                .then(function () {
                var currentEntry = _this._storage.get(initializationData);
                if (currentEntry !== undefined &&
                    currentEntry.mediaKeySession === mediaKeySession) {
                    _this._storage.remove(initializationData);
                }
            })
                .catch(function (e) {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                log.warn("EME-LSS: MediaKeySession.closed rejected: " + e);
            });
        }
        log.debug("EME-LSS: Add MediaKeySession", entry);
        this._storage.store(initializationData, entry);
        return mediaKeySession;
    };
    /**
     * Close a MediaKeySession corresponding to an initialization data and remove
     * its related stored information from the LoadedSessionsStore.
     * Emit when done.
     * @param {Object} initializationData
     * @returns {Observable}
     */
    LoadedSessionsStore.prototype.closeSession = function (initializationData) {
        var _this = this;
        return observableDefer(function () {
            var entry = _this._storage.remove(initializationData);
            if (entry === undefined) {
                log.warn("EME-LSS: No MediaKeySession found with " +
                    "the given initData and initDataType");
                return EMPTY;
            }
            return safelyCloseMediaKeySession(entry.mediaKeySession);
        });
    };
    /**
     * Returns the number of stored MediaKeySessions in this LoadedSessionsStore.
     * @returns {number}
     */
    LoadedSessionsStore.prototype.getLength = function () {
        return this._storage.getLength();
    };
    /**
     * Returns information about all stored MediaKeySession, in the order in which
     * the MediaKeySession have been created.
     * @returns {Array.<Object>}
     */
    LoadedSessionsStore.prototype.getAll = function () {
        return this._storage.getAll();
    };
    /**
     * Close all sessions in this store.
     * Emit `null` when done.
     * @returns {Observable}
     */
    LoadedSessionsStore.prototype.closeAllSessions = function () {
        var _this = this;
        return observableDefer(function () {
            var closing$ = _this._storage.getAll()
                .map(function (entry) { return safelyCloseMediaKeySession(entry.mediaKeySession); });
            log.debug("EME-LSS: Closing all current MediaKeySessions", closing$.length);
            // re-initialize the storage, so that new interactions with the
            // `LoadedSessionsStore` do not rely on MediaKeySessions we're in the
            // process of removing
            _this._storage = new InitDataStore();
            return observableConcat(observableMerge.apply(void 0, closing$).pipe(ignoreElements()), observableOf(null));
        });
    };
    return LoadedSessionsStore;
}());
export default LoadedSessionsStore;
