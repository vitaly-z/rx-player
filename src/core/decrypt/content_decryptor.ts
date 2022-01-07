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
  events,
  generateKeyRequest,
  getInitData,
  ICustomMediaKeySystemAccess,
} from "../../compat/";
import config from "../../config";
import {
  EncryptedMediaError,
  ICustomError,
  OtherError,
} from "../../errors";
import log from "../../log";
import arrayFind from "../../utils/array_find";
import arrayIncludes from "../../utils/array_includes";
import { concat } from "../../utils/byte_parsing";
import EventEmitter from "../../utils/event_emitter";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import createSharedReference, {
  ISharedReference,
} from "../../utils/reference";
import TaskCanceller from "../../utils/task_canceller";
import attachMediaKeys from "./attach_media_keys";
import cleanOldStoredPersistentInfo from "./clean_old_stored_persistent_info";
import getDrmSystemId from "./get_drm_system_id";
import { IMediaKeysInfos } from "./get_media_keys";
import createOrLoadSession from "./get_session";
import initMediaKeys from "./init_media_keys";
import SessionEventsListener, {
  BlacklistedSessionError,
} from "./session_events_listener";
import setServerCertificate from "./set_server_certificate";
import {
  IAttachedMediaKeysData,
  IInitializationDataInfo,
  IKeySystemOption,
  IKeyUpdateValue,
  MediaKeySessionLoadingType,
} from "./types";
import KeySessionRecord, {
  areAllKeyIdContainedIn,
  areSomeKeyIdContainedIn,
} from "./utils/processed_init_data_record";

const { EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS,
        EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION } = config;

const { onEncrypted$ } = events;

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
export default class ContentDecryptor extends EventEmitter<IContentDecryptorEvent> {
  /**
   * Hexadecimal id identifying the currently-chosen key system.
   * `undefined` if not known or if the key system hasn't been initialized yet.
   *
   * When providing protection initialization data to the ContentDecryptor, you
   * may only provide those linked to that system id. You can also provide all
   * available protection initialization data, in which case it will be
   * automatically filtered.
   *
   * This `systemId` may only be known once the `ReadyForContent` state (@see
   * ContentDecryptorState) is reached, and even then, it may still be unknown,
   * in which case it will stay to `undefined`.
   */
  public systemId : string | undefined;

  /**
   * Set only if the `ContentDecryptor` failed on an error.
   * The corresponding Error.
   */
  public error : Error | null;

  /**
   * State of the ContentDecryptor (@see ContentDecryptorState) and associated
   * data.
   *
   * The ContentDecryptor goes into a series of steps as it is initializing.
   * This private property stores the current state and the potentially linked
   * data.
   */
  private _stateData : IContentDecryptorStateData;

  /**
   * Contains information about all key sessions loaded for this current
   * content.
   * This object is most notably used to check which keys are already obtained,
   * thus avoiding to perform new unnecessary license requests and CDM interactions.
   */
  private _currentSessions : IActiveSessionInfo[];

  /**
   * When `true`, wait before processing newly-received initialization data.
   *
   * In certain cases where licenses might contain multiple keys, we might want
   * to avoid loading multiple licenses with keys in common. Using this lock to
   * prevent multiple parallel license requests allows to prevent that situation
   * from happening.
   * TODO this way of doing-it is very error-prone for now. A more readable
   * solution has to be found.
   */
  private _initDataLock : ISharedReference<boolean>;

  /**
   * Allows to dispose the resources taken by the current instance of the
   * ContentDecryptor.
   */
  private _canceller : TaskCanceller;

