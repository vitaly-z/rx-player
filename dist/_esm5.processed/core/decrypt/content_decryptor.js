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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { events, getInitData, } from "../../compat/";
import config from "../../config";
import { EncryptedMediaError, OtherError, } from "../../errors";
import log from "../../log";
import areArraysOfNumbersEqual from "../../utils/are_arrays_of_numbers_equal";
import arrayFind from "../../utils/array_find";
import arrayIncludes from "../../utils/array_includes";
import EventEmitter from "../../utils/event_emitter";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import { bytesToHex } from "../../utils/string_parsing";
import TaskCanceller from "../../utils/task_canceller";
import attachMediaKeys from "./attach_media_keys";
import createOrLoadSession from "./create_or_load_session";
import initMediaKeys from "./init_media_keys";
import SessionEventsListener, { BlacklistedSessionError, } from "./session_events_listener";
import setServerCertificate from "./set_server_certificate";
import { DecommissionedSessionError } from "./utils/check_key_statuses";
import cleanOldStoredPersistentInfo from "./utils/clean_old_stored_persistent_info";
import getDrmSystemId from "./utils/get_drm_system_id";
import InitDataValuesContainer from "./utils/init_data_values_container";
import { areAllKeyIdsContainedIn, areKeyIdsEqual, areSomeKeyIdsContainedIn, isKeyIdContainedIn, } from "./utils/key_id_comparison";
var onEncrypted$ = events.onEncrypted$;
/**
 * Module communicating with the Content Decryption Module (or CDM) to be able
 * to decrypt contents.
 *
 * The `ContentDecryptor` starts communicating with the CDM, to initialize the
 * key system, as soon as it is created.
 *
 * You can be notified of various events, such as fatal errors, by registering
 * to one of its multiple events (@see IContentDecryptorEvent).
 *
 * @class ContentDecryptor
 */
