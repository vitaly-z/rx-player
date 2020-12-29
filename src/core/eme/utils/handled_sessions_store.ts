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

import { Period } from "../../../manifest";
import areArraysOfNumbersEqual from "../../../utils/are_arrays_of_numbers_equal";
import hashBuffer from "../../../utils/hash_buffer";

export type ISingleLicensePerOptionValue = "period" |
                                           "init-data" |
                                           "content";

/**
 * Object regrouping every properties that could allow to identify a unique
 * MediaKeySession.
 */
export interface ISessionIdentifierObject {
  /**
   * The Period linked to that initialization data.
   * Can be used e.g. to identify an already-created MediaKeySession for another
   * initialization data, when both share the same license.
   * `undefined` if not known.
   */
  period : Period | undefined;
  /**
   * The keyId(s) linked to the current encryption initialization data.
   * `undefined` if not known.
   */
  keyIds : Uint8Array[] | undefined;
  /**
   * The encryption initialization data that will be sent to the
   * `generateRequest` API.
   * At most one MediaKeySession per `initData` and `initDataType` can be stored
   * at the same time.
   * `undefined` if not known.
   */
  initData : Uint8Array | undefined;
  /*
   * Format of the `initData` attribute.
   * `undefined` if unknown.
   */
  initDataType : string | undefined;
}

export interface IKeyStatus {
  alreadyHandled : boolean;
  blacklisted : boolean;
}

abstract class IKeysStore {
  public register(period : Period | undefined,
                  initData : Uint8Array,
                  initDataType : string | undefined) : IKeyStatus;
}

class contentBasedStore {
  this._alreadyHandled
  constructor(
}

class PeriodBasedStore {
  private _storage : ISessionIdentifierObject[];
  constructor() {
    this._storage = [];
  }

  public register(sessionData : ISessionIdentifierObject) : IKeyStatus {

  }

  public blacklistKeyIds(keyIds : Uint8Array[])

  public blacklistSession
//   /**
//    * Find the index of the corresponding initData and initDataType in
//    * `this._storage`. Returns `-1` if not found.
//    * @param {Uint8Array} initData
//    * @param {string|undefined} initDataType
//    * @param {number} initDataHash
//    * @returns {boolean}
//    */
//   private _findIndex(
//     initData : Uint8Array,
//     initDataType : string|undefined,
//     initDataHash : number
//   ) : number {
//     // Begin by the last element as we usually re-encounter the last stored
//     // initData sooner than the first one.
//     for (let i = this._storage.length - 1; i >= 0; i--) {
//       const stored = this._storage[i];
//       if (initDataHash === stored.initDataHash && initDataType === stored.initDataType) {
//         if (areArraysOfNumbersEqual(initData, stored.initData)) {
//           return i;
//         }
//       }
//     }
//     return -1;
//   }
}

/**
 * @class HandledSessionsStore
 */
export default class HandledKeysStore<T> {
  private _singleSessionPer : ISingleLicensePerOptionValue;

  /**
   * Contains every stored elements alongside the corresponding initialization
   * data, in storage chronological order (from first stored to last stored).
   */
  private _storage : Array<{ initDataType : string | undefined;
                             initDataHash : number;
                             initData: Uint8Array;
                             period : Period;
                             value : T; }>;

  /** Construct a new InitDataStore.  */
  constructor(singleLicensePer : ISingleLicensePerOptionValue) {
    this._storage = [];
    this._singleSessionPer = singleLicensePer;
  }