  /**
   * `true` once the `attach` method has been called`.
   * Allows to avoid calling multiple times that function.
   */
  private _wasAttachCalled : boolean;

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
  constructor(mediaElement : HTMLMediaElement, ksOptions: IKeySystemOption[]) {
    super();
    log.debug("DRM: Starting ContentDecryptor logic.");

    const canceller = new TaskCanceller();
    this._currentSessions = [];
    this._initDataLock = createSharedReference<boolean>(false);
    this._canceller = canceller;
    this._wasAttachCalled = false;
    this._stateData = { state: ContentDecryptorState.Initializing,
                        data: { initDataQueue: [] } };
    this.error = null;

    const listenerSub = onEncrypted$(mediaElement).subscribe(evt => {
      log.debug("DRM: Encrypted event received from media element.");
      const initData = getInitData(evt);
      if (initData !== null) {
        this.onInitializationData(initData);
      }
    });
    canceller.signal.register(() => {
      listenerSub.unsubscribe();
    });

    initMediaKeys(mediaElement, ksOptions, canceller.signal)
      .then((mediaKeysInfo) => {
        const { options, mediaKeySystemAccess } = mediaKeysInfo;

        /**
         * String identifying the key system, allowing the rest of the code to
         * only advertise the required initialization data for license requests.
         *
         * Note that we only set this value if retro-compatibility to older
         * persistent logic in the RxPlayer is not important, as the
         * optimizations this property unlocks can break the loading of
         * MediaKeySessions persisted in older RxPlayer's versions.
         */
        let systemId : string | undefined;
        if (isNullOrUndefined(options.licenseStorage) ||
            options.licenseStorage.disableRetroCompatibility === true)
        {
          systemId = getDrmSystemId(mediaKeySystemAccess.keySystem);
        }

        this.systemId = systemId;
        if (this._stateData.state === ContentDecryptorState.Initializing) {
          const prevInitDataQueue = this._stateData.data.initDataQueue;
          this._stateData = { state: ContentDecryptorState.WaitingForAttachment,
                              data: { initDataQueue: prevInitDataQueue,
                                      mediaKeysInfo,
                                      mediaElement } };

          this.trigger("stateChange", this._stateData.state);
        }
      })

      .catch((err) => {
        this._onFatalError(err);
      });
  }

  /**
   * Returns the current state of the ContentDecryptor.
   * @see ContentDecryptorState
   * @returns {Object}
   */
  public getState() : ContentDecryptorState {
    return this._stateData.state;
  }

  /**
   * Attach the current decryption capabilities to the HTMLMediaElement.
   * This method should only be called once the `ContentDecryptor` is in the
   * `WaitingForAttachment` state.
   *
   * You might want to first set the HTMLMediaElement's `src` attribute before
   * calling this method, and only push data to it once the `ReadyForContent`
   * state is reached, for compatibility reasons.
   */
  public attach() : void {
    if (this._stateData.state !== ContentDecryptorState.WaitingForAttachment) {
      throw new Error("`attach` should only be called when " +
                      "in the WaitingForAttachment state");
    } else if (this._wasAttachCalled) {
      return;
    }
    this._wasAttachCalled = true;

    const { mediaElement, mediaKeysInfo } = this._stateData.data;
    const { options, mediaKeys, mediaKeySystemAccess, stores } = mediaKeysInfo;
    const stateToAttatch = { loadedSessionsStore: stores.loadedSessionsStore,
                             mediaKeySystemAccess,
                             mediaKeys,
                             keySystemOptions: options };

    const shouldDisableLock = options.disableMediaKeysAttachmentLock === true;
    if (shouldDisableLock) {
      const currentInitDataQueue = this._stateData.data.initDataQueue;
      this._stateData = { state: ContentDecryptorState.ReadyForContent,
                          data: { isAttached: false,
                                  initDataQueue: currentInitDataQueue } };
      this.trigger("stateChange", this._stateData.state);
      if (this._isStopped()) {
        return ;
      }
    }

    log.debug("DRM: Attaching current MediaKeys");
    attachMediaKeys(mediaElement, stateToAttatch, this._canceller.signal)
      .then(async () => {
        const { serverCertificate } = options;

        if (!isNullOrUndefined(serverCertificate)) {
          const resSsc = await setServerCertificate(mediaKeys, serverCertificate);
          if (typeof resSsc !== "boolean") {
            this.trigger("warning", resSsc.value);
          }
        }

        if (this._isStopped()) {
          return;
        }

        const prevState = this._stateData.state;
        let initDataQueue : IInitializationDataInfo[];
        switch (prevState) {
          case ContentDecryptorState.Initializing:
          case ContentDecryptorState.WaitingForAttachment:
            initDataQueue = this._stateData.data.initDataQueue;
            break;
          case ContentDecryptorState.ReadyForContent:
            initDataQueue = this._stateData.data.isAttached ?
              [] :
              this._stateData.data.initDataQueue;
            break;
          default:
            initDataQueue = [];
        }

        this._stateData = { state: ContentDecryptorState.ReadyForContent,
                            data: { isAttached: true,
                                    mediaKeysData: mediaKeysInfo } };
        if (prevState !== ContentDecryptorState.ReadyForContent) {
          this.trigger("stateChange", ContentDecryptorState.ReadyForContent);
        }

        while (true) {
          // Side-effects might have provoked a stop/dispose
          if (this._isStopped()) {
            return;
          }
          const initData = initDataQueue.shift();
          if (initData === undefined) {
            return;
          }
          this.onInitializationData(initData);
        }
      })

      .catch((err) => {
        this._onFatalError(err);
      });
  }