var ContentDecryptor = /** @class */ (function (_super) {
    __extends(ContentDecryptor, _super);
    /**
     * Create a new `ContentDecryptor`, and initialize its decryption capabilities
     * right away.
     * Goes into the `WaitingForAttachment` state once that initialization is
     * done, after which you should call the `attach` method when you're ready for
     * those decryption capabilities to be attached to the HTMLMediaElement.
     *
     * @param {HTMLMediaElement} mediaElement - The MediaElement which will be
     * associated to a MediaKeys object
     * @param {Array.<Object>} ksOptions - key system configuration.
     * The `ContentDecryptor` can be given one or multiple key system
     * configurations. It will choose the appropriate one depending on user
     * settings and browser support.
     */
    function ContentDecryptor(mediaElement, ksOptions) {
        var _this = _super.call(this) || this;
        log.debug("DRM: Starting ContentDecryptor logic.");
        var canceller = new TaskCanceller();
        _this._currentSessions = [];
        _this._canceller = canceller;
        _this._wasAttachCalled = false;
        _this._initDataQueue = [];
        _this._stateData = { state: ContentDecryptorState.Initializing,
            isMediaKeysAttached: false,
            isInitDataQueueLocked: true,
            data: null };
        _this.error = null;
        var listenerSub = onEncrypted$(mediaElement).subscribe(function (evt) {
            log.debug("DRM: Encrypted event received from media element.");
            var initData = getInitData(evt);
            if (initData !== null) {
                _this.onInitializationData(initData);
            }
        });
        canceller.signal.register(function () {
            listenerSub.unsubscribe();
        });
        initMediaKeys(mediaElement, ksOptions, canceller.signal)
            .then(function (mediaKeysInfo) {
            var options = mediaKeysInfo.options, mediaKeySystemAccess = mediaKeysInfo.mediaKeySystemAccess;
            /**
             * String identifying the key system, allowing the rest of the code to
             * only advertise the required initialization data for license requests.
             *
             * Note that we only set this value if retro-compatibility to older
             * persistent logic in the RxPlayer is not important, as the
             * optimizations this property unlocks can break the loading of
             * MediaKeySessions persisted in older RxPlayer's versions.
             */
            var systemId;
            if (isNullOrUndefined(options.licenseStorage) ||
                options.licenseStorage.disableRetroCompatibility === true) {
                systemId = getDrmSystemId(mediaKeySystemAccess.keySystem);
            }
            _this.systemId = systemId;
            if (_this._stateData.state === ContentDecryptorState.Initializing) {
                _this._stateData = { state: ContentDecryptorState.WaitingForAttachment,
                    isInitDataQueueLocked: true,
                    isMediaKeysAttached: false,
                    data: { mediaKeysInfo: mediaKeysInfo, mediaElement: mediaElement } };
                _this.trigger("stateChange", _this._stateData.state);
            }
        })
            .catch(function (err) {
            _this._onFatalError(err);
        });
        return _this;
    }
    /**
     * Returns the current state of the ContentDecryptor.
     * @see ContentDecryptorState
     * @returns {Object}
     */
    ContentDecryptor.prototype.getState = function () {
        return this._stateData.state;
    };
    /**
     * Attach the current decryption capabilities to the HTMLMediaElement.
     * This method should only be called once the `ContentDecryptor` is in the
     * `WaitingForAttachment` state.
     *
     * You might want to first set the HTMLMediaElement's `src` attribute before
     * calling this method, and only push data to it once the `ReadyForContent`
     * state is reached, for compatibility reasons.
     */
    ContentDecryptor.prototype.attach = function () {
        var _this = this;
        if (this._stateData.state !== ContentDecryptorState.WaitingForAttachment) {
            throw new Error("`attach` should only be called when " +
                "in the WaitingForAttachment state");
        }
        else if (this._wasAttachCalled) {
            log.warn("DRM: ContentDecryptor's `attach` method called more than once.");
            return;
        }
        this._wasAttachCalled = true;
        var _a = this._stateData.data, mediaElement = _a.mediaElement, mediaKeysInfo = _a.mediaKeysInfo;
        var options = mediaKeysInfo.options, mediaKeys = mediaKeysInfo.mediaKeys, mediaKeySystemAccess = mediaKeysInfo.mediaKeySystemAccess, stores = mediaKeysInfo.stores;
        var stateToAttatch = { loadedSessionsStore: stores.loadedSessionsStore, mediaKeySystemAccess: mediaKeySystemAccess, mediaKeys: mediaKeys, keySystemOptions: options };
        var shouldDisableLock = options.disableMediaKeysAttachmentLock === true;
        if (shouldDisableLock) {
            this._stateData = { state: ContentDecryptorState.ReadyForContent,
                isInitDataQueueLocked: true,
                isMediaKeysAttached: false,
                data: null };
            this.trigger("stateChange", this._stateData.state);
            if (this._isStopped()) { // previous trigger might have lead to disposal
                return;
            }
        }
        log.debug("DRM: Attaching current MediaKeys");
        attachMediaKeys(mediaElement, stateToAttatch, this._canceller.signal)
            .then(function () { return __awaiter(_this, void 0, void 0, function () {
            var serverCertificate, resSsc, prevState;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        serverCertificate = options.serverCertificate;
                        if (!!isNullOrUndefined(serverCertificate)) return [3 /*break*/, 2];
                        return [4 /*yield*/, setServerCertificate(mediaKeys, serverCertificate)];
                    case 1:
                        resSsc = _a.sent();
                        if (resSsc.type === "error") {
                            this.trigger("warning", resSsc.value);
                        }
                        _a.label = 2;
                    case 2:
                        if (this._isStopped()) { // We might be stopped since then
                            return [2 /*return*/];
                        }
                        prevState = this._stateData.state;
                        this._stateData = { state: ContentDecryptorState.ReadyForContent,
                            isMediaKeysAttached: true,
                            isInitDataQueueLocked: false,
                            data: { mediaKeysData: mediaKeysInfo } };
                        if (prevState !== ContentDecryptorState.ReadyForContent) {
                            this.trigger("stateChange", ContentDecryptorState.ReadyForContent);
                        }
                        if (!this._isStopped()) {
                            this._processCurrentInitDataQueue();
                        }
                        return [2 /*return*/];
                }
            });
        }); })
            .catch(function (err) {
            _this._onFatalError(err);
        });
    };
    /**
     * Stop this `ContentDecryptor` instance:
     *   - stop listening and reacting to the various event listeners
     *   - abort all operations.
     *
     * Once disposed, a `ContentDecryptor` cannot be used anymore.
     */
    ContentDecryptor.prototype.dispose = function () {
        this.removeEventListener();
        this._stateData = { state: ContentDecryptorState.Disposed,
            isMediaKeysAttached: undefined,
            isInitDataQueueLocked: undefined,
            data: null };
        this._canceller.cancel();
        this.trigger("stateChange", this._stateData.state);
    };
    /**
     * Method to call when new protection initialization data is encounted on the
     * content.
     *
     * When called, the `ContentDecryptor` will try to obtain the decryption key
     * if not already obtained.
     *
     * @param {Object} initializationData
     */
    ContentDecryptor.prototype.onInitializationData = function (initializationData) {
        var _this = this;
        if (this._stateData.isInitDataQueueLocked !== false) {
            if (this._isStopped()) {
                throw new Error("ContentDecryptor either disposed or stopped.");
            }
            this._initDataQueue.push(initializationData);
            return;
        }
        var mediaKeysData = this._stateData.data.mediaKeysData;
        var processedInitializationData = __assign(__assign({}, initializationData), { values: new InitDataValuesContainer(initializationData.values) });
        this._processInitializationData(processedInitializationData, mediaKeysData)
            .catch(function (err) { _this._onFatalError(err); });
    };
    /**
     * Async logic run each time new initialization data has to be processed.
     * The promise return may reject, in which case a fatal error should be linked
     * the current `ContentDecryptor`.
     *
     * The Promise's resolution however provides no semantic value.
     * @param {Object} initializationData
     * @returns {Promise.<void>}
     */
    ContentDecryptor.prototype._processInitializationData = function (initializationData, mediaKeysData) {
        return __awaiter(this, void 0, void 0, function () {
            var mediaKeySystemAccess, stores, options, firstCreatedSession, keyIds, hexKids, period, createdSessions, periodKeys, _i, createdSessions_1, createdSess, periodKeysArr, _a, periodKeysArr_1, kid, _b, periodKeysArr_2, innerKid, wantedSessionType, _c, EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS, EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION, maxSessionCacheSize, sessionRes, sessionInfo, _d, mediaKeySession, sessionType, isSessionPersisted, sub, requestData, error_1, entry, indexInCurrent;
            var _this = this;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        mediaKeySystemAccess = mediaKeysData.mediaKeySystemAccess, stores = mediaKeysData.stores, options = mediaKeysData.options;
                        if (this._tryToUseAlreadyCreatedSession(initializationData, mediaKeysData) ||
                            this._isStopped()) // _isStopped is voluntarly checked after here
                         {
                            return [2 /*return*/];
                        }
                        if (options.singleLicensePer === "content") {
                            firstCreatedSession = arrayFind(this._currentSessions, function (x) {
                                return x.source === "created-session" /* MediaKeySessionLoadingType.Created */;
                            });
                            if (firstCreatedSession !== undefined) {
                                keyIds = initializationData.keyIds;
                                if (keyIds === undefined) {
                                    if (initializationData.content === undefined) {
                                        log.warn("DRM: Unable to fallback from a non-decipherable quality.");
                                    }
                                    else {
                                        blackListProtectionData(initializationData.content.manifest, initializationData);
                                    }
                                    return [2 /*return*/];
                                }
                                firstCreatedSession.record.associateKeyIds(keyIds);
                                if (initializationData.content !== undefined) {
                                    if (log.hasLevel("DEBUG")) {
                                        hexKids = keyIds
                                            .reduce(function (acc, kid) { return "".concat(acc, ", ").concat(bytesToHex(kid)); }, "");
                                        log.debug("DRM: Blacklisting new key ids", hexKids);
                                    }
                                    updateDecipherability(initializationData.content.manifest, [], keyIds, []);
                                }
                                return [2 /*return*/];
                            }
                        }
                        else if (options.singleLicensePer === "periods" &&
                            initializationData.content !== undefined) {
                            period = initializationData.content.period;
                            createdSessions = this._currentSessions
                                .filter(function (x) { return x.source === "created-session" /* MediaKeySessionLoadingType.Created */; });
                            periodKeys = new Set();
                            addKeyIdsFromPeriod(periodKeys, period);
                            for (_i = 0, createdSessions_1 = createdSessions; _i < createdSessions_1.length; _i++) {
                                createdSess = createdSessions_1[_i];
                                periodKeysArr = Array.from(periodKeys);
                                for (_a = 0, periodKeysArr_1 = periodKeysArr; _a < periodKeysArr_1.length; _a++) {
                                    kid = periodKeysArr_1[_a];
                                    if (createdSess.record.isAssociatedWithKeyId(kid)) {
                                        createdSess.record.associateKeyIds(periodKeys.values());
                                        // Re-loop through the Period's key ids to blacklist ones that are missing
                                        // from `createdSess`'s `keyStatuses` and to update the content's
                                        // decipherability.
                                        for (_b = 0, periodKeysArr_2 = periodKeysArr; _b < periodKeysArr_2.length; _b++) {
                                            innerKid = periodKeysArr_2[_b];
                                            if (!isKeyIdContainedIn(innerKid, createdSess.keyStatuses.whitelisted) &&
                                                !isKeyIdContainedIn(innerKid, createdSess.keyStatuses.blacklisted)) {
                                                createdSess.keyStatuses.blacklisted.push(innerKid);
                                            }
                                        }
                                        updateDecipherability(initializationData.content.manifest, createdSess.keyStatuses.whitelisted, createdSess.keyStatuses.blacklisted, []);
                                        return [2 /*return*/];
                                    }
                                }
                            }
                        }
                        // /!\ Do not forget to unlock when done
                        // TODO this is error-prone and can lead to performance issue when loading
                        // persistent sessions.
                        // Can we find a better strategy?
                        this._lockInitDataQueue();
                        if (options.persistentLicense !== true) {
                            wantedSessionType = "temporary";
                        }
                        else if (!canCreatePersistentSession(mediaKeySystemAccess)) {
                            log.warn("DRM: Cannot create \"persistent-license\" session: not supported");
                            wantedSessionType = "temporary";
                        }
                        else {
                            wantedSessionType = "persistent-license";
                        }
                        _c = config.getCurrent(), EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS = _c.EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS, EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION = _c.EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION;
                        maxSessionCacheSize = typeof options.maxSessionCacheSize === "number" ?
                            options.maxSessionCacheSize :
                            EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS;
                        return [4 /*yield*/, createOrLoadSession(initializationData, stores, wantedSessionType, maxSessionCacheSize, this._canceller.signal)];
                    case 1:
                        sessionRes = _e.sent();
                        if (this._isStopped()) {
                            return [2 /*return*/];
                        }
                        sessionInfo = {
                            record: sessionRes.value.keySessionRecord,
                            source: sessionRes.type,
                            keyStatuses: { whitelisted: [], blacklisted: [] },
                            blacklistedSessionError: null,
                        };
                        this._currentSessions.push(sessionInfo);
                        _d = sessionRes.value, mediaKeySession = _d.mediaKeySession, sessionType = _d.sessionType;
                        isSessionPersisted = false;
                        sub = SessionEventsListener(mediaKeySession, options, mediaKeySystemAccess.keySystem)
                            .subscribe({
                            next: function (evt) {
                                switch (evt.type) {
                                    case "warning":
                                        _this.trigger("warning", evt.value);
                                        return;
                                }
                                var linkedKeys = getKeyIdsLinkedToSession(initializationData, sessionInfo.record, options.singleLicensePer, sessionInfo.source === "created-session" /* MediaKeySessionLoadingType.Created */, evt.value.whitelistedKeyIds, evt.value.blacklistedKeyIds);
                                sessionInfo.record.associateKeyIds(linkedKeys.whitelisted);
                                sessionInfo.record.associateKeyIds(linkedKeys.blacklisted);
                                sessionInfo.keyStatuses = { whitelisted: linkedKeys.whitelisted,
                                    blacklisted: linkedKeys.blacklisted };
                                if (sessionInfo.record.getAssociatedKeyIds().length !== 0 &&
                                    sessionType === "persistent-license" &&
                                    stores.persistentSessionsStore !== null &&
                                    !isSessionPersisted) {
                                    var persistentSessionsStore = stores.persistentSessionsStore;
                                    cleanOldStoredPersistentInfo(persistentSessionsStore, EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION - 1);
                                    persistentSessionsStore.add(initializationData, sessionInfo.record.getAssociatedKeyIds(), mediaKeySession);
                                    isSessionPersisted = true;
                                }
                                if (initializationData.content !== undefined) {
                                    updateDecipherability(initializationData.content.manifest, linkedKeys.whitelisted, linkedKeys.blacklisted, []);
                                }
                                _this._unlockInitDataQueue();
                            },
                            error: function (err) {
                                var _a;
                                if (err instanceof DecommissionedSessionError) {
                                    log.warn("DRM: A session's closing condition has been triggered");
                                    _this._lockInitDataQueue();
                                    var indexOf = _this._currentSessions.indexOf(sessionInfo);
                                    if (indexOf >= 0) {
                                        _this._currentSessions.splice(indexOf);
                                    }
                                    if (initializationData.content !== undefined) {
                                        updateDecipherability(initializationData.content.manifest, [], [], sessionInfo.record.getAssociatedKeyIds());
                                    }
                                    (_a = stores.persistentSessionsStore) === null || _a === void 0 ? void 0 : _a.delete(mediaKeySession.sessionId);
                                    stores.loadedSessionsStore.closeSession(mediaKeySession)
                                        .catch(function (e) {
                                        var closeError = e instanceof Error ? e :
                                            "unknown error";
                                        log.warn("DRM: failed to close expired session", closeError);
                                    })
                                        .then(function () { return _this._unlockInitDataQueue(); })
                                        .catch(function (retryError) { return _this._onFatalError(retryError); });
                                    if (!_this._isStopped()) {
                                        _this.trigger("warning", err.reason);
                                    }
                                    return;
                                }
                                if (!(err instanceof BlacklistedSessionError)) {
                                    _this._onFatalError(err);
                                    return;
                                }
                                sessionInfo.blacklistedSessionError = err;
                                if (initializationData.content !== undefined) {
                                    var manifest = initializationData.content.manifest;
                                    log.info("DRM: blacklisting Representations based on " +
                                        "protection data.");
                                    blackListProtectionData(manifest, initializationData);
                                }
                                _this._unlockInitDataQueue();
                                // TODO warning for blacklisted session?
                            },
                        });
                        this._canceller.signal.register(function () {
                            sub.unsubscribe();
                        });
                        if (options.singleLicensePer === undefined ||
                            options.singleLicensePer === "init-data") {
                            this._unlockInitDataQueue();
                        }
                        if (!(sessionRes.type === "created-session" /* MediaKeySessionLoadingType.Created */)) return [3 /*break*/, 5];
                        requestData = initializationData.values.constructRequestData();
                        _e.label = 2;
                    case 2:
                        _e.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, stores.loadedSessionsStore.generateLicenseRequest(mediaKeySession, initializationData.type, requestData)];
                    case 3:
                        _e.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _e.sent();
                        entry = stores.loadedSessionsStore.getEntryForSession(mediaKeySession);
                        if (entry === null || entry.closingStatus.type !== "none") {
                            indexInCurrent = this._currentSessions.indexOf(sessionInfo);
                            if (indexInCurrent >= 0) {
                                this._currentSessions.splice(indexInCurrent, 1);
                            }
                            return [2 /*return*/, Promise.resolve()];
                        }
                        throw new EncryptedMediaError("KEY_GENERATE_REQUEST_ERROR", error_1 instanceof Error ? error_1.toString() :
                            "Unknown error");
                    case 5: return [2 /*return*/, Promise.resolve()];
                }
            });
        });
    };
    ContentDecryptor.prototype._tryToUseAlreadyCreatedSession = function (initializationData, mediaKeysData) {
        var stores = mediaKeysData.stores, options = mediaKeysData.options;
        /**
         * If set, a currently-used key session is already compatible to this
         * initialization data.
         */
        var compatibleSessionInfo = arrayFind(this._currentSessions, function (x) { return x.record.isCompatibleWith(initializationData); });
        if (compatibleSessionInfo === undefined) {
            return false;
        }
        // Check if the compatible session is blacklisted
        var blacklistedSessionError = compatibleSessionInfo.blacklistedSessionError;
        if (!isNullOrUndefined(blacklistedSessionError)) {
            if (initializationData.type === undefined ||
                initializationData.content === undefined) {
                log.error("DRM: This initialization data has already been blacklisted " +
                    "but the current content is not known.");
                return true;
            }
            else {
                log.info("DRM: This initialization data has already been blacklisted. " +
                    "Blacklisting the related content.");
                var manifest = initializationData.content.manifest;
                blackListProtectionData(manifest, initializationData);
                return true;
            }
        }
        // Check if the current key id(s) has been blacklisted by this session
        if (initializationData.keyIds !== undefined) {
            /**
             * If set to `true`, the Representation(s) linked to this
             * initialization data's key id should be marked as "not decipherable".
             */
            var isUndecipherable = void 0;
            if (options.singleLicensePer === undefined ||
                options.singleLicensePer === "init-data") {
                // Note: In the default "init-data" mode, we only avoid a
                // Representation if the key id was originally explicitely
                // blacklisted (and not e.g. if its key was just not present in
                // the license).
                //
                // This is to enforce v3.x.x retro-compatibility: we cannot
                // fallback from a Representation unless some RxPlayer option
                // documentating this behavior has been set.
                var blacklisted = compatibleSessionInfo.keyStatuses.blacklisted;
                isUndecipherable = areSomeKeyIdsContainedIn(initializationData.keyIds, blacklisted);
            }
            else {
                // In any other mode, as soon as not all of this initialization
                // data's linked key ids are explicitely whitelisted, we can mark
                // the corresponding Representation as "not decipherable".
                // This is because we've no such retro-compatibility guarantee to
                // make there.
                var whitelisted = compatibleSessionInfo.keyStatuses.whitelisted;
                isUndecipherable = !areAllKeyIdsContainedIn(initializationData.keyIds, whitelisted);
            }
            if (isUndecipherable) {
                if (initializationData.content === undefined) {
                    log.error("DRM: Cannot forbid key id, the content is unknown.");
                    return true;
                }
                log.info("DRM: Current initialization data is linked to blacklisted keys. " +
                    "Marking Representations as not decipherable");
                updateDecipherability(initializationData.content.manifest, [], initializationData.keyIds, []);
                return true;
            }
        }
        // If we reached here, it means that this initialization data is not
        // blacklisted in any way.
        // Search loaded session and put it on top of the cache if it exists.
        var entry = stores.loadedSessionsStore.reuse(initializationData);
        if (entry !== null) {
            // TODO update decipherability to `true` if not?
            log.debug("DRM: Init data already processed. Skipping it.");
            return true;
        }
        // Session not found in `loadedSessionsStore`, it might have been closed
        // since.
        // Remove from `this._currentSessions` and start again.
        var indexOf = this._currentSessions.indexOf(compatibleSessionInfo);
        if (indexOf === -1) {
            log.error("DRM: Unable to remove processed init data: not found.");
        }
        else {
            log.debug("DRM: A session from a processed init data is not available " +
                "anymore. Re-processing it.");
            this._currentSessions.splice(indexOf, 1);
        }
        return false;
    };
    /**
     * Callback that should be called if an error that made the current
     * `ContentDecryptor` instance unusable arised.
     * This callbacks takes care of resetting state and sending the right events.
     *
     * Once called, no further actions should be taken.
     *
     * @param {*} err - The error object which describes the issue. Will be
     * formatted and sent in an "error" event.
     */
    ContentDecryptor.prototype._onFatalError = function (err) {
        if (this._canceller.isUsed) {
            return;
        }
        var formattedErr = err instanceof Error ?
            err :
            new OtherError("NONE", "Unknown decryption error");
        this.error = formattedErr;
        this._initDataQueue.length = 0;
        this._stateData = { state: ContentDecryptorState.Error,
            isMediaKeysAttached: undefined,
            isInitDataQueueLocked: undefined,
            data: null };
        this._canceller.cancel();
        this.trigger("error", formattedErr);
        // The previous trigger might have lead to a disposal of the `ContentDecryptor`.
        if (this._stateData.state === ContentDecryptorState.Error) {
            this.trigger("stateChange", this._stateData.state);
        }
    };
    /**
     * Return `true` if the `ContentDecryptor` has either been disposed or
     * encountered a fatal error which made it stop.
     * @returns {boolean}
     */
    ContentDecryptor.prototype._isStopped = function () {
        return this._stateData.state === ContentDecryptorState.Disposed ||
            this._stateData.state === ContentDecryptorState.Error;
    };
    /**
     * Start processing the next initialization data of the `_initDataQueue` if it
     * isn't lock.
     */
    ContentDecryptor.prototype._processCurrentInitDataQueue = function () {
        while (this._stateData.isInitDataQueueLocked === false) {
            var initData = this._initDataQueue.shift();
            if (initData === undefined) {
                return;
            }
            this.onInitializationData(initData);
        }
    };
    /**
     * Lock new initialization data (from the `_initDataQueue`) from being
     * processed until `_unlockInitDataQueue` is called.
     *
     * You may want to call this method when performing operations which may have
     * an impact on the handling of other initialization data.
     */
    ContentDecryptor.prototype._lockInitDataQueue = function () {
        if (this._stateData.isInitDataQueueLocked === false) {
            this._stateData.isInitDataQueueLocked = true;
        }
    };
    /**
     * Unlock `_initDataQueue` and start processing the first element.
     *
     * Should have no effect if the `_initDataQueue` was not locked.
     */
    ContentDecryptor.prototype._unlockInitDataQueue = function () {
        if (this._stateData.isMediaKeysAttached !== true) {
            log.error("DRM: Trying to unlock in the wrong state");
            return;
        }
        this._stateData.isInitDataQueueLocked = false;
        this._processCurrentInitDataQueue();
    };
    return ContentDecryptor;
}(EventEmitter));
export default ContentDecryptor;
/**
 * Returns `true` if the given MediaKeySystemAccess can create
 * "persistent-license" MediaKeySessions.
 * @param {MediaKeySystemAccess} mediaKeySystemAccess
 * @returns {Boolean}
 */
