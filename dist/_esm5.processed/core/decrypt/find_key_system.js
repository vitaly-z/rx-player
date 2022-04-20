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
import { requestMediaKeySystemAccess, shouldRenewMediaKeys, } from "../../compat";
import config from "../../config";
import { EncryptedMediaError } from "../../errors";
import log from "../../log";
import arrayIncludes from "../../utils/array_includes";
import flatMap from "../../utils/flat_map";
import MediaKeysInfosStore from "./utils/media_keys_infos_store";
/**
 * @param {Array.<Object>} keySystems
 * @param {MediaKeySystemAccess} currentKeySystemAccess
 * @param {Object} currentKeySystemOptions
 * @returns {null|Object}
 */
function checkCachedMediaKeySystemAccess(keySystems, currentKeySystemAccess, currentKeySystemOptions) {
    var mksConfiguration = currentKeySystemAccess.getConfiguration();
    if (shouldRenewMediaKeys() || mksConfiguration == null) {
        return null;
    }
    var firstCompatibleOption = keySystems.filter(function (ks) {
        // TODO Do it with MediaKeySystemAccess.prototype.keySystem instead
        if (ks.type !== currentKeySystemOptions.type) {
            return false;
        }
        if ((ks.persistentLicense === true || ks.persistentStateRequired === true) &&
            mksConfiguration.persistentState !== "required") {
            return false;
        }
        if (ks.distinctiveIdentifierRequired === true &&
            mksConfiguration.distinctiveIdentifier !== "required") {
            return false;
        }
        return true;
    })[0];
    if (firstCompatibleOption != null) {
        return { keySystemOptions: firstCompatibleOption,
            keySystemAccess: currentKeySystemAccess };
    }
    return null;
}
/**
 * Find key system canonical name from key system type.
 * @param {string} ksType - Obtained via inversion
 * @returns {string|undefined} - Either the canonical name, or undefined.
 */
function findKeySystemCanonicalName(ksType) {
    var EME_KEY_SYSTEMS = config.getCurrent().EME_KEY_SYSTEMS;
    for (var _i = 0, _a = Object.keys(EME_KEY_SYSTEMS); _i < _a.length; _i++) {
        var ksName = _a[_i];
        if (arrayIncludes(EME_KEY_SYSTEMS[ksName], ksType)) {
            return ksName;
        }
    }
    return undefined;
}
/**
 * Build configuration for the requestMediaKeySystemAccess EME API, based
 * on the current keySystem object.
 * @param {string} [ksName] - Generic name for the key system. e.g. "clearkey",
 * "widevine", "playready". Can be used to make exceptions depending on it.
 * @param {Object} keySystem
 * @returns {Array.<Object>} - Configuration to give to the
 * requestMediaKeySystemAccess API.
 */
function buildKeySystemConfigurations(ksName, keySystem) {
    var sessionTypes = ["temporary"];
    var persistentState = "optional";
    var distinctiveIdentifier = "optional";
    if (keySystem.persistentLicense === true) {
        persistentState = "required";
        sessionTypes.push("persistent-license");
    }
    if (keySystem.persistentStateRequired === true) {
        persistentState = "required";
    }
    if (keySystem.distinctiveIdentifierRequired === true) {
        distinctiveIdentifier = "required";
    }
    var EME_DEFAULT_WIDEVINE_ROBUSTNESSES = config.getCurrent().EME_DEFAULT_WIDEVINE_ROBUSTNESSES;
    // Set robustness, in order of consideration:
    //   1. the user specified its own robustnesses
    //   2. a "widevine" key system is used, in that case set the default widevine
    //      robustnesses as defined in the config
    //   3. set an undefined robustness
    var videoRobustnesses = keySystem.videoRobustnesses != null ?
        keySystem.videoRobustnesses :
        (ksName === "widevine" ? EME_DEFAULT_WIDEVINE_ROBUSTNESSES :
            []);
    var audioRobustnesses = keySystem.audioRobustnesses != null ?
        keySystem.audioRobustnesses :
        (ksName === "widevine" ? EME_DEFAULT_WIDEVINE_ROBUSTNESSES :
            []);
    if (videoRobustnesses.length === 0) {
        videoRobustnesses.push(undefined);
    }
    if (audioRobustnesses.length === 0) {
        audioRobustnesses.push(undefined);
    }
    // From the W3 EME spec, we have to provide videoCapabilities and
    // audioCapabilities.
    // These capabilities must specify a codec (even though you can use a
    // completely different codec afterward).
    // It is also strongly recommended to specify the required security
    // robustness. As we do not want to forbide any security level, we specify
    // every existing security level from highest to lowest so that the best
    // security level is selected.
    // More details here:
    // https://storage.googleapis.com/wvdocs/Chrome_EME_Changes_and_Best_Practices.pdf
    // https://www.w3.org/TR/encrypted-media/#get-supported-configuration-and-consent
    var videoCapabilities = flatMap(audioRobustnesses, function (robustness) {
        return ["video/mp4;codecs=\"avc1.4d401e\"",
            "video/mp4;codecs=\"avc1.42e01e\"",
            "video/webm;codecs=\"vp8\""].map(function (contentType) {
            return robustness !== undefined ? { contentType: contentType, robustness: robustness } :
                { contentType: contentType };
        });
    });
    var audioCapabilities = flatMap(audioRobustnesses, function (robustness) {
        return ["audio/mp4;codecs=\"mp4a.40.2\"",
            "audio/webm;codecs=opus"].map(function (contentType) {
            return robustness !== undefined ? { contentType: contentType, robustness: robustness } :
                { contentType: contentType };
        });
    });
    // TODO Re-test with a set contentType but an undefined robustness on the
    // STBs on which this problem was found.
    //
    // add another with no {audio,video}Capabilities for some legacy browsers.
    // As of today's spec, this should return NotSupported but the first
    // candidate configuration should be good, so we should have no downside
    // doing that.
    // initDataTypes: ["cenc"],
    // videoCapabilities: undefined,
    // audioCapabilities: undefined,
    // distinctiveIdentifier,
    // persistentState,
    // sessionTypes,
    return [{ initDataTypes: ["cenc"], videoCapabilities: videoCapabilities, audioCapabilities: audioCapabilities, distinctiveIdentifier: distinctiveIdentifier, persistentState: persistentState, sessionTypes: sessionTypes }];
}
/**
 * Try to find a compatible key system from the keySystems array given.
 *
 * This function will request a MediaKeySystemAccess based on the various
 * keySystems provided.
 *
 * This Promise might either:
 *   - resolves the MediaKeySystemAccess and the keySystems as an object, when
 *     found.
 *   - reject if no compatible key system has been found.
 *
 * @param {HTMLMediaElement} mediaElement
 * @param {Array.<Object>} keySystems - The keySystems you want to test.
 * @param {Object} cancelSignal
 * @returns {Promise.<Object>}
 */