  /**
   * Stop this `ContentDecryptor` instance:
   *   - stop listening and reacting to the various event listeners
   *   - abort all operations.
   *
   * Once disposed, a `ContentDecryptor` cannot be used anymore.
   */
  public dispose() {
    this.removeEventListener();
    this._stateData = { state: ContentDecryptorState.Disposed, data: null };
    this._canceller.cancel();
    this.trigger("stateChange", this._stateData.state);
  }

  /**
   * Method to call when new protection initialization data is encounted on the
   * content.
   *
   * When called, the `ContentDecryptor` will try to obtain the decryption key
   * if not already obtained.
   *
   * @param {Object} initializationData
   */
  public onInitializationData(
    initializationData : IInitializationDataInfo
  ) : void {
    // XXX TODO Plain ugly
    const cancelUpdateListening = new TaskCanceller();
    const unregisterGlobalSignal = this._canceller.signal.register(() => {
      cancelUpdateListening.cancel();
    });
    this._initDataLock.onUpdate((isLocked) => {
      if (isLocked) {
        return;
      }
      unregisterGlobalSignal();
      cancelUpdateListening.cancel();
      this._processInitializationData(initializationData)
        .catch(err => { this._onFatalError(err); });
    }, { clearSignal: cancelUpdateListening.signal, emitCurrentValue: true });
  }