function canCreatePersistentSession(mediaKeySystemAccess) {
    var sessionTypes = mediaKeySystemAccess.getConfiguration().sessionTypes;
    return sessionTypes !== undefined &&
        arrayIncludes(sessionTypes, "persistent-license");
}
/**
 * Change the decipherability of Representations which have their key id in one
 * of the given Arrays:
 *
 *   - Those who have a key id listed in `whitelistedKeyIds` will have their
 *     decipherability updated to `true`
 *
 *   - Those who have a key id listed in `blacklistedKeyIds` will have their
 *     decipherability updated to `false`
 *
 *   - Those who have a key id listed in `delistedKeyIds` will have their
 *     decipherability updated to `undefined`.
 *
 * @param {Object} manifest
 * @param {Array.<Uint8Array>} whitelistedKeyIds
 * @param {Array.<Uint8Array>} blacklistedKeyIds
 * @param {Array.<Uint8Array>} delistedKeyIds
 */
function updateDecipherability(manifest, whitelistedKeyIds, blacklistedKeyIds, delistedKeyIds) {
    manifest.updateRepresentationsDeciperability(function (representation) {
        if (representation.contentProtections === undefined) {
            return representation.decipherable;
        }
        var contentKIDs = representation.contentProtections.keyIds;
        if (contentKIDs !== undefined) {
            for (var i = 0; i < contentKIDs.length; i++) {
                var elt = contentKIDs[i];
                for (var j = 0; j < blacklistedKeyIds.length; j++) {
                    if (areKeyIdsEqual(blacklistedKeyIds[j], elt.keyId)) {
                        return false;
                    }
                }
                for (var j = 0; j < whitelistedKeyIds.length; j++) {
                    if (areKeyIdsEqual(whitelistedKeyIds[j], elt.keyId)) {
                        return true;
                    }
                }
                for (var j = 0; j < delistedKeyIds.length; j++) {
                    if (areKeyIdsEqual(delistedKeyIds[j], elt.keyId)) {
                        return undefined;
                    }
                }
            }
        }
        return representation.decipherable;
    });
}
/**
 * Update decipherability to `false` to any Representation which is linked to
 * the given initialization data.
 * @param {Object} manifest
 * @param {Object} initData
 */
