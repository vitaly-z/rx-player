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
import { defer as observableDefer, of as observableOf, throwError as observableThrow, } from "rxjs";
import { MediaError } from "../../../errors";
import assert from "../../../utils/assert";
import castToObservable from "../../../utils/cast_to_observable";
import { isIE11 } from "../../browser_detection";
import isNode from "../../is_node";
import shouldFavourCustomSafariEME from "../../should_favour_custom_safari_EME";
import CustomMediaKeySystemAccess from "./../custom_key_system_access";
import getIE11MediaKeysCallbacks, { MSMediaKeysConstructor, } from "./ie11_media_keys";
import getMozMediaKeysCallbacks, { MozMediaKeysConstructor, } from "./moz_media_keys_constructor";
import getOldKitWebKitMediaKeyCallbacks, { isOldWebkitMediaElement, } from "./old_webkit_media_keys";
import getWebKitMediaKeysCallbacks from "./webkit_media_keys";
import { WebKitMediaKeysConstructor } from "./webkit_media_keys_constructor";
var requestMediaKeySystemAccess = null;
var _setMediaKeys = function defaultSetMediaKeys(mediaElement, mediaKeys) {
    var elt = mediaElement;
    /* eslint-disable @typescript-eslint/unbound-method */
    if (typeof elt.setMediaKeys === "function") {
        return elt.setMediaKeys(mediaKeys);
    }
    /* eslint-enable @typescript-eslint/unbound-method */
    // If we get in the following code, it means that no compat case has been
    // found and no standard setMediaKeys API exists. This case is particulary
    // rare. We will try to call each API with native media keys.
    if (typeof elt.webkitSetMediaKeys === "function") {
        return elt.webkitSetMediaKeys(mediaKeys);
    }
    if (typeof elt.mozSetMediaKeys === "function") {
        return elt.mozSetMediaKeys(mediaKeys);
    }
    if (typeof elt.msSetMediaKeys === "function" && mediaKeys !== null) {
        return elt.msSetMediaKeys(mediaKeys);
    }
};
/**
 * Since Safari 12.1, EME APIs are available without webkit prefix.
 * However, it seems that since fairplay CDM implementation within the browser is not
 * standard with EME w3c current spec, the requestMediaKeySystemAccess API doesn't resolve
 * positively, even if the drm (fairplay in most cases) is supported.
 *
 * Therefore, we prefer not to use requestMediaKeySystemAccess on Safari when webkit API
 * is available.
 */
if (isNode ||
    (navigator.requestMediaKeySystemAccess != null && !shouldFavourCustomSafariEME())) {
    requestMediaKeySystemAccess = function (a, b) {
        return castToObservable(navigator.requestMediaKeySystemAccess(a, b));
    };
}
else {
    var isTypeSupported_1;
    var createCustomMediaKeys_1;
    // This is for Chrome with unprefixed EME api
    if (isOldWebkitMediaElement(HTMLVideoElement.prototype)) {
        var callbacks = getOldKitWebKitMediaKeyCallbacks();
        isTypeSupported_1 = callbacks.isTypeSupported;
        createCustomMediaKeys_1 = callbacks.createCustomMediaKeys;
        _setMediaKeys = callbacks.setMediaKeys;
        // This is for WebKit with prefixed EME api
    }
    else if (WebKitMediaKeysConstructor !== undefined) {
        var callbacks = getWebKitMediaKeysCallbacks();
        isTypeSupported_1 = callbacks.isTypeSupported;
        createCustomMediaKeys_1 = callbacks.createCustomMediaKeys;
        _setMediaKeys = callbacks.setMediaKeys;
    }
    else if (isIE11 && MSMediaKeysConstructor !== undefined) {
        var callbacks = getIE11MediaKeysCallbacks();
        isTypeSupported_1 = callbacks.isTypeSupported;
        createCustomMediaKeys_1 = callbacks.createCustomMediaKeys;
        _setMediaKeys = callbacks.setMediaKeys;
    }
    else if (MozMediaKeysConstructor !== undefined) {
        var callbacks = getMozMediaKeysCallbacks();
        isTypeSupported_1 = callbacks.isTypeSupported;
        createCustomMediaKeys_1 = callbacks.createCustomMediaKeys;
        _setMediaKeys = callbacks.setMediaKeys;
    }
    else {
        var MK_1 = window.MediaKeys;
        var checkForStandardMediaKeys_1 = function () {
            if (MK_1 === undefined) {
                throw new MediaError("MEDIA_KEYS_NOT_SUPPORTED", "No `MediaKeys` implementation found " +
                    "in the current browser.");
            }
            if (typeof MK_1.isTypeSupported === "undefined") {
                var message = "This browser seems to be unable to play encrypted contents " +
                    "currently. Note: Some browsers do not allow decryption " +
                    "in some situations, like when not using HTTPS.";
                throw new Error(message);
            }
        };
        isTypeSupported_1 = function (keyType) {
            checkForStandardMediaKeys_1();
            assert(typeof MK_1.isTypeSupported === "function");
            return MK_1.isTypeSupported(keyType);
        };
        createCustomMediaKeys_1 = function (keyType) {
            checkForStandardMediaKeys_1();
            return new MK_1(keyType);
        };
    }
    requestMediaKeySystemAccess = function (keyType, keySystemConfigurations) {
        if (!isTypeSupported_1(keyType)) {
            return observableThrow(function () { return new Error("Unsupported key type"); });
        }
        for (var i = 0; i < keySystemConfigurations.length; i++) {
            var keySystemConfiguration = keySystemConfigurations[i];
            var videoCapabilities = keySystemConfiguration.videoCapabilities, audioCapabilities = keySystemConfiguration.audioCapabilities, initDataTypes = keySystemConfiguration.initDataTypes, distinctiveIdentifier = keySystemConfiguration.distinctiveIdentifier;
            var supported = true;
            supported = supported &&
                (initDataTypes == null ||
                    initDataTypes.some(function (idt) { return idt === "cenc"; }));
            supported = supported && (distinctiveIdentifier !== "required");
            if (supported) {
                var keySystemConfigurationResponse = {
                    initDataTypes: ["cenc"],
                    distinctiveIdentifier: "not-allowed",
                    persistentState: "required",
                    sessionTypes: ["temporary", "persistent-license"],
                };
                if (videoCapabilities !== undefined) {
                    keySystemConfigurationResponse.videoCapabilities = videoCapabilities;
                }
                if (audioCapabilities !== undefined) {
                    keySystemConfigurationResponse.audioCapabilities = audioCapabilities;
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                var customMediaKeys = createCustomMediaKeys_1(keyType);
                return observableOf(new CustomMediaKeySystemAccess(keyType, customMediaKeys, keySystemConfigurationResponse));
            }
        }
        return observableThrow(function () { return new Error("Unsupported configuration"); });
    };
}
/**
 * Set the given MediaKeys on the given HTMLMediaElement.
 * Emits null when done then complete.
 * @param {HTMLMediaElement} elt
 * @param {Object} mediaKeys
 * @returns {Observable}
 */
function setMediaKeys(elt, mediaKeys) {
    return observableDefer(function () { return castToObservable(_setMediaKeys(elt, mediaKeys)); });
}
export { requestMediaKeySystemAccess, setMediaKeys, };