  /**
   * Async logic run each time new initialization data has to be processed.
   * The promise return may reject, in which case a fatal error should be linked
   * the current `ContentDecryptor`.
   *
   * The Promise's resolution however provides no semantic value.
   * @param {Object} initializationData
   * @returns {Promise.<void>}
   */
  private async _processInitializationData(
    initializationData: IInitializationDataInfo
  ) : Promise<void> {
    if (this._stateData.state !== ContentDecryptorState.ReadyForContent) {
      if (this._stateData.state === ContentDecryptorState.Disposed ||
          this._stateData.state === ContentDecryptorState.Error)
      {
        throw new Error("ContentDecryptor either disposed or stopped.");
      }
      this._stateData.data.initDataQueue.push(initializationData);
      return ;
    } else if (!this._stateData.data.isAttached) {
      this._stateData.data.initDataQueue.push(initializationData);
      return ;
    }

    const mediaKeysData = this._stateData.data.mediaKeysData;
    const { mediaKeySystemAccess, stores, options } = mediaKeysData;

    if (this._tryToUseAlreadyCreatedSession(initializationData, mediaKeysData) ||
        this._isStopped())
    {
      return;
    }

    if (options.singleLicensePer === "content") {
      const firstCreatedSession = arrayFind(this._currentSessions, (x) =>
        x.source === MediaKeySessionLoadingType.Created);

      if (firstCreatedSession !== undefined) {
        // We already fetched a `singleLicensePer: "content"` license, yet we
        // could not use the already-created MediaKeySession with it.
        // It means that we'll never handle it and we should thus blacklist it.
        const keyIds = initializationData.keyIds;
        if (keyIds === undefined) {
          log.warn("EME: Initialization data linked to unknown key id, we'll " +
                   "not able to fallback from it.");
          return ;
        }

        firstCreatedSession.record.associateKeyIds(keyIds);
        if (initializationData.content !== undefined) {
          initializationData.content.manifest
            .updateDeciperabilitiesBasedOnKeyIds({ blacklistedKeyIDs: keyIds,
                                                   whitelistedKeyIds: [] });
        }
        return ;
      }
    }

    // Because we typically only want to create a single new session in a
    // `singleLicensePer: "content"` mode, we will temprarily lock new
    // initialization data from being processed while we're still
    // processing that one.
    // XXX TODO
    this._initDataLock.setValue(true);

    let wantedSessionType : MediaKeySessionType;
    if (options.persistentLicense !== true) {
      wantedSessionType = "temporary";
    } else if (!canCreatePersistentSession(mediaKeySystemAccess)) {
      log.warn("DRM: Cannot create \"persistent-license\" session: not supported");
      wantedSessionType = "temporary";
    } else {
      wantedSessionType = "persistent-license";
    }

    const maxSessionCacheSize = typeof options.maxSessionCacheSize === "number" ?
      options.maxSessionCacheSize :
      EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS;

    const sessionRes = await createOrLoadSession(initializationData,
                                                 stores,
                                                 wantedSessionType,
                                                 maxSessionCacheSize,
                                                 this._canceller.signal);

    const sessionInfo : IActiveSessionInfo = {
      record: sessionRes.value.keySessionRecord,
      source: sessionRes.type,
      keyStatuses: undefined,
      blacklistedSessionError: null,
    };
    this._currentSessions.push(sessionInfo);

    if (options.singleLicensePer === "init-data") {
      this._initDataLock.setValue(false);
    }

    const { mediaKeySession, sessionType } = sessionRes.value;

    /**
     * We only store persistent sessions once its keys are known.
     * This boolean allows to know if this session has already been
     * persisted or not.
     */
    let isSessionPersisted = false;

    const sub = SessionEventsListener(mediaKeySession,
                                      options,
                                      mediaKeySystemAccess.keySystem)
      .subscribe({
        next: (evt) : void => {
          switch (evt.type) {
            case "warning":
              this.trigger("warning", evt.value);
              return;
          }

          const allKeyStatuses = [...evt.value.whitelistedKeyIds,
                                  ...evt.value.blacklistedKeyIDs];
          sessionInfo.record.associateKeyIds(allKeyStatuses);
          sessionInfo.keyStatuses = {
            whitelisted: evt.value.whitelistedKeyIds,
            blacklisted: evt.value.blacklistedKeyIDs,
          };

          if ((evt.value.whitelistedKeyIds.length !== 0 ||
               evt.value.blacklistedKeyIDs.length !== 0) &&
              sessionType === "persistent-license" &&
              stores.persistentSessionsStore !== null &&
              isSessionPersisted)
          {
            const { persistentSessionsStore } = stores;
            cleanOldStoredPersistentInfo(
              persistentSessionsStore,
              EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION - 1);
            persistentSessionsStore.add(sessionInfo.record, mediaKeySession);
            isSessionPersisted = true;
          }
          if (initializationData.content !== undefined) {
            initializationData.content.manifest
              .updateDeciperabilitiesBasedOnKeyIds(evt.value);
          }

          // Now that key ids update have been processed, we can remove
          // the lock if it was active.
          this._initDataLock.setValue(false);
          return ;
        },
        error: (err) => {
          if (!(err instanceof BlacklistedSessionError)) {
            this._onFatalError(err);
            return ;
          }

          sessionInfo.blacklistedSessionError = err;

          if (initializationData.content !== undefined) {
            const { manifest } = initializationData.content;
            log.info("DRM: blacklisting Representations based on " +
                     "protection data.");
            manifest.addUndecipherableProtectionData(initializationData);
          }

          this._initDataLock.setValue(false);

          // XXX TODO No warning yet for blacklisted session?
          // this.trigger("warning", err);
        },
      });
    this._canceller.signal.register(() => {
      sub.unsubscribe();
    });

    if (sessionRes.type === MediaKeySessionLoadingType.Created) {
      // `generateKeyRequest` awaits a single Uint8Array containing all
      // initialization data.
      const concatInitData = concat(...initializationData.values.map(i => i.data));
      try {
        await generateKeyRequest(mediaKeySession,
                                 initializationData.type,
                                 concatInitData);
      } catch (error) {
        throw new EncryptedMediaError("KEY_GENERATE_REQUEST_ERROR",
                                      error instanceof Error ? error.toString() :
                                      "Unknown error");
      }
    }

    return PPromise.resolve();
  }