  /**
   * Add to the store a value linked to the corresponding initData and
   * initDataType.
   * If a value linked to those was already stored, do nothing and returns
   * `false`.
   * If not, add the value and return `true`.
   *
   * This can be used as a more performant version of doing both a `get` call -
   * to see if a value is stored linked to that data - and then if not doing a
   * store. `storeIfNone` is more performant as it will only perform hashing
   * and a look-up a single time.
   * @param {Uint8Array} initData
   * @param {string|undefined} initDataType
   * @returns {boolean}
   */
  public getStatusOrStore(
    period : Period | undefined,
    initData : Uint8Array,
    initDataType : string | undefined,
    value : T
  ) : boolean {
    const initDataHash = hashBuffer(initData);
    const indexOf = this._findIndex(initData, initDataType, initDataHash);
    if (indexOf >= 0) {
      return false;
    }
    this._storage.push({ initData, initDataType, initDataHash, value });
    return true;
  }
//   /**
//    * Find the index of the corresponding initData and initDataType in
//    * `this._storage`. Returns `-1` if not found.
//    * @param {Uint8Array} initData
//    * @param {string|undefined} initDataType
//    * @param {number} initDataHash
//    * @returns {boolean}
//    */
//   private _findIndex(
//     initData : Uint8Array,
//     initDataType : string|undefined,
//     initDataHash : number
//   ) : number {
//     // Begin by the last element as we usually re-encounter the last stored
//     // initData sooner than the first one.
//     for (let i = this._storage.length - 1; i >= 0; i--) {
//       const stored = this._storage[i];
//       if (initDataHash === stored.initDataHash && initDataType === stored.initDataType) {
//         if (areArraysOfNumbersEqual(initData, stored.initData)) {
//           return i;
//         }
//       }
//     }
//     return -1;
//   }

//   /**
//    * Returns all stored value, in the order in which they have been stored.
//    * Note: it is possible to move a value to the end of this array by calling
//    * the `getAndReuse` method.
//    * @returns {Array}
//    */
//   public getAll() : T[] {
//     return this._storage.map(item => item.value);
//   }

//   /**
//    * Returns the number of stored values.
//    * @returns {number}
//    */
//   public getLength() : number {
//     return this._storage.length;
//   }

//   /**
//    * Returns the element associated with the given initData and initDataType.
//    * Returns `undefined` if not found.
//    * @param {Uint8Array} initData
//    * @param {string|undefined} initDataType
//    * @returns {*}
//    */
//   public get(
//     initData : Uint8Array,
//     initDataType : string|undefined
//   ) : T|undefined {
//     const initDataHash = hashBuffer(initData);
//     const index = this._findIndex(initData, initDataType, initDataHash);
//     return index >= 0 ? this._storage[index].value :
//                         undefined;
//   }

//   /**
//    * Like `get`, but also move the corresponding value at the end of the store
//    * (as returned by `getAll`) if found.
//    * This can be used for example to tell when a previously-stored value is
//    * re-used to then be able to implement a caching replacement algorithm based
//    * on the least-recently-used values by just evicting the first values
//    * returned by `getAll`.
//    * @param {Uint8Array} initData
//    * @param {string|undefined} initDataType
//    * @returns {*}
//    */
//   public getAndReuse(
//     initData : Uint8Array,
//     initDataType : string | undefined
//   ) : T | undefined {
//     const initDataHash = hashBuffer(initData);
//     const index = this._findIndex(initData, initDataType, initDataHash);
//     if (index === -1) {
//       return undefined;
//     }
//     const item = this._storage.splice(index, 1)[0];
//     this._storage.push(item);
//     return item.value;
//   }

//   /**
//    * Add to the store a value linked to the corresponding initData and
//    * initDataType.
//    * If a value was already stored linked to those, replace it.
//    * @param {Uint8Array} initData
//    * @param {string|undefined} initDataType
//    * @returns {boolean}
//    */
//   public store(
//     initData : Uint8Array,
//     initDataType : string | undefined,
//     value : T
//   ) : void {
//     const initDataHash = hashBuffer(initData);
//     const indexOf = this._findIndex(initData, initDataType, initDataHash);
//     if (indexOf >= 0) {
//       // this._storage contains the stored value in the same order they have
//       // been put. So here we want to remove the previous element and re-push
//       // it to the end.
//       this._storage.splice(indexOf, 1);
//     }
//     this._storage.push({ initData, initDataType, initDataHash, value });
//   }

//   /**
//    * Add to the store a value linked to the corresponding initData and
//    * initDataType.
//    * If a value linked to those was already stored, do nothing and returns
//    * `false`.
//    * If not, add the value and return `true`.
//    *
//    * This can be used as a more performant version of doing both a `get` call -
//    * to see if a value is stored linked to that data - and then if not doing a
//    * store. `storeIfNone` is more performant as it will only perform hashing
//    * and a look-up a single time.
//    * @param {Uint8Array} initData
//    * @param {string|undefined} initDataType
//    * @returns {boolean}
//    */
//   public storeIfNone(
//     initData : Uint8Array,
//     initDataType : string | undefined,
//     value : T
//   ) : boolean {
//     const initDataHash = hashBuffer(initData);
//     const indexOf = this._findIndex(initData, initDataType, initDataHash);
//     if (indexOf >= 0) {
//       return false;
//     }
//     this._storage.push({ initData, initDataType, initDataHash, value });
//     return true;
//   }

//   /**
//    * Remove an initDataType and initData combination from this store.
//    * Returns the associated value if it has been found, `undefined` otherwise.
//    * @param {Uint8Array} initData
//    * @param {string|undefined} initDataType
//    * @returns {*}
//    */
//   public remove(
//     initData : Uint8Array,
//     initDataType : string | undefined
//   ) : T | undefined {
//     const initDataHash = hashBuffer(initData);
//     const indexOf = this._findIndex(initData, initDataType, initDataHash);
//     if (indexOf === -1) {
//       return undefined;
//     }
//     return this._storage.splice(indexOf, 1)[0].value;
//   }

//   /**
//    * Find the index of the corresponding initData and initDataType in
//    * `this._storage`. Returns `-1` if not found.
//    * @param {Uint8Array} initData
//    * @param {string|undefined} initDataType
//    * @param {number} initDataHash
//    * @returns {boolean}
//    */
//   private _findIndex(
//     initData : Uint8Array,
//     initDataType : string|undefined,
//     initDataHash : number
//   ) : number {
//     // Begin by the last element as we usually re-encounter the last stored
//     // initData sooner than the first one.
//     for (let i = this._storage.length - 1; i >= 0; i--) {
//       const stored = this._storage[i];
//       if (initDataHash === stored.initDataHash && initDataType === stored.initDataType) {
//         if (areArraysOfNumbersEqual(initData, stored.initData)) {
//           return i;
//         }
//       }
//     }
//     return -1;
//   }
}
