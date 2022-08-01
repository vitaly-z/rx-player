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
/* eslint-disable-next-line max-len */
import getUUIDKidFromKeyStatusKID from "../../../compat/eme/get_uuid_kid_from_keystatus_kid";
import { EncryptedMediaError } from "../../../errors";
import { bytesToHex } from "../../../utils/string_parsing";
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
    var warnings = [];
    var blacklistedKeyIDs = [];
    var whitelistedKeyIds = [];
    var _a = options.fallbackOn, fallbackOn = _a === void 0 ? {} : _a, throwOnLicenseExpiration = options.throwOnLicenseExpiration;
    session.keyStatuses.forEach(function (_arg1, _arg2) {
        // Hack present because the order of the arguments has changed in spec
        // and is not the same between some versions of Edge and Chrome.
        var _a = (function () {
            return (typeof _arg1 === "string" ? [_arg1, _arg2] :
                [_arg2, _arg1]);
        })(), keyStatus = _a[0], keyStatusKeyId = _a[1];
        var keyId = getUUIDKidFromKeyStatusKID(keySystem, new Uint8Array(keyStatusKeyId));
        switch (keyStatus) {
            case KEY_STATUSES.EXPIRED: {
                var error = new EncryptedMediaError("KEY_STATUS_CHANGE_ERROR", "A decryption key expired (".concat(bytesToHex(keyId), ")"));
                if (throwOnLicenseExpiration !== false) {
                    throw error;
                }
                warnings.push({ type: "warning", value: error });
                whitelistedKeyIds.push(keyId);
                break;
            }
            case KEY_STATUSES.INTERNAL_ERROR: {
                var error = new EncryptedMediaError("KEY_STATUS_CHANGE_ERROR", "A \"".concat(keyStatus, "\" status has been encountered (").concat(bytesToHex(keyId), ")"));
                if (fallbackOn.keyInternalError !== true) {
                    throw error;
                }
                warnings.push({ type: "warning", value: error });
                blacklistedKeyIDs.push(keyId);
                break;
            }
            case KEY_STATUSES.OUTPUT_RESTRICTED: {
                var error = new EncryptedMediaError("KEY_STATUS_CHANGE_ERROR", "A \"".concat(keyStatus, "\" status has been encountered (").concat(bytesToHex(keyId), ")"));
                if (fallbackOn.keyOutputRestricted !== true) {
                    throw error;
                }
                warnings.push({ type: "warning", value: error });
                blacklistedKeyIDs.push(keyId);
                break;
            }
            default:
                whitelistedKeyIds.push(keyId);
                break;
        }
    });
    return { warnings: warnings, blacklistedKeyIDs: blacklistedKeyIDs, whitelistedKeyIds: whitelistedKeyIds };
}