  private _tryToUseAlreadyCreatedSession(
    initializationData : IInitializationDataInfo,
    mediaKeysData : IAttachedMediaKeysData
  ) : boolean {
    const { stores, options } = mediaKeysData;

    /**
     * If set, a currently-used key session is already compatible to this
     * initialization data.
     */
    const compatibleSessionInfo = arrayFind(
      this._currentSessions,
      (x) => x.record.isCompatibleWith(initializationData));

    if (compatibleSessionInfo === undefined) {
      return false;
    }

    // Check if the compatible session is blacklisted
    const blacklistedSessionError = compatibleSessionInfo.blacklistedSessionError;
    if (!isNullOrUndefined(blacklistedSessionError)) {
      if (initializationData.type === undefined ||
          initializationData.content === undefined)
      {
        log.error("DRM: This initialization data has already been blacklisted " +
                  "but the current content is not known.");
        return true;
      } else {
        log.info("DRM: This initialization data has already been blacklisted. " +
                 "Blacklisting the related content.");
        const { manifest } = initializationData.content;
        manifest.addUndecipherableProtectionData(initializationData);
        return true;
      }
    }

    // Check if the current key id(s) has been blacklisted by this session
    if (compatibleSessionInfo.keyStatuses !== undefined &&
        initializationData.keyIds !== undefined)
    {
      /**
       * If set to `true`, the Representation(s) linked to this
       * initialization data's key id should be marked as "not decipherable".
       */
      let isUndecipherable : boolean;

      if (options.singleLicensePer === "init-data") {
        // Note: In the default "init-data" mode, we only avoid a
        // Representation if the key id was originally explicitely
        // blacklisted (and not e.g. if its key was just not present in
        // the license).
        //
        // This is to enforce v3.x.x retro-compatibility: we cannot
        // fallback from a Representation unless some RxPlayer option
        // documentating this behavior has been set.
        const { blacklisted } = compatibleSessionInfo.keyStatuses;
        isUndecipherable = areSomeKeyIdContainedIn(initializationData.keyIds,
                                                   blacklisted);
      } else {
        // In any other mode, as soon as not all of this initialization
        // data's linked key ids are explicitely whitelisted, we can mark
        // the corresponding Representation as "not decipherable".
        // This is because we've no such retro-compatibility guarantee to
        // make there.
        const { whitelisted } = compatibleSessionInfo.keyStatuses;
        isUndecipherable = !areAllKeyIdContainedIn(initializationData.keyIds,
                                                   whitelisted);
      }

      if (isUndecipherable) {
        if (initializationData.content === undefined) {
          log.error("EME: Cannot forbid key id, the content is unknown.");
          return true;
        }
        log.info("EME: Current initialization data is linked to blacklisted keys. " +
                 "Marking Representations as not decipherable");
        initializationData.content.manifest.updateDeciperabilitiesBasedOnKeyIds({
          blacklistedKeyIDs: initializationData.keyIds,
          whitelistedKeyIds: [],
        });
        return true;
      }
    }

    // If we reached here, it means that this initialization data is not
    // blacklisted in any way.
    // Search loaded session and put it on top of the cache if it exists.
    const entry = stores.loadedSessionsStore.reuse(initializationData);
    if (entry !== null) {
      log.debug("EME: Init data already processed. Skipping it.");
      return true;
    }

    // Session not found in `loadedSessionsStore`, it might have been closed
    // since.
    // Remove from `this._currentSessions` and start again.
    const indexOf = this._currentSessions.indexOf(compatibleSessionInfo);
    if (indexOf === -1) {
      log.error("EME: Unable to remove processed init data: not found.");
    } else {
      log.debug("EME: A session from a processed init data is not available " +
                "anymore. Re-processing it.");
      this._currentSessions.splice(indexOf, 1);
    }
    return false;
  }

