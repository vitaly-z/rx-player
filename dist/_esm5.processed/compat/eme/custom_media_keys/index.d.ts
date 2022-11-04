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
import CustomMediaKeySystemAccess from "./../custom_key_system_access";
import { ICustomMediaKeys, ICustomMediaKeySession } from "./types";
/** Generic implementation of the navigator.requestMediaKeySystemAccess API. */
declare type ICompatRequestMediaKeySystemAccessFn = (keyType: string, config: MediaKeySystemConfiguration[]) => Promise<MediaKeySystemAccess | CustomMediaKeySystemAccess>;
declare let requestMediaKeySystemAccess: ICompatRequestMediaKeySystemAccessFn | null;
/**
 * Set the given MediaKeys on the given HTMLMediaElement.
 * Emits null when done then complete.
 * @param {HTMLMediaElement} elt
 * @param {Object} mediaKeys
 */
declare let setMediaKeys: ((elt: HTMLMediaElement, mediaKeys: MediaKeys | ICustomMediaKeys | null) => unknown);
export { requestMediaKeySystemAccess, setMediaKeys, ICustomMediaKeys, ICustomMediaKeySession, };
