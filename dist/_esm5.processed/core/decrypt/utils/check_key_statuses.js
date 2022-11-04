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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
/* eslint-disable-next-line max-len */
import getUUIDKidFromKeyStatusKID from "../../../compat/eme/get_uuid_kid_from_keystatus_kid";
import { EncryptedMediaError } from "../../../errors";
import assertUnreachable from "../../../utils/assert_unreachable";
import { bytesToHex } from "../../../utils/string_parsing";
/**
 * Error thrown when the MediaKeySession has to be closed due to a trigger
 * specified by user configuration.
 * Such MediaKeySession should be closed immediately and may be re-created if
 * needed again.
 * @class DecommissionedSessionError
 * @extends Error
 */
var DecommissionedSessionError = /** @class */ (function (_super) {
    __extends(DecommissionedSessionError, _super);
    /**
     * Creates a new `DecommissionedSessionError`.
     * @param {Error} reason - Error that led to the decision to close the
     * current MediaKeySession. Should be used for reporting purposes.
     */
    function DecommissionedSessionError(reason) {
        var _this = _super.call(this) || this;
        // @see https://stackoverflow.com/questions/41102060/typescript-extending-error-class
        Object.setPrototypeOf(_this, DecommissionedSessionError.prototype);
        _this.reason = reason;
        return _this;
    }
    return DecommissionedSessionError;
}(Error));
export { DecommissionedSessionError };
var KEY_STATUSES = { EXPIRED: "expired",
    INTERNAL_ERROR: "internal-error",
    OUTPUT_RESTRICTED: "output-restricted" };
/**
 * Look at the current key statuses in the sessions and construct the
 * appropriate warnings, whitelisted and blacklisted key ids.
 *
 * Throws if one of the keyID is on an error.
 * @param {MediaKeySession} session - The MediaKeySession from which the keys
 * will be checked.
 * @param {Object} options
 * @param {String} keySystem - The configuration keySystem used for deciphering
 * @returns {Object} - Warnings to send, whitelisted and blacklisted key ids.
 */
export default function checkKeyStatuses(session, options, keySystem) {
    var _a = options.fallbackOn, fallbackOn = _a === void 0 ? {} : _a, throwOnLicenseExpiration = options.throwOnLicenseExpiration, onKeyExpiration = options.onKeyExpiration;
    var blacklistedKeyIds = [];
    var whitelistedKeyIds = [];
    var badKeyStatuses = [];
    session.keyStatuses.forEach(function (_arg1, _arg2) {
        // Hack present because the order of the arguments has changed in spec
        // and is not the same between some versions of Edge and Chrome.
        var _a = (function () {
            return (typeof _arg1 === "string" ? [_arg1, _arg2] :
                [_arg2, _arg1]);
        })(), keyStatus = _a[0], keyStatusKeyId = _a[1];
        var keyId = getUUIDKidFromKeyStatusKID(keySystem, new Uint8Array(keyStatusKeyId));
        var keyStatusObj = { keyId: keyId.buffer, keyStatus: keyStatus };
        switch (keyStatus) {
            case KEY_STATUSES.EXPIRED: {
                var error = new EncryptedMediaError("KEY_STATUS_CHANGE_ERROR", "A decryption key expired (".concat(bytesToHex(keyId), ")"), { keyStatuses: __spreadArray([keyStatusObj], badKeyStatuses, true) });
                if (onKeyExpiration === "error" ||
                    (onKeyExpiration === undefined && throwOnLicenseExpiration === false)) {
                    throw error;
                }
                switch (onKeyExpiration) {
                    case "close-session":
                        throw new DecommissionedSessionError(error);
                    case "fallback":
                        blacklistedKeyIds.push(keyId);
                        break;
                    default:
                        // I weirdly stopped relying on switch-cases here due to some TypeScript
                        // issue, not checking properly `case undefined` (bug?)
                        if (onKeyExpiration === "continue" || onKeyExpiration === undefined) {
                            whitelistedKeyIds.push(keyId);
                        }
                        else {
                            // Compile-time check throwing when not all possible cases are handled
                            assertUnreachable(onKeyExpiration);
                        }
                        break;
                }
                badKeyStatuses.push(keyStatusObj);
                break;
            }
            case KEY_STATUSES.INTERNAL_ERROR: {
                if (fallbackOn.keyInternalError !== true) {
                    throw new EncryptedMediaError("KEY_STATUS_CHANGE_ERROR", "A \"".concat(keyStatus, "\" status has been encountered (").concat(bytesToHex(keyId), ")"), { keyStatuses: __spreadArray([keyStatusObj], badKeyStatuses, true) });
                }
                badKeyStatuses.push(keyStatusObj);
                blacklistedKeyIds.push(keyId);
                break;
            }
            case KEY_STATUSES.OUTPUT_RESTRICTED: {
                if (fallbackOn.keyOutputRestricted !== true) {
                    throw new EncryptedMediaError("KEY_STATUS_CHANGE_ERROR", "A \"".concat(keyStatus, "\" status has been encountered (").concat(bytesToHex(keyId), ")"), { keyStatuses: __spreadArray([keyStatusObj], badKeyStatuses, true) });
                }
                badKeyStatuses.push(keyStatusObj);
                blacklistedKeyIds.push(keyId);
                break;
            }
            default:
                whitelistedKeyIds.push(keyId);
                break;
        }
    });
    var warning;
    if (badKeyStatuses.length > 0) {
        warning = new EncryptedMediaError("KEY_STATUS_CHANGE_ERROR", "One or several problematic key statuses have been encountered", { keyStatuses: badKeyStatuses });
    }
    return { warning: warning, blacklistedKeyIds: blacklistedKeyIds, whitelistedKeyIds: whitelistedKeyIds };
}