  private _onFatalError(err : unknown) {
    if (this._canceller.isUsed) {
      return;
    }
    const formattedErr = err instanceof Error ?
      err :
      new OtherError("NONE", "Unknown encryption error");
    this.error = formattedErr;
    this._stateData = { state: ContentDecryptorState.Error, data: null };
    this._canceller.cancel();
    this.trigger("error", formattedErr);

    // The previous trigger might have lead to a disposal of the `ContentDecryptor`.
    if (this._stateData.state === ContentDecryptorState.Error) {
      this.trigger("stateChange", this._stateData.state);
    }
  }

  /**
   * Return `true` if the `ContentDecryptor` has either been disposed or
   * encountered a fatal error which made it stop.
   * @returns {boolean}
   */
  private _isStopped() : boolean {
    return this._stateData.state === ContentDecryptorState.Disposed ||
           this._stateData.state === ContentDecryptorState.Error;
  }
}

/**
 * Returns `true` if the given MediaKeySystemAccess can create
 * "persistent-license" MediaKeySessions.
 * @param {MediaKeySystemAccess} mediaKeySystemAccess
 * @returns {Boolean}
 */
function canCreatePersistentSession(
  mediaKeySystemAccess : MediaKeySystemAccess | ICustomMediaKeySystemAccess
) : boolean {
  const { sessionTypes } = mediaKeySystemAccess.getConfiguration();
  return sessionTypes !== undefined &&
         arrayIncludes(sessionTypes, "persistent-license");
}

/** Events sent by the `ContentDecryptor`, in a `{ event: payload }` format. */
export interface IContentDecryptorEvent {
  /**
   * Event emitted when a major error occured which made the ContentDecryptor
   * stopped.
   * When that event is sent, the `ContentDecryptor` is in the `Error` state and
   * cannot be used anymore.
   */
  error : Error;

  /**
   * Event emitted when a minor error occured which the ContentDecryptor can
   * recover from.
   */
  warning : ICustomError;

  /**
   * Event emitted when we have an update on whitelisted keys (which can be
   * used) and blacklisted keys (which cannot be used right now).
   */
  keyUpdate : IKeyUpdateValue;

  /**
   * Event Emitted when specific "protection data" cannot be deciphered and is
   * thus blacklisted.
   *
   * The linked value is the initialization data linked to the content that
   * cannot be deciphered.
   */
  blacklistProtectionData: IInitializationDataInfo;

  /**
   * Event emitted when the `ContentDecryptor`'s state changed.
   * States are a central aspect of the `ContentDecryptor`, be sure to check the
   * ContentDecryptorState type.
   */
  stateChange: ContentDecryptorState;
}

/** Enumeration of the various "state" the `ContentDecryptor` can be in. */
export enum ContentDecryptorState {
  /**
   * The `ContentDecryptor` is not yet ready to create key sessions and request
   * licenses.
   * This is is the initial state of the ContentDecryptor.
   */
  Initializing,

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
  WaitingForAttachment,

  /**
   * Content (encrypted or not) can begin to be pushed on the HTMLMediaElement
   * (this state was needed because some browser quirks sometimes forces us to
   * call EME API before this can be done).
   *
   * This state is always coming after the `WaitingForAttachment` state.
   */
  ReadyForContent,

