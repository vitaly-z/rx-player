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
import isNullOrUndefined from "./is_null_or_undefined";
/**
 * Simple but fully type-safe EventEmitter implementation.
 * @class EventEmitter
 */
var EventEmitter = /** @class */ (function () {
    function EventEmitter() {
        this._listeners = {};
    }
    /**
     * Register a new callback for an event.
     *
     * @param {string} evt - The event to register a callback to
     * @param {Function} fn - The callback to call as that event is triggered.
     * The callback will take as argument the eventual payload of the event
     * (single argument).
     * @param {Object | undefined} cancellationSignal - When that signal emits,
     * the event listener is automatically removed.
     */
    EventEmitter.prototype.addEventListener = function (evt, fn, cancellationSignal) {
        var _this = this;
        var listeners = this._listeners[evt];
        if (!Array.isArray(listeners)) {
            this._listeners[evt] = [fn];
        }
        else {
            listeners.push(fn);
        }
        if (cancellationSignal !== undefined) {
            cancellationSignal.register(function () {
                _this.removeEventListener(evt, fn);
            });
        }
    };
    /**
     * Unregister callbacks linked to events.
     * @param {string} [evt] - The event for which the callback[s] should be
     * unregistered. Set it to null or undefined to remove all callbacks
     * currently registered (for any event).
     * @param {Function} [fn] - The callback to unregister. If set to null
     * or undefined while the evt argument is set, all callbacks linked to that
     * event will be unregistered.
     */
    EventEmitter.prototype.removeEventListener = function (evt, fn) {
        if (isNullOrUndefined(evt)) {
            this._listeners = {};
            return;
        }
        var listeners = this._listeners[evt];
        if (!Array.isArray(listeners)) {
            return;
        }
        if (isNullOrUndefined(fn)) {
            delete this._listeners[evt];
            return;
        }
        var index = listeners.indexOf(fn);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
        if (listeners.length === 0) {
            delete this._listeners[evt];
        }
    };
    /**
     * Trigger every registered callbacks for a given event
     * @param {string} evt - The event to trigger
     * @param {*} arg - The eventual payload for that event. All triggered
     * callbacks will recieve this payload as argument.
     */
    EventEmitter.prototype.trigger = function (evt, arg) {
        var listeners = this._listeners[evt];
        if (!Array.isArray(listeners)) {
            return;
        }
        listeners.slice().forEach(function (listener) {
            try {
                listener(arg);
            }
            catch (e) {
                log.error("EventEmitter: listener error", e instanceof Error ? e : null);
            }
        });
    };
    return EventEmitter;
}());
export default EventEmitter;
/**
 * Simple redefinition of the fromEvent from rxjs to also work on our
 * implementation of EventEmitter with type-checked strings
 * @param {Object} target
 * @param {string} eventName
 * @returns {Observable}
 */
export function fromEvent(target, eventName) {
    return new Observable(function (obs) {
        function handler(event) {
            obs.next(event);
        }
        target.addEventListener(eventName, handler);
        return function () {
            target.removeEventListener(eventName, handler);
        };
    });
}
