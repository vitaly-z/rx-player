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
import { CancellationSignal } from "../../../utils/task_canceller";
/** Settings to give to the backoff functions to configure their behavior. */
export interface IBackoffSettings {
    /**
     * Initial delay to wait if a request fails before making a new request, in
     * milliseconds.
     */
    baseDelay: number;
    /**
     * Maximum delay to wait if a request fails before making a new request, in
     * milliseconds.
     */
    maxDelay: number;
    /**
     * Maximum number of retries to perform on "regular" errors (e.g. due to HTTP
     * status, integrity errors, timeouts...).
     */
    maxRetryRegular: number;
    /**
     * Maximum number of retries to perform when it appears that the user is
     * currently offline.
     */
    maxRetryOffline: number;
    /** Callback called when a request is retried. */
    onRetry: (err: unknown) => void;
}
/**
 * Specific algorithm used to perform segment and manifest requests.
 *
 * Here how it works:
 *
 *   1. You give it one or multiple URLs available for the resource you want to
 *      request (from the most important URL to the least important), the
 *      request callback itself, and some options.
 *
 *   2. it tries to call the request callback with the first URL:
 *        - if it works as expected, it resolves the returned Promise with that
 *          request's response.
 *        - if it fails, it calls ther `onRetry` callback given with the
 *          corresponding error and try with the next URL.
 *
 *   3. When all URLs have been tested (and failed), it decides - according to
 *      the error counters, configuration and errors received - if it can retry
 *      at least one of them, in the same order:
 *        - If it can, it increments the corresponding error counter, wait a
 *          delay (based on an exponential backoff) and restart the same logic
 *          for all retry-able URL.
 *        - If it can't it just reject the error through the returned Promise.
 *
 * Note that there are in fact two separate counters:
 *   - one for "offline" errors
 *   - one for other xhr errors
 * Both counters are resetted if the error type changes from an error to the
 * next.
 *
 * @param {Array.<string>} urls
 * @param {Function} performRequest
 * @param {Object} options - Configuration options.
 * @param {Object} cancellationSignal
 * @returns {Promise}
 */
export declare function tryURLsWithBackoff<T>(urls: Array<string | null>, performRequest: (url: string | null, cancellationSignal: CancellationSignal) => Promise<T>, options: IBackoffSettings, cancellationSignal: CancellationSignal): Promise<T>;
/**
 * Lightweight version of the request algorithm, this time with only a simple
 * Promise given.
 * @param {Function} request$
 * @param {Object} options
 * @returns {Observable}
 */
export declare function tryRequestPromiseWithBackoff<T>(performRequest: () => Promise<T>, options: IBackoffSettings, cancellationSignal: CancellationSignal): Promise<T>;
