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
     * Attributes each linked to a single registered callbacks which listen to the
     * referenced value's updates.
     *
     * Contains the following properties:
     *   - `trigger`: Function which will be called with the new reference's value
     *     once it changes
     *   - `complete`: Allows to clean-up the listener, will be called once the
     *     reference is finished.
     *   - `hasBeenCleared`: becomes `true` when the Observable becomes
     *     unsubscribed and thus when it is removed from the `cbs` array.
     *     Adding this property allows to detect when a previously-added
     *     listener has since been removed e.g. as a side-effect during a
     *     function call.
     *   - `complete`: Callback to call when the current Reference is "finished".
     */
    var cbs = [];
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
         * @param {*} newVal
         */
        setValue: function (newVal) {
            if (isFinished) {
                if (0 /* __ENVIRONMENT__.CURRENT_ENV */ === 1 /* __ENVIRONMENT__.DEV */) {
                    /* eslint-disable-next-line no-console */
                    console.error("Finished shared references cannot be updated");
                }
                return;
            }
            value = newVal;
            if (cbs.length === 0) {
                return;
            }
            var clonedCbs = cbs.slice();
            for (var _i = 0, clonedCbs_1 = clonedCbs; _i < clonedCbs_1.length; _i++) {
                var cbObj = clonedCbs_1[_i];
                try {
                    if (!cbObj.hasBeenCleared) {
                        cbObj.trigger(newVal);
                    }
                }
                catch (_) {
                    /* nothing */
                }
            }
        },
        /**
         * Update the value of this shared reference only if it changed.
         * @param {*} newVal
         */
        setValueIfChanged: function (newVal) {
            if (newVal !== value) {
                this.setValue(newVal);
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
                var cbObj = { trigger: obs.next.bind(obs),
                    complete: obs.complete.bind(obs),
                    hasBeenCleared: false };
                cbs.push(cbObj);
                return function () {
                    /**
                     * Code in here can still be running while this is happening.
                     * Set `hasBeenCleared` to `true` to avoid still using the
                     * `subscriber` from this object.
                     */
                    cbObj.hasBeenCleared = true;
                    var indexOf = cbs.indexOf(cbObj);
                    if (indexOf >= 0) {
                        cbs.splice(indexOf, 1);
                    }
                };
            });
        },
        /**
         * Allows to register a callback to be called each time the value inside the
         * reference is updated.
         * @param {Function} cb - Callback to be called each time the reference is
         * updated. Takes the new value im argument.
         * @param {Object|undefined} [options]
         * @param {Object|undefined} [options.clearSignal] - Allows to provide a
         * CancellationSignal which will unregister the callback when it emits.
         * @param {boolean|undefined} [options.emitCurrentValue] - If `true`, the
         * callback will also be immediately called with the current value.
         */
        onUpdate: function (cb, options) {
            if ((options === null || options === void 0 ? void 0 : options.emitCurrentValue) === true) {
                cb(value);
            }
            if (isFinished) {
                return;
            }
            var cbObj = { trigger: cb,
                complete: unlisten,
                hasBeenCleared: false };
            cbs.push(cbObj);
            if ((options === null || options === void 0 ? void 0 : options.clearSignal) === undefined) {
                return;
            }
            options.clearSignal.register(unlisten);
            function unlisten() {
                /**
                 * Code in here can still be running while this is happening.
                 * Set `hasBeenCleared` to `true` to avoid still using the
                 * `subscriber` from this object.
                 */
                cbObj.hasBeenCleared = true;
                var indexOf = cbs.indexOf(cbObj);
                if (indexOf >= 0) {
                    cbs.splice(indexOf, 1);
                }
            }
        },
        /**
         * Indicate that no new values will be emitted.
         * Allows to automatically close all Observables generated from this shared
         * reference.
         */
        finish: function () {
            isFinished = true;
            var clonedCbs = cbs.slice();
            for (var _i = 0, clonedCbs_2 = clonedCbs; _i < clonedCbs_2.length; _i++) {
                var cbObj = clonedCbs_2[_i];
                try {
                    if (!cbObj.hasBeenCleared) {
                        cbObj.complete();
                    }
                    cbObj.hasBeenCleared = true;
                }
                catch (_) {
                    /* nothing */
                }
            }
            cbs.length = 0;
        },
    };
}
/**
 * Create a new `ISharedReference` based on another one by mapping over its
 * referenced value each time it is updated.
 * @param {Object} originalRef - The Original `ISharedReference` you wish to map
 * over.
 * @param {Function} mappingFn - The mapping function which will receives
 * `originalRef`'s value and outputs this new reference's value.
 * @param {Object | undefined} [cancellationSignal] - Optionally, a
 * `CancellationSignal` which will finish that reference when it emits.
 * @returns {Object} - The new, mapped, reference.
 */
export function createMappedReference(originalRef, mappingFn, cancellationSignal) {
    var newRef = createSharedReference(mappingFn(originalRef.getValue()));
    originalRef.onUpdate(function mapOriginalReference(x) {
        newRef.setValue(mappingFn(x));
    }, { clearSignal: cancellationSignal });
    // TODO nothing is done if `originalRef` is finished, though the returned
    // reference could also be finished in that case. To do?
    if (cancellationSignal !== undefined) {
        cancellationSignal.register(function () {
            newRef.finish();
        });
    }
    return newRef;
}
export default createSharedReference;
