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
import hashBuffer from "../../../utils/hash_buffer";
import { IInitializationDataInfo } from "../types";

/**
 * Store a unique value associated to an initData and initDataType.
 * @class InitDataStore
 */
export default class InitDataStore<T> {
  /**
   * Contains every stored elements alongside the corresponding initialization
   * data, in storage chronological order (from first stored to last stored).
   */
  private _storage : Array<{
    /**
     * Initialization data type.
     * String describing the format of the initialization data sent through this
     * event.
     * https://www.w3.org/TR/eme-initdata-registry/
     *
     * `undefined` if not known.
     */
    type : string | undefined;
    /**
     * Every initialization data for that type.
     *
     * /!\ It is very important to always sort them the same way, if two events
     * contain the same data.
     * Failure to do so might result in multiple licenses fetched for the same
     * content.
     */
    values: Array<{
      /**
       * Hex encoded system id, which identifies the key system.
       * https://dashif.org/identifiers/content_protection/
       *
       * If `undefined`, we don't know the system id for that initialization data.
       * In that case, the initialization data might even be a concatenation of
       * the initialization data from multiple system ids.
       */
      systemId : string | undefined;
      /**
       * The initialization data itself for that type and systemId.
       * For example, with ISOBMFF "cenc" initialization data, this will be the
       * whole PSSH box.
       */
      data: Uint8Array;

      /**
       * A hash of the `data` property, done with the `hashBuffer` util, for
       * faster comparison.
       */
      hash : number;
    }>;
    payload : T;
  }>;

  /** Construct a new InitDataStore.  */
  constructor() {
    this._storage = [];
  }

  /**
   * Returns all stored value, in the order in which they have been stored.
   * Note: it is possible to move a value to the end of this array by calling
   * the `getAndReuse` method.
   * @returns {Array}
   */
  public getAll() : T[] {
    return this._storage.map(item => item.payload);
  }

  /**
   * Returns the number of stored values.
   * @returns {number}
   */
  public getLength() : number {
    return this._storage.length;
  }

  /**
   * Returns the element associated with the given initData and initDataType.
   * Returns `undefined` if not found.
   * @param {Uint8Array} initData
   * @param {string|undefined} initDataType
   * @returns {*}
   */
  public get(initializationData : IInitializationDataInfo) : T | undefined {
    const index = this._findIndex(initializationData);
    return index >= 0 ? this._storage[index].payload :
                        undefined;
  }

  /**
   * Like `get`, but also move the corresponding value at the end of the store
   * (as returned by `getAll`) if found.
   * This can be used for example to tell when a previously-stored value is
   * re-used to then be able to implement a caching replacement algorithm based
   * on the least-recently-used values by just evicting the first values
   * returned by `getAll`.
   * @param {Uint8Array} initData
   * @param {string|undefined} initDataType
   * @returns {*}
   */
  public getAndReuse(
    initializationData : IInitializationDataInfo
  ) : T | undefined {
    const index = this._findIndex(initializationData);
    if (index === -1) {
      return undefined;
    }
    const item = this._storage.splice(index, 1)[0];
    this._storage.push(item);
    return item.payload;
  }

  /**
   * Add to the store a value linked to the corresponding initData and
   * initDataType.
   * If a value was already stored linked to those, replace it.
   * @param {Object} initializationData
   * @param {*} payload
   */
  public store(
    initializationData : IInitializationDataInfo,
    payload : T
  ) : void {
    const indexOf = this._findIndex(initializationData);
    if (indexOf >= 0) {
      // this._storage contains the stored value in the same order they have
      // been put. So here we want to remove the previous element and re-push
      // it to the end.
      this._storage.splice(indexOf, 1);
    }
    this._storage.push({ type: initializationData.type,
                         values: initializationData.values.map(v => {
                           return { systemId: v.systemId,
                                    data: v.data,
                                    hash: hashBuffer(v.data) };
                         }),
                         payload });
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
   * @param {Object} initializationData
   * @param {*} payload
   * @returns {boolean}
   */
  public storeIfNone(
    initializationData : IInitializationDataInfo,
    payload : T
  ) : boolean {
    const indexOf = this._findIndex(initializationData);
    if (indexOf >= 0) {
      return false;
    }
    this._storage.push({ type: initializationData.type,
                         values: initializationData.values.map(v => {
                           return { systemId: v.systemId,
                                    data: v.data,
                                    hash: hashBuffer(v.data) };
                         }),
                         payload });
    return true;
  }

  /**
   * Remove an initDataType and initData combination from this store.
   * Returns the associated value if it has been found, `undefined` otherwise.
   * @param {Uint8Array} initData
   * @param {string|undefined} initDataType
   * @returns {*}
   */
  public remove(initializationData : IInitializationDataInfo) : T | undefined {
    const indexOf = this._findIndex(initializationData);
    if (indexOf === -1) {
      return undefined;
    }
    return this._storage.splice(indexOf, 1)[0].payload;
  }

  /**
   * Find the index of the corresponding initialization data in `this._storage`.
   * Returns `-1` if not found.
   * @param {Object} initializationData
   * @returns {boolean}
   */
  private _findIndex(
    initializationData : IInitializationDataInfo
  ) : number {
    // Begin by the last element as we usually re-encounter the last stored
    // initData sooner than the first one.
    for (let i = this._storage.length - 1; i >= 0; i--) {
      const stored = this._storage[i];
      if (stored.type === initializationData.type) {
        if (containValues(stored.values, initializationData.values)) {
          return i;
        }
      }
    }
    return -1;
  }
}

/**
 * Returns `true` if `subset` data is completely contained in `stored`.
 * @param {Array.<Object>} stored
 * @param {Array.<Object>} subset
 * @returns {boolean}
 */
function containValues(
  stored : Array<{ systemId : string | undefined;
                   hash : number;
                   data : Uint8Array; }>,
  subset : Array<{ systemId : string | undefined;
                   data : Uint8Array; }>
) : boolean {
  return subset.every(subElt => {
    const hash = hashBuffer(subElt.data);
    return stored.some(storedElt => subElt.systemId === storedElt.systemId &&
                                    hash            === storedElt.hash &&
                                    areArraysOfNumbersEqual(subElt.data,
                                                            storedElt.data));
  });
}
