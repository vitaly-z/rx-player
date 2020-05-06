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
import log from "../../../log";
import areArraysOfNumbersEqual from "../../../utils/are_arrays_of_numbers_equal";
import { assertInterface } from "../../../utils/assert";
import hashBuffer from "../../../utils/hash_buffer";
import isNonEmptyString from "../../../utils/is_non_empty_string";
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
/**
 * Throw if the given storage does not respect the right interface.
 * @param {Object} storage
 */
function checkStorage(storage) {
    assertInterface(storage, { save: "function", load: "function" }, "licenseStorage");
}
/**
 * Set representing persisted licenses. Depends on a simple local-
 * storage implementation with a `save`/`load` synchronous interface
 * to persist information on persisted sessions.
 *
 * This set is used only for a cdm/keysystem with license persistency
 * supported.
 * @class PersistentSessionsStore
 */
var PersistentSessionsStore = /** @class */ (function () {
    /**
     * Create a new PersistentSessionsStore.
     * @param {Object} storage
     */
    function PersistentSessionsStore(storage) {
        checkStorage(storage);
        this._entries = [];
        this._storage = storage;
        try {
            this._entries = this._storage.load();
            if (!Array.isArray(this._entries)) {
                this._entries = [];
            }
        }
        catch (e) {
            log.warn("EME-PSS: Could not get entries from license storage", e);
            this.dispose();
        }
    }
    /**
     * Retrieve an entry based on its initialization data.
     * @param {Uint8Array}  initData
     * @param {string|undefined} initDataType
     * @returns {Object|null}
     */
    PersistentSessionsStore.prototype.get = function (initData, initDataType) {
        var index = this.getIndex(initData, initDataType);
        return index === -1 ? null :
            this._entries[index];
    };
    /**
     * Add a new entry in the PersistentSessionsStore.
     * @param {Uint8Array}  initData
     * @param {string|undefined} initDataType
     * @param {MediaKeySession} session
     */
    PersistentSessionsStore.prototype.add = function (initData, initDataType, session) {
        if (isNullOrUndefined(session) || !isNonEmptyString(session.sessionId)) {
            log.warn("EME-PSS: Invalid Persisten Session given.");
            return;
        }
        var sessionId = session.sessionId;
        var currentEntry = this.get(initData, initDataType);
        if (currentEntry !== null && currentEntry.sessionId === sessionId) {
            return;
        }
        else if (currentEntry !== null) { // currentEntry has a different sessionId
            this.delete(initData, initDataType);
        }
        var hash = hashBuffer(initData);
        log.info("EME-PSS: Add new session", sessionId, session);
        this._entries.push({ version: 1,
            sessionId: sessionId,
            initData: initData,
            initDataHash: hash,
            initDataType: initDataType });
        this._save();
    };
    /**
     * Delete stored MediaKeySession information based on its initialization
     * data.
     * @param {Uint8Array}  initData
     * @param {string|undefined} initDataType
     */
    PersistentSessionsStore.prototype.delete = function (initData, initDataType) {
        var index = this.getIndex(initData, initDataType);
        if (index !== -1) {
            log.warn("EME-PSS: initData to delete not found.");
            return;
        }
        var entry = this._entries[index];
        log.warn("EME-PSS: Delete session from store", entry);
        this._entries.splice(index, 1);
        this._save();
    };
    /**
     * Delete all saved entries.
     */
    PersistentSessionsStore.prototype.dispose = function () {
        this._entries = [];
        this._save();
    };
    /**
     * Retrieve index of an entry.
     * Returns `-1` if not found.
     * @param {Uint8Array}  initData
     * @param {string|undefined} initDataType
     * @returns {number}
     */
    PersistentSessionsStore.prototype.getIndex = function (initData, initDataType) {
        var hash = hashBuffer(initData);
        for (var i = 0; i < this._entries.length; i++) {
            var entry = this._entries[i];
            if (entry.initDataType === initDataType) {
                if (entry.version === 1) {
                    if (entry.initDataHash === hash &&
                        areArraysOfNumbersEqual(entry.initData, initData)) {
                        return i;
                    }
                }
                else {
                    if (entry.initData === hash) {
                        return i;
                    }
                }
            }
        }
        return -1;
    };
    /**
     * Use the given storage to store the current entries.
     */
    PersistentSessionsStore.prototype._save = function () {
        try {
            this._storage.save(this._entries);
        }
        catch (e) {
            log.warn("EME-PSS: Could not save licenses in localStorage");
        }
    };
    return PersistentSessionsStore;
}());
export default PersistentSessionsStore;
