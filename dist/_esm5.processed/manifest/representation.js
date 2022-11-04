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
import { isCodecSupported } from "../compat";
import log from "../log";
import areArraysOfNumbersEqual from "../utils/are_arrays_of_numbers_equal";
/**
 * Normalized Representation structure.
 * @class Representation
 */
var Representation = /** @class */ (function () {
    /**
     * @param {Object} args
     */
    function Representation(args, opts) {
        this.id = args.id;
        this.bitrate = args.bitrate;
        this.codec = args.codecs;
        if (args.height !== undefined) {
            this.height = args.height;
        }
        if (args.width !== undefined) {
            this.width = args.width;
        }
        if (args.mimeType !== undefined) {
            this.mimeType = args.mimeType;
        }
        if (args.contentProtections !== undefined) {
            this.contentProtections = args.contentProtections;
        }
        if (args.frameRate !== undefined) {
            this.frameRate = args.frameRate;
        }
        if (args.hdrInfo !== undefined) {
            this.hdrInfo = args.hdrInfo;
        }
        this.cdnMetadata = args.cdnMetadata;
        this.index = args.index;
        this.isSupported = opts.type === "audio" ||
            opts.type === "video" ?
            isCodecSupported(this.getMimeTypeString()) :
            true; // TODO for other types
    }
    /**
     * Returns "mime-type string" which includes both the mime-type and the codec,
     * which is often needed when interacting with the browser's APIs.
     * @returns {string}
     */
    Representation.prototype.getMimeTypeString = function () {
        var _a, _b;
        return "".concat((_a = this.mimeType) !== null && _a !== void 0 ? _a : "", ";codecs=\"").concat((_b = this.codec) !== null && _b !== void 0 ? _b : "", "\"");
    };
    /**
     * Returns encryption initialization data linked to the given DRM's system ID.
     * This data may be useful to decrypt encrypted media segments.
     *
     * Returns an empty array if there is no data found for that system ID at the
     * moment.
     *
     * When you know that all encryption data has been added to this
     * Representation, you can also call the `getAllEncryptionData` method.
     * This second function will return all encryption initialization data
     * regardless of the DRM system, and might thus be used in all cases.
     *
     * /!\ Note that encryption initialization data may be progressively added to
     * this Representation after `_addProtectionData` calls or Manifest updates.
     * Because of this, the return value of this function might change after those
     * events.
     *
     * @param {string} drmSystemId - The hexa-encoded DRM system ID
     * @returns {Array.<Object>}
     */
    Representation.prototype.getEncryptionData = function (drmSystemId) {
        var _a, _b;
        var allInitData = this.getAllEncryptionData();
        var filtered = [];
        for (var i = 0; i < allInitData.length; i++) {
            var createdObjForType = false;
            var initData = allInitData[i];
            for (var j = 0; j < initData.values.length; j++) {
                if (initData.values[j].systemId.toLowerCase() === drmSystemId.toLowerCase()) {
                    if (!createdObjForType) {
                        var keyIds = (_b = (_a = this.contentProtections) === null || _a === void 0 ? void 0 : _a.keyIds) === null || _b === void 0 ? void 0 : _b.map(function (val) { return val.keyId; });
                        filtered.push({ type: initData.type, keyIds: keyIds, values: [initData.values[j]] });
                        createdObjForType = true;
                    }
                    else {
                        filtered[filtered.length - 1].values.push(initData.values[j]);
                    }
                }
            }
        }
        return filtered;
    };
    /**
     * Returns all currently-known encryption initialization data linked to this
     * Representation.
     * Encryption initialization data is generally required to be able to decrypt
     * those Representation's media segments.
     *
     * Unlike `getEncryptionData`, this method will return all available
     * encryption data.
     * It might as such might be used when either the current drm's system id is
     * not known or when no encryption data specific to it was found. In that
     * case, providing every encryption data linked to this Representation might
     * still allow decryption.
     *
     * Returns an empty array in two cases:
     *   - the content is not encrypted.
     *   - We don't have any decryption data yet.
     *
     * /!\ Note that new encryption initialization data can be added progressively
     * through the `_addProtectionData` method or through Manifest updates.
     * It is thus highly advised to only rely on this method once every protection
     * data related to this Representation has been known to be added.
     *
     * The main situation where new encryption initialization data is added is
     * after parsing this Representation's initialization segment, if one exists.
     * @returns {Array.<Object>}
     */
    Representation.prototype.getAllEncryptionData = function () {
        var _a, _b;
        if (this.contentProtections === undefined ||
            this.contentProtections.initData.length === 0) {
            return [];
        }
        var keyIds = (_b = (_a = this.contentProtections) === null || _a === void 0 ? void 0 : _a.keyIds) === null || _b === void 0 ? void 0 : _b.map(function (val) { return val.keyId; });
        return this.contentProtections.initData.map(function (x) {
            return { type: x.type, keyIds: keyIds, values: x.values };
        });
    };
    /**
     * Add new encryption initialization data to this Representation if it was not
     * already included.
     *
     * Returns `true` if new encryption initialization data has been added.
     * Returns `false` if none has been added (e.g. because it was already known).
     *
     * /!\ Mutates the current Representation
     *
     * TODO better handle use cases like key rotation by not always grouping
     * every protection data together? To check.
     * @param {string} initDataType
     * @param {Uint8Array|undefined} keyId
     * @param {Uint8Array} data
     * @returns {boolean}
     */
    Representation.prototype._addProtectionData = function (initDataType, keyId, data) {
        var hasUpdatedProtectionData = false;
        if (this.contentProtections === undefined) {
            this.contentProtections = { keyIds: keyId !== undefined ? [{ keyId: keyId }] : [],
                initData: [{ type: initDataType,
                        values: data }] };
            return true;
        }
        if (keyId !== undefined) {
            var keyIds = this.contentProtections.keyIds;
            if (keyIds === undefined) {
                this.contentProtections.keyIds = [{ keyId: keyId }];
            }
            else {
                var foundKeyId = false;
                for (var _i = 0, keyIds_1 = keyIds; _i < keyIds_1.length; _i++) {
                    var knownKeyId = keyIds_1[_i];
                    if (areArraysOfNumbersEqual(knownKeyId.keyId, keyId)) {
                        foundKeyId = true;
                    }
                }
                if (!foundKeyId) {
                    log.warn("Manifest: found unanounced key id.");
                    keyIds.push({ keyId: keyId });
                }
            }
        }
        var cInitData = this.contentProtections.initData;
        for (var i = 0; i < cInitData.length; i++) {
            if (cInitData[i].type === initDataType) {
                var cValues = cInitData[i].values;
                // loop through data
                for (var dataI = 0; dataI < data.length; dataI++) {
                    var dataToAdd = data[dataI];
                    var cValuesIdx = void 0;
                    for (cValuesIdx = 0; cValuesIdx < cValues.length; cValuesIdx++) {
                        if (dataToAdd.systemId === cValues[cValuesIdx].systemId) {
                            if (areArraysOfNumbersEqual(dataToAdd.data, cValues[cValuesIdx].data)) {
                                // go to next dataToAdd
                                break;
                            }
                            else {
                                log.warn("Manifest: different init data for the same system ID");
                            }
                        }
                    }
                    if (cValuesIdx === cValues.length) {
                        // we didn't break the loop === we didn't already find that value
                        cValues.push(dataToAdd);
                        hasUpdatedProtectionData = true;
                    }
                }
                return hasUpdatedProtectionData;
            }
        }
        // If we are here, this means that we didn't find the corresponding
        // init data type in this.contentProtections.initData.
        this.contentProtections.initData.push({ type: initDataType,
            values: data });
        return true;
    };
    return Representation;
}());
export default Representation;
