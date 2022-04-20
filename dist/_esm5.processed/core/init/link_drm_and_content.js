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
import { map, merge as observableMerge, Observable, } from "rxjs";
import { events, hasEMEAPIs, } from "../../compat/";
import { EncryptedMediaError } from "../../errors";
import features from "../../features";
import log from "../../log";
import { ContentDecryptorState, } from "../decrypt";
var onEncrypted$ = events.onEncrypted$;
/**
 * @param {HTMLMediaElement} mediaElement
 * @param {Array.<Object>} keySystems
 * @param {Observable<Object>} contentProtections$
 * @param {Promise} linkingMedia$
 * @returns {Observable}
 */
export default function linkDrmAndContent(mediaElement, keySystems, contentProtections$, linkingMedia$) {
    var encryptedEvents$ = observableMerge(onEncrypted$(mediaElement), contentProtections$);
    if (features.ContentDecryptor == null) {
        return observableMerge(encryptedEvents$.pipe(map(function () {
            log.error("Init: Encrypted event but EME feature not activated");
            throw new EncryptedMediaError("MEDIA_IS_ENCRYPTED_ERROR", "EME feature not activated.");
        })), linkingMedia$.pipe(map(function (mediaSource) { return ({
            type: "decryption-disabled",
            value: { drmSystemId: undefined, mediaSource: mediaSource },
        }); })));
    }
    if (keySystems.length === 0) {
        return observableMerge(encryptedEvents$.pipe(map(function () {
            log.error("Init: Ciphered media and no keySystem passed");
            throw new EncryptedMediaError("MEDIA_IS_ENCRYPTED_ERROR", "Media is encrypted and no `keySystems` given");
        })), linkingMedia$.pipe(map(function (mediaSource) { return ({
            type: "decryption-disabled",
            value: { drmSystemId: undefined, mediaSource: mediaSource },
        }); })));
    }
    if (!hasEMEAPIs()) {
        return observableMerge(encryptedEvents$.pipe(map(function () {
            log.error("Init: Encrypted event but no EME API available");
            throw new EncryptedMediaError("MEDIA_IS_ENCRYPTED_ERROR", "Encryption APIs not found.");
        })), linkingMedia$.pipe(map(function (mediaSource) { return ({
            type: "decryption-disabled",
            value: { drmSystemId: undefined, mediaSource: mediaSource },
        }); })));
    }
    log.debug("Init: Creating ContentDecryptor");
    var ContentDecryptor = features.ContentDecryptor;
    return new Observable(function (obs) {
        var contentDecryptor = new ContentDecryptor(mediaElement, keySystems);
        var mediaSub;
        contentDecryptor.addEventListener("stateChange", function (state) {
            if (state === ContentDecryptorState.WaitingForAttachment) {
                contentDecryptor.removeEventListener("stateChange");
                mediaSub = linkingMedia$.subscribe(function (mediaSource) {
                    contentDecryptor.addEventListener("stateChange", function (newState) {
                        if (newState === ContentDecryptorState.ReadyForContent) {
                            obs.next({ type: "decryption-ready",
                                value: { drmSystemId: contentDecryptor.systemId, mediaSource: mediaSource } });
                            contentDecryptor.removeEventListener("stateChange");
                        }
                    });
                    contentDecryptor.attach();
                });
            }
        });
        contentDecryptor.addEventListener("error", function (e) {
            obs.error(e);
        });
        contentDecryptor.addEventListener("warning", function (w) {
            obs.next({ type: "warning", value: w });
        });
        var protectionDataSub = contentProtections$.subscribe(function (data) {
            contentDecryptor.onInitializationData(data);
        });
        return function () {
            protectionDataSub.unsubscribe();
            mediaSub === null || mediaSub === void 0 ? void 0 : mediaSub.unsubscribe();
            contentDecryptor.dispose();
        };
    });
}
