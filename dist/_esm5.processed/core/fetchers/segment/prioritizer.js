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
import log from "../../../log";
import arrayFindIndex from "../../../utils/array_find_index";
/**
 * Create Observables which can be priorized between one another.
 *
 * With this class, you can link an Observables to a priority number.
 * The lower this number is, the more priority the resulting Observable will
 * have.
 *
 * Such returned Observables - called "tasks" - will then basically wait for
 * pending task with more priority (i.e. a lower priority number) to finish
 * before "starting".
 *
 * This only applies for non-pending tasks. For pending tasks, those are usually
 * not interrupted except in the following case:
 *
 * When a task with a "high priority" (which is a configurable priority
 * value) is created, pending tasks with a "low priority" (also configurable)
 * will be interrupted. Those tasks will be restarted when all tasks with a
 * higher priority are finished.
 *
 * You can also update the priority of an already-created task.
 *
 * ```js
 * const observable1 = Observable.timer(100).pipe(mapTo(1));
 * const observable2 = Observable.timer(100).pipe(mapTo(2));
 * const observable3 = Observable.timer(100).pipe(mapTo(3));
 * const observable4 = Observable.timer(100).pipe(mapTo(4));
 * const observable5 = Observable.timer(100).pipe(mapTo(5));
 *
 * // Instanciate ObservablePrioritizer.
 * // Also provide a `high` priority step - the maximum priority number a "high
 * // priority task" has and a `low` priority step - the minimum priority number
 * // a "low priority task" has.
 * const prioritizer = new ObservablePrioritizer({
 *   prioritySteps: { high: 0, low: 20 }
 * });
 *
 * const pObservable1 = prioritizer.create(observable1, 4);
 * const pObservable2 = prioritizer.create(observable2, 2);
 * const pObservable3 = prioritizer.create(observable3, 1);
 * const pObservable4 = prioritizer.create(observable4, 3);
 * const pObservable5 = prioritizer.create(observable5, 2);
 *
 * // start every Observables at the same time
 * observableMerge(
 *   pObservable1,
 *   pObservable2,
 *   pObservable3,
 *   pObservable4,
 *   pObservable5
 * ).subscribe((evt) => {
 *   if (evt.type === "data") {
 *     console.log(i);
 *
 *     // To spice things up, update pObservable1 priority to go before
 *     // pObservable4
 *     if (i === 5) { // if pObservable5 is currently emitting
 *       prioritizer.updatePriority(pObservable1, 1);
 *     }
 *   }
 * });
 *
 * // Result:
 * // 3
 * // 2
 * // 5
 * // 1
 * // 4
 *
 * // Note: here "1" goes before "4" only because the former's priority has been
 * // updated before the latter was started.
 * // It would be the other way around if not.
 * ```
 *
 * @class ObservablePrioritizer
 */
