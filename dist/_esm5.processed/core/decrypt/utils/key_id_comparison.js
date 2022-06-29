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
import areArraysOfNumbersEqual from "../../../utils/are_arrays_of_numbers_equal";
/**
 * Returns `true` if both given key id appear to be equal.
 * @param {Uint8Array} keyId1
 * @param {Uint8Array} keyId2
 * @returns {boolean}
 */
export function areKeyIdsEqual(keyId1, keyId2) {
    return keyId1 === keyId2 || areArraysOfNumbersEqual(keyId1, keyId2);
}
/**
 * @param {Uint8Array} wantedKeyId
 * @param {Array.<Uint8Array>} keyIdsArr
 * @returns {boolean}
 */
export function isKeyIdContainedIn(wantedKeyId, keyIdsArr) {
    return keyIdsArr.some(function (k) { return areKeyIdsEqual(k, wantedKeyId); });
}
/**
 * Returns `true` if all key ids in `wantedKeyIds` are present in the
 * `keyIdsArr` array.
 * @param {Array.<Uint8Array>} wantedKeyIds
 * @param {Array.<Uint8Array>} keyIdsArr
 * @returns {boolean}
 */
export function areAllKeyIdsContainedIn(wantedKeyIds, keyIdsArr) {
    var _loop_1 = function (keyId) {
        var found = keyIdsArr.some(function (k) { return areKeyIdsEqual(k, keyId); });
        if (!found) {
            return { value: false };
        }
    };
    for (var _i = 0, wantedKeyIds_1 = wantedKeyIds; _i < wantedKeyIds_1.length; _i++) {
        var keyId = wantedKeyIds_1[_i];
        var state_1 = _loop_1(keyId);
        if (typeof state_1 === "object")
            return state_1.value;
    }
    return true;
}
/**
 * Returns `true` if at least one key id in `wantedKeyIds` is present in the
 * `keyIdsArr` array.
 * @param {Array.<Uint8Array>} wantedKeyIds
 * @param {Array.<Uint8Array>} keyIdsArr
 * @returns {boolean}
 */
export function areSomeKeyIdsContainedIn(wantedKeyIds, keyIdsArr) {
    var _loop_2 = function (keyId) {
        var found = keyIdsArr.some(function (k) { return areKeyIdsEqual(k, keyId); });
        if (found) {
            return { value: true };
        }
    };
    for (var _i = 0, wantedKeyIds_2 = wantedKeyIds; _i < wantedKeyIds_2.length; _i++) {
        var keyId = wantedKeyIds_2[_i];
        var state_2 = _loop_2(keyId);
        if (typeof state_2 === "object")
            return state_2.value;
    }
    return false;
}
