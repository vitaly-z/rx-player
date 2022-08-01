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
import { base64ToBytes } from "../../../utils/base64";
import EventEmitter from "../../../utils/event_emitter";
import noop from "../../../utils/noop";
import { utf8ToStr } from "../../../utils/string_parsing";
/**
 * Returns true if the given media element has old webkit methods
 * corresponding to the IOldWebkitHTMLMediaElement interface.
 * @param {HTMLMediaElement} element
 * @returns {Boolean}
 */
export function isOldWebkitMediaElement(element) {
    return typeof element
        .webkitGenerateKeyRequest === "function";
}
/**
 * MediaKeySession implementation for older versions of WebKit relying on APIs
 * such as `webkitGenerateKeyRequest` `webkitAddKey` to be called on the
 * HTMLMediaElement.
 * @class OldWebkitMediaKeySession
 */
var OldWebkitMediaKeySession = /** @class */ (function (_super) {
    __extends(OldWebkitMediaKeySession, _super);
    function OldWebkitMediaKeySession(mediaElement, keySystem) {
        var _this = _super.call(this) || this;
        _this._vid = mediaElement;
        _this._key = keySystem;
        _this.sessionId = "";
        _this._closeSession = noop; // Just here to make TypeScript happy
        _this.keyStatuses = new Map();
        _this.expiration = NaN;
        var onSessionRelatedEvent = function (evt) {
            _this.trigger(evt.type, evt);
        };
        _this.closed = new Promise(function (resolve) {
            _this._closeSession = function () {
                ["keymessage", "message", "keyadded", "ready", "keyerror", "error"]
                    .forEach(function (evt) {
                    mediaElement.removeEventListener(evt, onSessionRelatedEvent);
                    mediaElement.removeEventListener("webkit".concat(evt), onSessionRelatedEvent);
                });
                resolve();
            };
        });
        ["keymessage", "message", "keyadded", "ready", "keyerror", "error"]
            .forEach(function (evt) {
            mediaElement.addEventListener(evt, onSessionRelatedEvent);
            mediaElement.addEventListener("webkit".concat(evt), onSessionRelatedEvent);
        });
        return _this;
    }
    OldWebkitMediaKeySession.prototype.update = function (license) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            try {
                if (_this._key.indexOf("clearkey") >= 0) {
                    var licenseTypedArray = license instanceof ArrayBuffer ? new Uint8Array(license) :
                        license;
                    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
                    /* eslint-disable @typescript-eslint/no-unsafe-argument */
                    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
                    var json = JSON.parse(utf8ToStr(licenseTypedArray));
                    var key = base64ToBytes(json.keys[0].k);
                    var kid = base64ToBytes(json.keys[0].kid);
                    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
                    /* eslint-enable @typescript-eslint/no-unsafe-argument */
                    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
                    resolve(_this._vid.webkitAddKey(_this._key, key, kid, /* sessionId */ ""));
                }
                else {
                    resolve(_this._vid.webkitAddKey(_this._key, license, null, /* sessionId */ ""));
                }
            }
            catch (err) {
                reject(err);
            }
        });
    };
    OldWebkitMediaKeySession.prototype.generateRequest = function (_initDataType, initData) {
        var _this = this;
        return new Promise(function (resolve) {
            _this._vid.webkitGenerateKeyRequest(_this._key, initData);
            resolve();
        });
    };
    OldWebkitMediaKeySession.prototype.close = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _this._closeSession();
            resolve();
        });
    };
    /**
     * Load a Persistent MediaKeySession.
     * Do nothing here because this implementation doesn't handle them.
     * @returns {Promise.<boolean>}
     */
    OldWebkitMediaKeySession.prototype.load = function () {
        // Not implemented. Always return false as in "no session with that id".
        return Promise.resolve(false);
    };
    OldWebkitMediaKeySession.prototype.remove = function () {
        return Promise.resolve();
    };
    return OldWebkitMediaKeySession;
}(EventEmitter));
var OldWebKitCustomMediaKeys = /** @class */ (function () {
    function OldWebKitCustomMediaKeys(keySystem) {
        this._keySystem = keySystem;
    }
    OldWebKitCustomMediaKeys.prototype._setVideo = function (videoElement) {
        if (!isOldWebkitMediaElement(videoElement)) {
            throw new Error("Video not attached to the MediaKeys");
        }
        this._videoElement = videoElement;
    };
    OldWebKitCustomMediaKeys.prototype.createSession = function ( /* sessionType */) {
        if (this._videoElement == null) {
            throw new Error("Video not attached to the MediaKeys");
        }
        return new OldWebkitMediaKeySession(this._videoElement, this._keySystem);
    };
    OldWebKitCustomMediaKeys.prototype.setServerCertificate = function () {
        throw new Error("Server certificate is not implemented in your browser");
    };
    return OldWebKitCustomMediaKeys;
}());
export default function getOldWebKitMediaKeysCallbacks() {
    var isTypeSupported = function (keyType) {
        // get any <video> element from the DOM or create one
        // and try the `canPlayType` method
        var videoElement = document.querySelector("video");
        if (videoElement == null) {
            videoElement = document.createElement("video");
        }
        if (videoElement != null && typeof videoElement.canPlayType === "function") {
            return !!videoElement.canPlayType("video/mp4", keyType);
        }
        else {
            return false;
        }
    };
    var createCustomMediaKeys = function (keyType) { return new OldWebKitCustomMediaKeys(keyType); };
    var setMediaKeys = function (elt, mediaKeys) {
        if (mediaKeys === null) {
            return;
        }
        if (!(mediaKeys instanceof OldWebKitCustomMediaKeys)) {
            throw new Error("Custom setMediaKeys is supposed to be called " +
                "with old webkit custom MediaKeys.");
        }
        return mediaKeys._setVideo(elt);
    };
    return {
        isTypeSupported: isTypeSupported,
        createCustomMediaKeys: createCustomMediaKeys,
        setMediaKeys: setMediaKeys,
    };
}