export default function getMediaKeySystemAccess(mediaElement, keySystemsConfigs, cancelSignal) {
    log.info("DRM: Searching for compatible MediaKeySystemAccess");
    var currentState = MediaKeysInfosStore.getState(mediaElement);
    if (currentState != null) {
        // Fast way to find a compatible keySystem if the currently loaded
        // one as exactly the same compatibility options.
        var cachedKeySystemAccess = checkCachedMediaKeySystemAccess(keySystemsConfigs, currentState.mediaKeySystemAccess, currentState.keySystemOptions);
        if (cachedKeySystemAccess !== null) {
            log.info("DRM: Found cached compatible keySystem");
            return Promise.resolve({
                type: "reuse-media-key-system-access",
                value: { mediaKeySystemAccess: cachedKeySystemAccess.keySystemAccess,
                    options: cachedKeySystemAccess.keySystemOptions },
            });
        }
    }
    /**
     * Array of set keySystems for this content.
     * Each item of this array is an object containing the following keys:
     *   - keyName {string}: keySystem canonical name (e.g. "widevine")
     *   - keyType {string}: keySystem type (e.g. "com.widevine.alpha")
     *   - keySystem {Object}: the original keySystem object
     * @type {Array.<Object>}
     */
    var keySystemsType = keySystemsConfigs.reduce(function (arr, keySystemOptions) {
        var EME_KEY_SYSTEMS = config.getCurrent().EME_KEY_SYSTEMS;
        var managedRDNs = EME_KEY_SYSTEMS[keySystemOptions.type];
        var ksType;
        if (managedRDNs != null) {
            ksType = managedRDNs.map(function (keyType) {
                var keyName = keySystemOptions.type;
                return { keyName: keyName, keyType: keyType, keySystemOptions: keySystemOptions };
            });
        }
        else {
            var keyName = findKeySystemCanonicalName(keySystemOptions.type);
            var keyType = keySystemOptions.type;
            ksType = [{ keyName: keyName, keyType: keyType, keySystemOptions: keySystemOptions }];
        }
        return arr.concat(ksType);
    }, []);
    return recursivelyTestKeySystems(0);
    /**
     * Test all key system configuration stored in `keySystemsType` one by one
     * recursively.
     * Returns a Promise which will emit the MediaKeySystemAccess if one was
     * found compatible with one of the configurations or just reject if none
     * were found to be compatible.
     * @param {Number} index - The index in `keySystemsType` to start from.
     * Should be set to `0` when calling directly.
     * @returns {Promise.<Object>}
     */
    function recursivelyTestKeySystems(index) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, keyName, keyType, keySystemOptions, keySystemConfigurations, keySystemAccess, _1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        // if we iterated over the whole keySystemsType Array, quit on error
                        if (index >= keySystemsType.length) {
                            throw new EncryptedMediaError("INCOMPATIBLE_KEYSYSTEMS", "No key system compatible with your wanted " +
                                "configuration has been found in the current " +
                                "browser.");
                        }
                        if (requestMediaKeySystemAccess == null) {
                            throw new Error("requestMediaKeySystemAccess is not implemented in your browser.");
                        }
                        _a = keySystemsType[index], keyName = _a.keyName, keyType = _a.keyType, keySystemOptions = _a.keySystemOptions;
                        keySystemConfigurations = buildKeySystemConfigurations(keyName, keySystemOptions);
                        log.debug("DRM: Request keysystem access ".concat(keyType, ",") +
                            "".concat(index + 1, " of ").concat(keySystemsType.length), keySystemConfigurations);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, requestMediaKeySystemAccess(keyType, keySystemConfigurations)];
                    case 2:
                        keySystemAccess = _b.sent();
                        log.info("DRM: Found compatible keysystem", keyType, keySystemConfigurations);
                        return [2 /*return*/, { type: "create-media-key-system-access",
                                value: { options: keySystemOptions,
                                    mediaKeySystemAccess: keySystemAccess } }];
                    case 3:
                        _1 = _b.sent();
                        log.debug("DRM: Rejected access to keysystem", keyType, keySystemConfigurations);
                        if (cancelSignal.cancellationError !== null) {
                            throw cancelSignal.cancellationError;
                        }
                        return [2 /*return*/, recursivelyTestKeySystems(index + 1)];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
}