  /**
   * The `ContentDecryptor` has encountered a fatal error and has been stopped.
   * It is now unusable.
   */
  Error,

  /** The `ContentDecryptor` has been disposed of and is now unusable. */
  Disposed,
}

/** Possible states the ContentDecryptor is in and associated data for each one. */
type IContentDecryptorStateData = IInitializingStateData |
                                  IWaitingForAttachmentStateData |
                                  IReadyForContentStateDataUnattached |
                                  IReadyForContentStateDataAttached |
                                  IDisposeStateData |
                                  IErrorStateData;

/** ContentDecryptor's internal data when in the `Initializing` state. */
interface IInitializingStateData {
  state: ContentDecryptorState.Initializing;
  data: {
    /**
     * This queue stores initialization data communicated while initializing so
     * it can be processed when the initialization is done.
     * This same queue is used while in the `Initializing` state, the
     * `WaitingForAttachment` state and the `ReadyForContent` until the
     * `MediaKeys` instance is actually attached to the HTMLMediaElement.
     */
    initDataQueue : IInitializationDataInfo[];
  };
}

/** ContentDecryptor's internal data when in the `WaitingForAttachment` state. */
interface IWaitingForAttachmentStateData {
  state: ContentDecryptorState.WaitingForAttachment;
  data: {
    /**
     * This queue stores initialization data communicated while initializing so
     * it can be processed when the initialization is done.
     * This same queue is used while in the `Initializing` state, the
     * `WaitingForAttachment` state and the `ReadyForContent` until the
     * `MediaKeys` instance is actually attached to the HTMLMediaElement.
     */
    initDataQueue : IInitializationDataInfo[];
    mediaKeysInfo : IMediaKeysInfos;
    mediaElement : HTMLMediaElement;
  };
}

/**
 * ContentDecryptor's internal data when in the `ReadyForContent` state before
 * it has attached the `MediaKeys` to the media element.
 */
interface IReadyForContentStateDataUnattached {
  state: ContentDecryptorState.ReadyForContent;
  data: {
    isAttached: false;
    /**
     * This queue stores initialization data communicated while initializing so
     * it can be processed when the initialization is done.
     * This same queue is used while in the `Initializing` state, the
     * `WaitingForAttachment` state and the `ReadyForContent` until the
     * `MediaKeys` instance is actually attached to the HTMLMediaElement.
     */
    initDataQueue : IInitializationDataInfo[];
  };
}

/**
 * ContentDecryptor's internal data when in the `ReadyForContent` state once
 * it has attached the `MediaKeys` to the media element.
 */
interface IReadyForContentStateDataAttached {
  state: ContentDecryptorState.ReadyForContent;
  data: {
    isAttached: true;
    /**
     * MediaKeys-related information linked to this instance of the
     * `ContentDecryptor`.
     * Set to `null` until it is known.
     * Should be always set when the `ContentDecryptor` has reached the
     * Initialized state (@see ContentDecryptorState).
     */
    mediaKeysData : IAttachedMediaKeysData;
  };
}

/** ContentDecryptor's internal data when in the `ReadyForContent` state. */
interface IDisposeStateData {
  state: ContentDecryptorState.Disposed;
  data: null;
}

/** ContentDecryptor's internal data when in the `Error` state. */
interface IErrorStateData {
  state: ContentDecryptorState.Error;
  data: null;
}

interface IActiveSessionInfo {
  record : KeySessionRecord;

  keyStatuses : undefined | {
    whitelisted : Uint8Array[];
    blacklisted : Uint8Array[];
  };

  /** Source of the MediaKeySession linked to that record. */
  source : MediaKeySessionLoadingType;

  /**
   * If different than `null`, all initialization data compatible with this
   * processed initialization data has been blacklisted with this corresponding
   * error.
   */
  blacklistedSessionError : BlacklistedSessionError | null;
}
