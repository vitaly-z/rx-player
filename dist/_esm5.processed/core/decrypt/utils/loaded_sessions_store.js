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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { closeSession, } from "../../../compat";
import { onKeyMessage$, onKeyStatusesChange$, } from "../../../compat/event_listeners";
import config from "../../../config";
import log from "../../../log";
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
import KeySessionRecord from "./key_session_record";
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
        this._storage = [];
    }
    /**
     * Create a new MediaKeySession and store it in this store.
     * @param {Object} initializationData
     * @param {string} sessionType
     * @returns {Object}
     */
    LoadedSessionsStore.prototype.createSession = function (initData, sessionType) {
        var _this = this;
        var keySessionRecord = new KeySessionRecord(initData);
        var mediaKeySession = this._mediaKeys.createSession(sessionType);
        var entry = { mediaKeySession: mediaKeySession, sessionType: sessionType, keySessionRecord: keySessionRecord };
        if (!isNullOrUndefined(mediaKeySession.closed)) {
            mediaKeySession.closed
                .then(function () {
                var index = _this.getIndex(keySessionRecord);
                if (index >= 0 &&
                    _this._storage[index].mediaKeySession === mediaKeySession) {
                    _this._storage.splice(index, 1);
                }
            })
                .catch(function (e) {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                log.warn("DRM-LSS: MediaKeySession.closed rejected: ".concat(e));
            });
        }
        log.debug("DRM-LSS: Add MediaKeySession", entry.sessionType);
        this._storage.push({ keySessionRecord: keySessionRecord, mediaKeySession: mediaKeySession, sessionType: sessionType });
        return entry;
    };
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
    LoadedSessionsStore.prototype.reuse = function (initializationData) {
        for (var i = this._storage.length - 1; i >= 0; i--) {
            var stored = this._storage[i];
            if (stored.keySessionRecord.isCompatibleWith(initializationData)) {
                this._storage.splice(i, 1);
                this._storage.push(stored);
                return { keySessionRecord: stored.keySessionRecord,
                    mediaKeySession: stored.mediaKeySession,
                    sessionType: stored.sessionType };
            }
        }
        return null;
    };
    /**
     * Close a MediaKeySession and remove its related stored information from the
     * `LoadedSessionsStore`.
     * Emit when done.
     * @param {Object} mediaKeySession
     * @returns {Promise}
     */
    LoadedSessionsStore.prototype.closeSession = function (mediaKeySession) {
        return __awaiter(this, void 0, void 0, function () {
            var entry, _i, _a, stored;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        for (_i = 0, _a = this._storage; _i < _a.length; _i++) {
                            stored = _a[_i];
                            if (stored.mediaKeySession === mediaKeySession) {
                                entry = stored;
                                break;
                            }
                        }
                        if (entry === undefined) {
                            log.warn("DRM-LSS: No MediaKeySession found with " +
                                "the given initData and initDataType");
                            return [2 /*return*/, Promise.resolve(false)];
                        }
                        return [4 /*yield*/, safelyCloseMediaKeySession(entry.mediaKeySession)];
                    case 1:
                        _b.sent();
                        return [2 /*return*/, Promise.resolve(true)];
                }
            });
        });
    };
    /**
     * Returns the number of stored MediaKeySessions in this LoadedSessionsStore.
     * @returns {number}
     */
    LoadedSessionsStore.prototype.getLength = function () {
        return this._storage.length;
    };
    /**
     * Returns information about all stored MediaKeySession, in the order in which
     * the MediaKeySession have been created.
     * @returns {Array.<Object>}
     */
    LoadedSessionsStore.prototype.getAll = function () {
        return this._storage;
    };
    /**
     * Close all sessions in this store.
     * Emit `null` when done.
     * @returns {Promise}
     */
    LoadedSessionsStore.prototype.closeAllSessions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var allEntries, closingProms;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        allEntries = this._storage;
                        log.debug("DRM-LSS: Closing all current MediaKeySessions", allEntries.length);
                        // re-initialize the storage, so that new interactions with the
                        // `LoadedSessionsStore` do not rely on MediaKeySessions we're in the
                        // process of removing
                        this._storage = [];
                        closingProms = allEntries
                            .map(function (entry) { return safelyCloseMediaKeySession(entry.mediaKeySession); });
                        return [4 /*yield*/, Promise.all(closingProms)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    LoadedSessionsStore.prototype.getIndex = function (record) {
        for (var i = 0; i < this._storage.length; i++) {
            var stored = this._storage[i];
            if (stored.keySessionRecord === record) {
                return i;
            }
        }
        return -1;
    };
    return LoadedSessionsStore;
}());
export default LoadedSessionsStore;
/**
 * Close a MediaKeySession with multiple attempts if needed and do not throw if
 * this action throws an error.
 * Emits then complete when done.
 * @param {MediaKeySession} mediaKeySession
 * @returns {Observable}
 */
