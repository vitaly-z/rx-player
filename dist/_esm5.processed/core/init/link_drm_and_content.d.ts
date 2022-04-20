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
import { Observable } from "rxjs";
import { IContentProtection, IKeySystemOption } from "../decrypt";
import { IWarningEvent } from "./types";
/**
 * @param {HTMLMediaElement} mediaElement
 * @param {Array.<Object>} keySystems
 * @param {Observable<Object>} contentProtections$
 * @param {Promise} linkingMedia$
 * @returns {Observable}
 */
export default function linkDrmAndContent<T>(mediaElement: HTMLMediaElement, keySystems: IKeySystemOption[], contentProtections$: Observable<IContentProtection>, linkingMedia$: Observable<T>): Observable<IContentDecryptorInitEvent<T>>;
export declare type IContentDecryptorInitEvent<T> = IDecryptionDisabledEvent<T> | IDecryptionReadyEvent<T> | IWarningEvent;
/**
 * Event emitted after deciding that no decryption logic will be launched for
 * the current content.
 */
export interface IDecryptionDisabledEvent<T> {
    type: "decryption-disabled";
    value: {
        /**
         * Identify the current DRM's system ID.
         * Here `undefined` as no decryption capability has been added.
         */
        drmSystemId: undefined;
        /** The value outputed by the `linkingMedia$` Observable. */
        mediaSource: T;
    };
}
/**
 * Event emitted when decryption capabilities have started and content can
 * begin to be pushed on the HTMLMediaElement.
 */
export interface IDecryptionReadyEvent<T> {
    type: "decryption-ready";
    value: {
        /**
         * Identify the current DRM's systemId as an hexadecimal string, so the
         * RxPlayer may be able to (optionally) only send the corresponding
         * encryption initialization data.
         * `undefined` if unknown.
         */
        drmSystemId: string | undefined;
        /** The value outputed by the `linkingMedia$` Observable. */
        mediaSource: T;
    };
}
