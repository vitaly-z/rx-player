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
import { IKeySystemOption, IPlayerError } from "../../public_types";
import EventEmitter from "../../utils/event_emitter";
import { IProtectionData } from "./types";
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
    systemId: string | undefined;
    /**
     * Set only if the `ContentDecryptor` failed on an error.
     * The corresponding Error.
     */
    error: Error | null;
    /**
     * State of the ContentDecryptor (@see ContentDecryptorState) and associated
     * data.
     *
     * The ContentDecryptor goes into a series of steps as it is initializing.
     * This private property stores the current state and the potentially linked
     * data.
     */
    private _stateData;
    /**
     * Contains information about all key sessions loaded for this current
     * content.
     * This object is most notably used to check which keys are already obtained,
     * thus avoiding to perform new unnecessary license requests and CDM interactions.
     */
    private _currentSessions;
    /**
     * Allows to dispose the resources taken by the current instance of the
     * ContentDecryptor.
     */
    private _canceller;
    /**
     * `true` once the `attach` method has been called`.
     * Allows to avoid calling multiple times that function.
     */
    private _wasAttachCalled;
    /**
     * This queue stores initialization data which hasn't been processed yet,
     * probably because the "queue is locked" for now. (@see _stateData private
     * property).
     *
     * For example, this queue stores initialization data communicated while
     * initializing so it can be processed when the initialization is done.
     */
    private _initDataQueue;
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
    constructor(mediaElement: HTMLMediaElement, ksOptions: IKeySystemOption[]);
    /**
     * Returns the current state of the ContentDecryptor.
     * @see ContentDecryptorState
     * @returns {Object}
     */
    getState(): ContentDecryptorState;
    /**
     * Attach the current decryption capabilities to the HTMLMediaElement.
     * This method should only be called once the `ContentDecryptor` is in the
     * `WaitingForAttachment` state.
     *
     * You might want to first set the HTMLMediaElement's `src` attribute before
     * calling this method, and only push data to it once the `ReadyForContent`
     * state is reached, for compatibility reasons.
     */
    attach(): void;
    /**
     * Stop this `ContentDecryptor` instance:
     *   - stop listening and reacting to the various event listeners
     *   - abort all operations.
     *
     * Once disposed, a `ContentDecryptor` cannot be used anymore.
     */
    dispose(): void;
    /**
     * Method to call when new protection initialization data is encounted on the
     * content.
     *
     * When called, the `ContentDecryptor` will try to obtain the decryption key
     * if not already obtained.
     *
     * @param {Object} initializationData
     */
    onInitializationData(initializationData: IProtectionData): void;
    /**
     * Async logic run each time new initialization data has to be processed.
     * The promise return may reject, in which case a fatal error should be linked
     * the current `ContentDecryptor`.
     *
     * The Promise's resolution however provides no semantic value.
     * @param {Object} initializationData
     * @returns {Promise.<void>}
     */
    private _processInitializationData;
    private _tryToUseAlreadyCreatedSession;
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
    private _onFatalError;
    /**
     * Return `true` if the `ContentDecryptor` has either been disposed or
     * encountered a fatal error which made it stop.
     * @returns {boolean}
     */
    private _isStopped;
    /**
     * Start processing the next initialization data of the `_initDataQueue` if it
     * isn't lock.
     */
    private _processCurrentInitDataQueue;
    /**
     * Lock new initialization data (from the `_initDataQueue`) from being
     * processed until `_unlockInitDataQueue` is called.
     *
     * You may want to call this method when performing operations which may have
     * an impact on the handling of other initialization data.
     */
    private _lockInitDataQueue;
    /**
     * Unlock `_initDataQueue` and start processing the first element.
     *
     * Should have no effect if the `_initDataQueue` was not locked.
     */
    private _unlockInitDataQueue;
}
/** Events sent by the `ContentDecryptor`, in a `{ event: payload }` format. */
export interface IContentDecryptorEvent {
    /**
     * Event emitted when a major error occured which made the ContentDecryptor
     * stopped.
     * When that event is sent, the `ContentDecryptor` is in the `Error` state and
     * cannot be used anymore.
     */
    error: Error;
    /**
     * Event emitted when a minor error occured which the ContentDecryptor can
     * recover from.
     */
    warning: IPlayerError;
    /**
     * Event emitted when the `ContentDecryptor`'s state changed.
     * States are a central aspect of the `ContentDecryptor`, be sure to check the
     * ContentDecryptorState type.
     */
    stateChange: ContentDecryptorState;
}
/** Enumeration of the various "state" the `ContentDecryptor` can be in. */
export declare enum ContentDecryptorState {
    /**
     * The `ContentDecryptor` is not yet ready to create key sessions and request
     * licenses.
     * This is is the initial state of the ContentDecryptor.
     */
    Initializing = 0,
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
    WaitingForAttachment = 1,
    /**
     * Content (encrypted or not) can begin to be pushed on the HTMLMediaElement
     * (this state was needed because some browser quirks sometimes forces us to
     * call EME API before this can be done).
     *
     * This state is always coming after the `WaitingForAttachment` state.
     */
    ReadyForContent = 2,
    /**
     * The `ContentDecryptor` has encountered a fatal error and has been stopped.
     * It is now unusable.
     */
    Error = 3,
    /** The `ContentDecryptor` has been disposed of and is now unusable. */
    Disposed = 4
}
