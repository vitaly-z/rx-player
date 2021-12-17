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
import { Observable, } from "rxjs";
import log from "../log";
/**
 * Create an `ISharedReference` object encapsulating the mutable `initialValue`
 * value of type T.
 *
 * @see ISharedReference
 * @param {*} initialValue
 * @returns {Observable}
 */
export function createSharedReference(initialValue) {
    /** Current value referenced by this `ISharedReference`. */
    var value = initialValue;
    /**
     * List of currently subscribed Observables which listen to the referenced
     * value's updates.
     *
     * Contains two properties:
     *   - `subscriber`: interface through which new value will be communicated.
     *   - `hasBeenUnsubscribed`: becomes `true` when the Observable becomes
     *     unsubscribed and thus when it is removed from the `subs` array.
     *     Adding this property allows to detect when a previously-added
     *     Observable has since been unsubscribed e.g. as a side-effect during a
     *     function call.
     */
    var subs = [];
    var isFinished = false;
    return {
        /**
         * Returns the current value of this shared reference.
         * @returns {*}
         */
        getValue: function () {
            return value;
        },
        /**
         * Update the value of this shared reference.
         * @param {*}
         */
        setValue: function (newVal) {
            if (isFinished) {
                if (0 /* CURRENT_ENV */ === 1 /* DEV */) {
                    throw new Error("Finished shared references cannot be updated");
                }
                else {
                    log.error("Finished shared references cannot be updated");
                    return;
                }
            }
            value = newVal;
            if (subs.length === 0) {
                return;
            }
            var clonedSubs = subs.slice();
            for (var _i = 0, clonedSubs_1 = clonedSubs; _i < clonedSubs_1.length; _i++) {
                var subObj = clonedSubs_1[_i];
                try {
                    if (!subObj.hasBeenUnsubscribed) {
                        subObj.subscriber.next(newVal);
                    }
                }
                catch (_) {
                    /* nothing */
                }
            }
        },
        /**
         * Returns an Observable which synchronously emits the current value (unless
         * the `skipCurrentValue` argument has been set to `true`) and then each
         * time a new value is set.
         * @param {boolean} [skipCurrentValue]
         * @returns {Observable}
         */
        asObservable: function (skipCurrentValue) {
            return new Observable(function (obs) {
                if (skipCurrentValue !== true) {
                    obs.next(value);
                }
                if (isFinished) {
                    obs.complete();
                    return undefined;
                }
                var subObj = { subscriber: obs,
                    hasBeenUnsubscribed: false };
                subs.push(subObj);
                return function () {
                    /**
                     * Code in here can still be running while this is happening.
                     * Set `hasBeenUnsubscribed` to `true` to avoid still using the
                     * `subscriber` from this object.
                     */
                    subObj.hasBeenUnsubscribed = true;
                    var indexOf = subs.indexOf(subObj);
                    if (indexOf >= 0) {
                        subs.splice(indexOf, 1);
                    }
                };
            });
        },
        /**
         * Indicate that no new values will be emitted.
         * Allows to automatically close all Observables generated from this shared
         * reference.
         */
        finish: function () {
            isFinished = true;
            var clonedSubs = subs.slice();
            for (var _i = 0, clonedSubs_2 = clonedSubs; _i < clonedSubs_2.length; _i++) {
                var subObj = clonedSubs_2[_i];
                try {
                    if (!subObj.hasBeenUnsubscribed) {
                        subObj.subscriber.complete();
                    }
                }
                catch (_) {
                    /* nothing */
                }
            }
        },
    };
}
export default createSharedReference;