var ObservablePrioritizer = /** @class */ (function () {
    /**
     * @param {Options} prioritizerOptions
     */
    function ObservablePrioritizer(_a) {
        var prioritySteps = _a.prioritySteps;
        this._minPendingPriority = null;
        this._waitingQueue = [];
        this._pendingTasks = [];
        this._prioritySteps = prioritySteps;
        if (this._prioritySteps.high >= this._prioritySteps.low) {
            throw new Error("FP Error: the max high level priority should be given a lower" +
                "priority number than the min low priority.");
        }
    }
    /**
     * Create a priorized Observable from a base Observable.
     *
     * When subscribed to, this Observable will have its priority compared to
     * all the already-running Observables created from this class.
     *
     * Only if this number is inferior or equal to the priority of the
     * currently-running Observables will it be immediately started.
     * In the opposite case, we will wait for higher-priority Observables to
     * finish before starting it.
     *
     * Note that while this Observable is waiting for its turn, it is possible
     * to update its property through the updatePriority method, by providing
     * the Observable returned by this function and its new priority number.
     *
     * @param {Observable} obs
     * @param {number} priority
     * @returns {Observable}
     */
    ObservablePrioritizer.prototype.create = function (obs, priority) {
        var _this = this;
        var pObs$ = new Observable(function (subscriber) {
            var isStillSubscribed = true;
            // eslint-disable-next-line prefer-const
            var newTask;
            /**
             * Function allowing to start / interrupt the underlying Observable.
             * @param {Boolean} shouldRun - If `true`, the observable can run. If
             * `false` it means that it just needs to be interrupted if already
             * starte.
             */
            var trigger = function (shouldRun) {
                if (newTask.subscription !== null) {
                    newTask.subscription.unsubscribe();
                    newTask.subscription = null;
                    if (isStillSubscribed) {
                        subscriber.next({ type: "interrupted" });
                    }
                }
                if (!shouldRun) {
                    return;
                }
                _this._minPendingPriority = _this._minPendingPriority === null ?
                    newTask.priority :
                    Math.min(_this._minPendingPriority, newTask.priority);
                _this._pendingTasks.push(newTask);
                newTask.subscription = obs.subscribe({
                    next: function (evt) { return subscriber.next({ type: "data", value: evt }); },
                    error: function (error) {
                        subscriber.error(error);
                        newTask.subscription = null;
                        newTask.finished = true;
                        _this._onTaskEnd(newTask);
                    },
                    complete: function () {
                        subscriber.next({ type: "ended" });
                        if (isStillSubscribed) {
                            subscriber.complete();
                        }
                        newTask.subscription = null;
                        newTask.finished = true;
                        _this._onTaskEnd(newTask);
                    },
                });
            };
            newTask = { observable: pObs$, priority: priority, trigger: trigger, subscription: null,
                finished: false };
            if (!_this._canBeStartedNow(newTask)) {
                _this._waitingQueue.push(newTask);
            }
            else {
                newTask.trigger(true);
                if (_this._isRunningHighPriorityTasks()) {
                    // Note: we want to begin interrupting low-priority tasks just
                    // after starting the current one because the interrupting
                    // logic can call external code.
                    // This would mean re-entrancy, itself meaning that some weird
                    // half-state could be reached unless we're very careful.
                    // To be sure no harm is done, we put that code at the last
                    // possible position (the previous Observable sould be
                    // performing all its initialization synchronously).
                    _this._interruptCancellableTasks();
                }
            }
            /** Callback called when this Observable is unsubscribed to. */
            return function () {
                isStillSubscribed = false;
                if (newTask.subscription !== null) {
                    newTask.subscription.unsubscribe();
                    newTask.subscription = null;
                }
                if (newTask.finished) { // Task already finished, we're good
                    return;
                }
                // remove it from waiting queue if in it
                var waitingQueueIndex = arrayFindIndex(_this._waitingQueue, function (elt) { return elt.observable === pObs$; });
                if (waitingQueueIndex >= 0) { // If it was still waiting for its turn
                    _this._waitingQueue.splice(waitingQueueIndex, 1);
                }
                else {
                    // remove it from pending queue if in it
                    var pendingTasksIndex = arrayFindIndex(_this._pendingTasks, function (elt) { return elt.observable === pObs$; });
                    if (pendingTasksIndex < 0) {
                        log.warn("FP: unsubscribing non-existent task");
                        return;
                    }
                    var pendingTask = _this._pendingTasks.splice(pendingTasksIndex, 1)[0];
                    if (_this._pendingTasks.length === 0) {
                        _this._minPendingPriority = null;
                        _this._loopThroughWaitingQueue();
                    }
                    else if (_this._minPendingPriority === pendingTask.priority) {
                        _this._minPendingPriority = Math.min.apply(Math, _this._pendingTasks.map(function (t) { return t.priority; }));
                        _this._loopThroughWaitingQueue();
                    }
                }
            };
        });
        return pObs$;
    };
    /**
     * Update the priority of an Observable created through the `create` method.
     * @param {Observable} obs
     * @param {number} priority
     */
    ObservablePrioritizer.prototype.updatePriority = function (obs, priority) {
        var waitingQueueIndex = arrayFindIndex(this._waitingQueue, function (elt) { return elt.observable === obs; });
        if (waitingQueueIndex >= 0) { // If it was still waiting for its turn
            var waitingQueueElt = this._waitingQueue[waitingQueueIndex];
            if (waitingQueueElt.priority === priority) {
                return;
            }
            waitingQueueElt.priority = priority;
            if (!this._canBeStartedNow(waitingQueueElt)) {
                return;
            }
            this._startWaitingQueueTask(waitingQueueIndex);
            if (this._isRunningHighPriorityTasks()) {
                // Re-check to cancel every "cancellable" pending task
                //
                // Note: We start the task before interrupting cancellable tasks on
                // purpose.
                // Because both `_startWaitingQueueTask` and
                // `_interruptCancellableTasks` can emit events and thus call external
                // code, we could retrieve ourselves in a very weird state at this point
                // (for example, the different Observable priorities could all be
                // shuffled up, new Observables could have been started in the
                // meantime, etc.).
                //
                // By starting the task first, we ensure that this is manageable:
                // `_minPendingPriority` has already been updated to the right value at
                // the time we reached external code, the priority of the current
                // Observable has just been updated, and `_interruptCancellableTasks`
                // will ensure that we're basing ourselves on the last `priority` value
                // each time.
                // Doing it in the reverse order is an order of magnitude more difficult
                // to write and to reason about.
                this._interruptCancellableTasks();
            }
            return;
        }
        var pendingTasksIndex = arrayFindIndex(this._pendingTasks, function (elt) { return elt.observable === obs; });
        if (pendingTasksIndex < 0) {
            log.warn("FP: request to update the priority of a non-existent task");
            return;
        }
        var task = this._pendingTasks[pendingTasksIndex];
        if (task.priority === priority) {
            return;
        }
        var prevPriority = task.priority;
        task.priority = priority;
        if (this._minPendingPriority === null || priority < this._minPendingPriority) {
            this._minPendingPriority = priority;
        }
        else if (this._minPendingPriority === prevPriority) { // was highest priority
            if (this._pendingTasks.length === 1) {
                this._minPendingPriority = priority;
            }
            else {
                this._minPendingPriority = Math.min.apply(Math, this._pendingTasks.map(function (t) { return t.priority; }));
            }
            this._loopThroughWaitingQueue();
        }
        else {
            // We updated a task which already had a priority value higher than the
            // minimum to a value still superior to the minimum. Nothing can happen.
            return;
        }
        if (this._isRunningHighPriorityTasks()) {
            // Always interrupt cancellable tasks after all other side-effects, to
            // avoid re-entrancy issues
            this._interruptCancellableTasks();
        }
    };
    /**
     * Browse the current waiting queue and start all task in it that needs to be
     * started: start the ones with the lowest priority value below
     * `_minPendingPriority`.
     *
     * Private properties, such as `_minPendingPriority` are updated accordingly
     * while this method is called.
     */
    ObservablePrioritizer.prototype._loopThroughWaitingQueue = function () {
        var minWaitingPriority = this._waitingQueue.reduce(function (acc, elt) {
            return acc === null || acc > elt.priority ? elt.priority :
                acc;
        }, null);
        if (minWaitingPriority === null ||
            (this._minPendingPriority !== null &&
                this._minPendingPriority < minWaitingPriority)) {
            return;
        }
        for (var i = 0; i < this._waitingQueue.length; i++) {
            var priorityToCheck = this._minPendingPriority === null ?
                minWaitingPriority :
                Math.min(this._minPendingPriority, minWaitingPriority);
            var elt = this._waitingQueue[i];
            if (elt.priority <= priorityToCheck) {
                this._startWaitingQueueTask(i);
                i--; // previous operation should have removed that element from the
                // the waiting queue
            }
        }
    };
    /**
     * Interrupt and move back to the waiting queue all pending tasks that are
     * low priority (having a higher priority number than
     * `this._prioritySteps.low`).
     */
    ObservablePrioritizer.prototype._interruptCancellableTasks = function () {
        for (var i = 0; i < this._pendingTasks.length; i++) {
            var pendingObj = this._pendingTasks[i];
            if (pendingObj.priority >= this._prioritySteps.low) {
                this._interruptPendingTask(pendingObj);
                // The previous call could have a lot of potential side-effects.
                // It is safer to re-start the function to not miss any pending
                // task that needs to be cancelled.
                return this._interruptCancellableTasks();
            }
        }
    };
    /**
     * Start task which is at the given index in the waiting queue.
     * The task will be removed from the waiting queue in the process.
     * @param {number} index
     */
    ObservablePrioritizer.prototype._startWaitingQueueTask = function (index) {
        var task = this._waitingQueue.splice(index, 1)[0];
        task.trigger(true);
    };
    /**
     * Move back pending task to the waiting queue and interrupt it.
     * @param {object} task
     */
    ObservablePrioritizer.prototype._interruptPendingTask = function (task) {
        var pendingTasksIndex = arrayFindIndex(this._pendingTasks, function (elt) { return elt.observable === task.observable; });
        if (pendingTasksIndex < 0) {
            log.warn("FP: Interrupting a non-existent pending task. Aborting...");
            return;
        }
        // Stop task and put it back in the waiting queue
        this._pendingTasks.splice(pendingTasksIndex, 1);
        this._waitingQueue.push(task);
        if (this._pendingTasks.length === 0) {
            this._minPendingPriority = null;
        }
        else if (this._minPendingPriority === task.priority) {
            this._minPendingPriority = Math.min.apply(Math, this._pendingTasks.map(function (t) { return t.priority; }));
        }
        task.trigger(false); // Interrupt at last step because it calls external code
    };
    /**
     * Logic ran when a task has ended (either errored or completed).
     * @param {Object} task
     */
    ObservablePrioritizer.prototype._onTaskEnd = function (task) {
        var pendingTasksIndex = arrayFindIndex(this._pendingTasks, function (elt) { return elt.observable === task.observable; });
        if (pendingTasksIndex < 0) {
            return; // Happen for example when the task has been interrupted
        }
        this._pendingTasks.splice(pendingTasksIndex, 1);
        if (this._pendingTasks.length > 0) {
            if (this._minPendingPriority === task.priority) {
                this._minPendingPriority = Math.min.apply(Math, this._pendingTasks.map(function (t) { return t.priority; }));
            }
            return; // still waiting for Observables to finish
        }
        this._minPendingPriority = null;
        this._loopThroughWaitingQueue();
    };
    /**
     * Return `true` if the given task can be started immediately based on its
     * priority.
     * @param {Object} task
     * @returns {boolean}
     */
    ObservablePrioritizer.prototype._canBeStartedNow = function (task) {
        return this._minPendingPriority === null ||
            task.priority <= this._minPendingPriority;
    };
    /**
     * Returns `true` if any running task is considered "high priority".
     * returns `false` otherwise.
     * @param {Object} task
     * @returns {boolean}
     */
    ObservablePrioritizer.prototype._isRunningHighPriorityTasks = function () {
        return this._minPendingPriority !== null &&
            this._minPendingPriority <= this._prioritySteps.high;
    };
    return ObservablePrioritizer;
}());
export default ObservablePrioritizer;