function blackListProtectionData(manifest, initData) {
    manifest.updateRepresentationsDeciperability(function (representation) {
        var _a, _b;
        if (representation.decipherable === false) {
            return false;
        }
        var segmentProtections = (_b = (_a = representation.contentProtections) === null || _a === void 0 ? void 0 : _a.initData) !== null && _b !== void 0 ? _b : [];
        var _loop_1 = function (i) {
            if (initData.type === undefined ||
                segmentProtections[i].type === initData.type) {
                var containedInitData = initData.values.getFormattedValues()
                    .every(function (undecipherableVal) {
                    return segmentProtections[i].values.some(function (currVal) {
                        return (undecipherableVal.systemId === undefined ||
                            currVal.systemId === undecipherableVal.systemId) &&
                            areArraysOfNumbersEqual(currVal.data, undecipherableVal.data);
                    });
                });
                if (containedInitData) {
                    return { value: false };
                }
            }
        };
        for (var i = 0; i < segmentProtections.length; i++) {
            var state_1 = _loop_1(i);
            if (typeof state_1 === "object")
                return state_1.value;
        }
        return representation.decipherable;
    });
}
/** Enumeration of the various "state" the `ContentDecryptor` can be in. */
export var ContentDecryptorState;
(function (ContentDecryptorState) {
    /**
     * The `ContentDecryptor` is not yet ready to create key sessions and request
     * licenses.
     * This is is the initial state of the ContentDecryptor.
     */
    ContentDecryptorState[ContentDecryptorState["Initializing"] = 0] = "Initializing";
    /**
     * The `ContentDecryptor` has been initialized.
     * You should now called the `attach` method when you want to add decryption
     * capabilities to the HTMLMediaElement. The ContentDecryptor won't go to the
     * `ReadyForContent` state until `attach` is called.
     *
     * For compatibility reasons, this should be done after the HTMLMediaElement's
     * src attribute is set.
     *
     * It is also from when this state is reached that the `ContentDecryptor`'s
     * `systemId` property may be known.
     *
     * This state is always coming after the `Initializing` state.
     */
    ContentDecryptorState[ContentDecryptorState["WaitingForAttachment"] = 1] = "WaitingForAttachment";
    /**
     * Content (encrypted or not) can begin to be pushed on the HTMLMediaElement
     * (this state was needed because some browser quirks sometimes forces us to
     * call EME API before this can be done).
     *
     * This state is always coming after the `WaitingForAttachment` state.
     */
    ContentDecryptorState[ContentDecryptorState["ReadyForContent"] = 2] = "ReadyForContent";
    /**
     * The `ContentDecryptor` has encountered a fatal error and has been stopped.
     * It is now unusable.
     */
    ContentDecryptorState[ContentDecryptorState["Error"] = 3] = "Error";
    /** The `ContentDecryptor` has been disposed of and is now unusable. */
    ContentDecryptorState[ContentDecryptorState["Disposed"] = 4] = "Disposed";
})(ContentDecryptorState || (ContentDecryptorState = {}));
/**
 * Returns set of all usable and unusable keys - explicit or implicit - that are
 * linked to a `MediaKeySession`.
 *
 * In the RxPlayer, there is a concept of "explicit" key ids, which are key ids
 * found in a license whose status can be known through the `keyStatuses`
 * property from a `MediaKeySession`, and of "implicit" key ids, which are key
 * ids which were expected to be in a fetched license, but apparently weren't.
 *
 * @param {Object} initializationData - Initialization data object used to make
 * the request for the current license.
 * @param {Object} keySessionRecord - The `KeySessionRecord` associated with the
 * session that has been loaded. It might give supplementary information on
 * keys implicitly linked to the license.
 * @param {string|undefined} singleLicensePer - Setting allowing to indicate the
 * scope a given license should have.
 * @param {boolean} isCurrentLicense - If `true` the license has been fetched
 * especially for the current content.
 *
 * Knowing this allows to determine that if decryption keys that should have
 * been referenced in the fetched license (according to the `singleLicensePer`
 * setting) are missing, then the keys surely must have been voluntarly
 * removed from the license.
 *
 * If it is however set to `false`, it means that the license is an older
 * license that might have been linked to another content, thus we cannot make
 * that assumption.
 * @param {Array.<Uint8Array>} usableKeyIds - Key ids that are present in the
 * license and can be used.
 * @param {Array.<Uint8Array>} unusableKeyIds - Key ids that are present in the
 * license yet cannot be used.
 * @returns {Object} - Returns an object with the following properties:
 *   - `whitelisted`: Array of key ids for keys that are known to be usable
 *   - `blacklisted`: Array of key ids for keys that are considered unusable.
 *     The qualities linked to those keys should not be played.
 */