function safelyCloseMediaKeySession(mediaKeySession) {
    return recursivelyTryToCloseMediaKeySession(0);
    /**
     * Perform a new attempt at closing the MediaKeySession.
     * If this operation fails due to a not-"callable" (an EME term)
     * MediaKeySession, retry based on either a timer or on MediaKeySession
     * events, whichever comes first.
     * Emits then complete when done.
     * @param {number} retryNb - The attempt number starting at 0.
     * @returns {Observable}
     */
    function recursivelyTryToCloseMediaKeySession(retryNb) {
        return __awaiter(this, void 0, void 0, function () {
            var err_1, _a, EME_SESSION_CLOSING_MAX_RETRY, EME_SESSION_CLOSING_INITIAL_DELAY, EME_SESSION_CLOSING_MAX_DELAY, nextRetryNb, delay_1, ksChangeSub_1, ksChangeProm, ksMsgSub_1, ksMsgProm, sleepTimer_1, sleepProm;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        log.debug("DRM: Trying to close a MediaKeySession", mediaKeySession.sessionId, retryNb);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 5]);
                        return [4 /*yield*/, closeSession(mediaKeySession)];
                    case 2:
                        _b.sent();
                        log.debug("DRM: Succeeded to close MediaKeySession");
                        return [2 /*return*/, undefined];
                    case 3:
                        err_1 = _b.sent();
                        // Unitialized MediaKeySession may not close properly until their
                        // corresponding `generateRequest` or `load` call are handled by the
                        // browser.
                        // In that case the EME specification tells us that the browser is
                        // supposed to reject the `close` call with an InvalidStateError.
                        if (!(err_1 instanceof Error) || err_1.name !== "InvalidStateError" ||
                            mediaKeySession.sessionId !== "") {
                            return [2 /*return*/, failToCloseSession(err_1)];
                        }
                        _a = config.getCurrent(), EME_SESSION_CLOSING_MAX_RETRY = _a.EME_SESSION_CLOSING_MAX_RETRY, EME_SESSION_CLOSING_INITIAL_DELAY = _a.EME_SESSION_CLOSING_INITIAL_DELAY, EME_SESSION_CLOSING_MAX_DELAY = _a.EME_SESSION_CLOSING_MAX_DELAY;
                        nextRetryNb = retryNb + 1;
                        if (nextRetryNb > EME_SESSION_CLOSING_MAX_RETRY) {
                            return [2 /*return*/, failToCloseSession(err_1)];
                        }
                        delay_1 = Math.min(Math.pow(2, retryNb) * EME_SESSION_CLOSING_INITIAL_DELAY, EME_SESSION_CLOSING_MAX_DELAY);
                        log.warn("DRM: attempt to close a mediaKeySession failed, " +
                            "scheduling retry...", delay_1);
                        ksChangeProm = new Promise(function (res) {
                            ksChangeSub_1 = onKeyStatusesChange$(mediaKeySession).subscribe(res);
                        });
                        ksMsgProm = new Promise(function (res) {
                            ksMsgSub_1 = onKeyMessage$(mediaKeySession).subscribe(res);
                        });
                        sleepProm = new Promise(function (res) {
                            sleepTimer_1 = window.setTimeout(res, delay_1);
                        });
                        return [4 /*yield*/, Promise.race([ksChangeProm, ksMsgProm, sleepProm])];
                    case 4:
                        _b.sent();
                        ksChangeSub_1 === null || ksChangeSub_1 === void 0 ? void 0 : ksChangeSub_1.unsubscribe();
                        ksMsgSub_1 === null || ksMsgSub_1 === void 0 ? void 0 : ksMsgSub_1.unsubscribe();
                        clearTimeout(sleepTimer_1);
                        return [2 /*return*/, recursivelyTryToCloseMediaKeySession(nextRetryNb)];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    /**
     * Log error anouncing that we could not close the MediaKeySession and emits
     * then complete through Observable.
     * TODO Emit warning?
     * @returns {Observable}
     */
    function failToCloseSession(err) {
        log.error("DRM: Could not close MediaKeySession: " +
            (err instanceof Error ? err.toString() :
                "Unknown error"));
        return Promise.resolve(null);
    }
}
