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
import { bytesToBase64 } from "../../../utils/base64";
import hashBuffer from "../../../utils/hash_buffer";
import isNonEmptyString from "../../../utils/is_non_empty_string";
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
import areInitializationValuesCompatible from "./are_init_values_compatible";
import { areKeyIdsEqual } from "./key_id_comparison";
import SerializableBytes from "./serializable_bytes";
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
            var entries = this._storage.load();
            if (!Array.isArray(entries)) {
                entries = [];
            }
            this._entries = entries;
        }
        catch (e) {
            log.warn("DRM-PSS: Could not get entries from license storage", e instanceof Error ? e : "");
            this.dispose();
        }
    }
    /**
     * Returns the number of stored values.
     * @returns {number}
     */
    PersistentSessionsStore.prototype.getLength = function () {
        return this._entries.length;
    };
    /**
     * Returns information about all stored MediaKeySession, in the order in which
     * the MediaKeySession have been created.
     * @returns {Array.<Object>}
     */
    PersistentSessionsStore.prototype.getAll = function () {
        return this._entries;
    };
    /**
     * Retrieve an entry based on its initialization data.
     * @param {Object}  initData
     * @param {string|undefined} initDataType
     * @returns {Object|null}
     */
    PersistentSessionsStore.prototype.get = function (initData) {
        var index = this._getIndex(initData);
        return index === -1 ? null :
            this._entries[index];
    };
    /**
     * Like `get`, but also move the corresponding value at the end of the store
     * (as returned by `getAll`) if found.
     * This can be used for example to tell when a previously-stored value is
     * re-used to then be able to implement a caching replacement algorithm based
     * on the least-recently-used values by just evicting the first values
     * returned by `getAll`.
     * @param {Uint8Array} initData
     * @param {string|undefined} initDataType
     * @returns {*}
     */
    PersistentSessionsStore.prototype.getAndReuse = function (initData) {
        var index = this._getIndex(initData);
        if (index === -1) {
            return null;
        }
        var item = this._entries.splice(index, 1)[0];
        this._entries.push(item);
        return item;
    };
    /**
     * Add a new entry in the PersistentSessionsStore.
     * @param {Uint8Array}  initData
     * @param {string|undefined} initDataType
     * @param {MediaKeySession} session
     */
    PersistentSessionsStore.prototype.add = function (initData, keyIds, session) {
        var _a;
        if (isNullOrUndefined(session) || !isNonEmptyString(session.sessionId)) {
            log.warn("DRM-PSS: Invalid Persisten Session given.");
            return;
        }
        var sessionId = session.sessionId;
        var currentIndex = this._getIndex(initData);
        if (currentIndex >= 0) {
            var currVersion = keyIds === undefined ? 3 :
                4;
            var currentEntry = this._entries[currentIndex];
            var entryVersion = (_a = currentEntry.version) !== null && _a !== void 0 ? _a : -1;
            if (entryVersion >= currVersion && sessionId === currentEntry.sessionId) {
                return;
            }
            log.info("DRM-PSS: Updating session info.", sessionId);
            this._entries.splice(currentIndex, 1);
        }
        else {
            log.info("DRM-PSS: Add new session", sessionId);
        }
        var storedValues = prepareValuesForStore(initData.values.getFormattedValues());
        if (keyIds === undefined) {
            this._entries.push({ version: 3, sessionId: sessionId, values: storedValues,
                initDataType: initData.type });
        }
        else {
            this._entries.push({ version: 4, sessionId: sessionId, keyIds: keyIds.map(function (k) { return new SerializableBytes(k); }),
                values: storedValues,
                initDataType: initData.type });
        }
        this._save();
    };
    /**
     * Delete stored MediaKeySession information based on its session id.
     * @param {Uint8Array}  initData
     * @param {string|undefined} initDataType
     */
    PersistentSessionsStore.prototype.delete = function (sessionId) {
        var index = -1;
        for (var i = 0; i < this._entries.length; i++) {
            var entry_1 = this._entries[i];
            if (entry_1.sessionId === sessionId) {
                index = i;
                break;
            }
        }
        if (index === -1) {
            log.warn("DRM-PSS: initData to delete not found.");
            return;
        }
        var entry = this._entries[index];
        log.warn("DRM-PSS: Delete session from store", entry.sessionId);
        this._entries.splice(index, 1);
        this._save();
    };
    PersistentSessionsStore.prototype.deleteOldSessions = function (sessionsToDelete) {
        log.info("DRM-PSS: Deleting last ".concat(sessionsToDelete, " sessions."));
        if (sessionsToDelete <= 0) {
            return;
        }
        if (sessionsToDelete <= this._entries.length) {
            this._entries.splice(0, sessionsToDelete);
        }
        else {
            log.warn("DRM-PSS: Asked to remove more information that it contains", sessionsToDelete, this._entries.length);
            this._entries = [];
        }
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
     * @param {Object} initData
     * @returns {number}
     */
    PersistentSessionsStore.prototype._getIndex = function (initData) {
        // Older versions of the format include a concatenation of all
        // initialization data and its hash.
        // This is only computed lazily, the first time it is needed.
        var lazyConcatenatedData = null;
        function getConcatenatedInitDataInfo() {
            if (lazyConcatenatedData === null) {
                var concatInitData = initData.values.constructRequestData();
                lazyConcatenatedData = { initData: concatInitData,
                    initDataHash: hashBuffer(concatInitData) };
            }
            return lazyConcatenatedData;
        }
        var _loop_1 = function (i) {
            var entry = this_1._entries[i];
            if (entry.initDataType === initData.type) {
                switch (entry.version) {
                    case 4:
                        if (initData.keyIds !== undefined) {
                            var foundCompatible = initData.keyIds.every(function (keyId) {
                                var keyIdB64 = bytesToBase64(keyId);
                                for (var _i = 0, _a = entry.keyIds; _i < _a.length; _i++) {
                                    var entryKid = _a[_i];
                                    if (typeof entryKid === "string") {
                                        if (keyIdB64 === entryKid) {
                                            return true;
                                        }
                                    }
                                    else if (areKeyIdsEqual(entryKid.initData, keyId)) {
                                        return true;
                                    }
                                }
                                return false;
                            });
                            if (foundCompatible) {
                                return { value: i };
                            }
                        }
                        else {
                            var formatted_1 = initData.values.getFormattedValues();
                            if (areInitializationValuesCompatible(formatted_1, entry.values)) {
                                return { value: i };
                            }
                        }
                        break;
                    case 3:
                        var formatted = initData.values.getFormattedValues();
                        if (areInitializationValuesCompatible(formatted, entry.values)) {
                            return { value: i };
                        }
                        break;
                    case 2: {
                        var _a = getConcatenatedInitDataInfo(), concatInitData = _a.initData, concatHash = _a.initDataHash;
                        if (entry.initDataHash === concatHash) {
                            try {
                                var decodedInitData = typeof entry.initData === "string" ?
                                    SerializableBytes.decode(entry.initData) :
                                    entry.initData.initData;
                                if (areArraysOfNumbersEqual(decodedInitData, concatInitData)) {
                                    return { value: i };
                                }
                            }
                            catch (e) {
                                log.warn("DRM-PSS: Could not decode initialization data.", e instanceof Error ? e : "");
                            }
                        }
                        break;
                    }
                    case 1: {
                        var _b = getConcatenatedInitDataInfo(), concatInitData = _b.initData, concatHash = _b.initDataHash;
                        if (entry.initDataHash === concatHash) {
                            if (typeof entry.initData.length === "undefined") {
                                return { value: i };
                            }
                            else if (areArraysOfNumbersEqual(entry.initData, concatInitData)) {
                                return { value: i };
                            }
                        }
                        break;
                    }
                    default: {
                        var concatHash = getConcatenatedInitDataInfo().initDataHash;
                        if (entry.initData === concatHash) {
                            return { value: i };
                        }
                    }
                }
            }
        };
        var this_1 = this;
        for (var i = 0; i < this._entries.length; i++) {
            var state_1 = _loop_1(i);
            if (typeof state_1 === "object")
                return state_1.value;
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
            log.warn("DRM-PSS: Could not save licenses in localStorage");
        }
    };
    return PersistentSessionsStore;
}());
export default PersistentSessionsStore;
/**
 * Format given initializationData's values so they are ready to be stored:
 *   - sort them by systemId, so they are faster to compare
 *   - add hash for each initialization data encountered.
 * @param {Array.<Object>} initialValues
 * @returns {Array.<Object>}
 */
function prepareValuesForStore(initialValues) {
    return initialValues
        .map(function (_a) {
        var systemId = _a.systemId, data = _a.data, hash = _a.hash;
        return ({ systemId: systemId, hash: hash, data: new SerializableBytes(data) });
    });
}