function getKeyIdsLinkedToSession(initializationData, keySessionRecord, singleLicensePer, isCurrentLicense, usableKeyIds, unusableKeyIds) {
    var _a;
    /**
     * Every key id associated with the MediaKeySession, starting with
     * whitelisted ones.
     */
    var associatedKeyIds = __spreadArray(__spreadArray([], usableKeyIds, true), unusableKeyIds, true);
    // Add all key ids associated to the `KeySessionRecord` yet not in
    // `usableKeyIds` nor in `unusableKeyIds`
    var allKnownKeyIds = keySessionRecord.getAssociatedKeyIds();
    var _loop_2 = function (kid) {
        if (!associatedKeyIds.some(function (ak) { return areKeyIdsEqual(ak, kid); })) {
            if (log.hasLevel("DEBUG")) {
                log.debug("DRM: KeySessionRecord's key missing in the license, blacklisting it", bytesToHex(kid));
            }
            associatedKeyIds.push(kid);
        }
    };
    for (var _i = 0, allKnownKeyIds_1 = allKnownKeyIds; _i < allKnownKeyIds_1.length; _i++) {
        var kid = allKnownKeyIds_1[_i];
        _loop_2(kid);
    }
    if (singleLicensePer !== undefined && singleLicensePer !== "init-data") {
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
        var expectedKeyIds = initializationData.keyIds, content = initializationData.content;
        if (expectedKeyIds !== undefined) {
            var missingKeyIds = expectedKeyIds.filter(function (expected) {
                return !associatedKeyIds.some(function (k) { return areKeyIdsEqual(k, expected); });
            });
            if (missingKeyIds.length > 0) {
                if (log.hasLevel("DEBUG")) {
                    log.debug("DRM: init data keys missing in the license, blacklisting them", missingKeyIds.map(function (m) { return bytesToHex(m); }).join(", "));
                }
                associatedKeyIds.push.apply(associatedKeyIds, missingKeyIds);
            }
        }
        if (isCurrentLicense && content !== undefined) {
            if (singleLicensePer === "content") {
                // Put it in a Set to automatically filter out duplicates (by ref)
                var contentKeys = new Set();
                var manifest = content.manifest;
                for (var _b = 0, _c = manifest.periods; _b < _c.length; _b++) {
                    var period = _c[_b];
                    addKeyIdsFromPeriod(contentKeys, period);
                }
                mergeKeyIdSetIntoArray(contentKeys, associatedKeyIds);
            }
            else if (singleLicensePer === "periods") {
                var manifest = content.manifest;
                for (var _d = 0, _e = manifest.periods; _d < _e.length; _d++) {
                    var period = _e[_d];
                    var periodKeys = new Set();
                    addKeyIdsFromPeriod(periodKeys, period);
                    if (((_a = initializationData.content) === null || _a === void 0 ? void 0 : _a.period.id) === period.id) {
                        mergeKeyIdSetIntoArray(periodKeys, associatedKeyIds);
                    }
                    else {
                        var periodKeysArr = Array.from(periodKeys);
                        var _loop_3 = function (kid) {
                            var isFound = associatedKeyIds.some(function (k) { return areKeyIdsEqual(k, kid); });
                            if (isFound) {
                                mergeKeyIdSetIntoArray(periodKeys, associatedKeyIds);
                                return "break";
                            }
                        };
                        for (var _f = 0, periodKeysArr_3 = periodKeysArr; _f < periodKeysArr_3.length; _f++) {
                            var kid = periodKeysArr_3[_f];
                            var state_2 = _loop_3(kid);
                            if (state_2 === "break")
                                break;
                        }
                    }
                }
            }
        }
    }
    return { whitelisted: usableKeyIds,
        /** associatedKeyIds starts with the whitelisted one. */
        blacklisted: associatedKeyIds.slice(usableKeyIds.length) };
}
/**
 * Push all kei ids in the given `set` and add it to the `arr` Array only if it
 * isn't already present in it.
 * @param {Set.<Uint8Array>} set
 * @param {Array.<Uint8Array>} arr
 */
function mergeKeyIdSetIntoArray(set, arr) {
    var setArr = Array.from(set.values());
    var _loop_4 = function (kid) {
        var isFound = arr.some(function (k) { return areKeyIdsEqual(k, kid); });
        if (!isFound) {
            arr.push(kid);
        }
    };
    for (var _i = 0, setArr_1 = setArr; _i < setArr_1.length; _i++) {
        var kid = setArr_1[_i];
        _loop_4(kid);
    }
}
/**
 * Add to the given `set` all key ids found in the given `Period`.
 * @param {Set.<Uint8Array>} set
 * @param {Object} period
 */
function addKeyIdsFromPeriod(set, period) {
    for (var _i = 0, _a = period.getAdaptations(); _i < _a.length; _i++) {
        var adaptation = _a[_i];
        for (var _b = 0, _c = adaptation.representations; _b < _c.length; _b++) {
            var representation = _c[_b];
            if (representation.contentProtections !== undefined &&
                representation.contentProtections.keyIds !== undefined) {
                for (var _d = 0, _e = representation.contentProtections.keyIds; _d < _e.length; _d++) {
                    var kidInf = _e[_d];
                    set.add(kidInf.keyId);
                }
            }
        }
    }
}
