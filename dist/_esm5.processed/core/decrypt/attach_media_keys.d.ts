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
import { ICustomMediaKeys, ICustomMediaKeySystemAccess } from "../../compat";
import { CancellationSignal } from "../../utils/task_canceller";
import { IKeySystemOption } from "./types";
import LoadedSessionsStore from "./utils/loaded_sessions_store";
/**
 * Dispose of the MediaKeys instance attached to the given media element, if
 * one.
 * @param {Object} mediaElement
 */
export declare function disableMediaKeys(mediaElement: HTMLMediaElement): void;
/**
 * Attach MediaKeys and its associated state to an HTMLMediaElement.
 *
 * /!\ Mutates heavily MediaKeysInfosStore
 * @param {Object} mediaKeysInfos
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
export default function attachMediaKeys(mediaElement: HTMLMediaElement, { keySystemOptions, loadedSessionsStore, mediaKeySystemAccess, mediaKeys }: IMediaKeysState, cancelSignal: CancellationSignal): Promise<void>;
/** MediaKeys and associated state attached to a media element. */
export interface IMediaKeysState {
    /** Options set when the MediaKeys has been attached. */
    keySystemOptions: IKeySystemOption;
    /** LoadedSessionsStore associated to the MediaKeys instance. */
    loadedSessionsStore: LoadedSessionsStore;
    /** The MediaKeySystemAccess allowing to create MediaKeys instances. */
    mediaKeySystemAccess: MediaKeySystemAccess | ICustomMediaKeySystemAccess;
    /** The MediaKeys instance to attach to the media element. */
    mediaKeys: MediaKeys | ICustomMediaKeys;
}
