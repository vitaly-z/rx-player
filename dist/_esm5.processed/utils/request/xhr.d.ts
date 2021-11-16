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
import { CancellationSignal } from "../task_canceller";
/**
 * # request function
 *
 * Translate GET requests into Rx.js Observables.
 *
 * ## Overview
 *
 * Perform the request on subscription.
 * Emit zero, one or more progress event(s) and then the data if the request
 * was successful.
 *
 * Throw if an error happened or if the status code is not in the 200 range at
 * the time of the response.
 * Complete after emitting the data.
 * Abort the xhr on unsubscription.
 *
 * ## Emitted Objects
 *
 * The emitted objects are under the following form:
 * ```
 *   {
 *     type {string}: the type of event
 *     value {Object}: the event value
 *   }
 * ```
 *
 * The type of event can either be "progress" or "data-loaded". The value is
 * under a different form depending on the type.
 *
 * For "progress" events, the value should be the following object:
 * ```
 *   {
 *     url {string}: url on which the request is being done
 *     sendingTime {Number}: timestamp at which the request was sent.
 *     currentTime {Number}: timestamp at which the progress event was
 *                           triggered
 *     size {Number}: current size downloaded, in bytes (without
 *                          overhead)
 *     totalSize {Number|undefined}: total size to download, in bytes
 *                                   (without overhead)
 *   }
 * ```
 *
 * For "data-loaded" events, the value should be the following object:
 * ```
 *   {
 *     status {Number}: xhr status code
 *     url {string}: URL on which the request was done (can be different than
 *                   the one given in arguments when we go through
 *                   redirections).
 *     responseType {string}: the responseType of the request
 *                            (e.g. "json", "document"...).
 *     sendingTime {Number}: time at which the request was sent, in ms.
 *     receivedTime {Number}: timest at which the response was received, in ms.
 *     size {Number}: size of the received data, in bytes.
 *     responseData {*}: Data in the response. Format depends on the
 *                       responseType.
 *   }
 * ```
 *
 * For any successful request you should have 0+ "progress" events and 1
 * "data-loaded" event.
 *
 * For failing request, you should have 0+ "progress" events and 0 "data-loaded"
 * event (the Observable will throw before).
 *
 * ## Errors
 *
 * Several errors can be emitted (the Rx.js way). Namely:
 *   - RequestErrorTypes.TIMEOUT_ERROR: the request timeouted (took too long to
 *     respond).
 *   - RequestErrorTypes.PARSE_ERROR: the browser APIs used to parse the
 *                                    data failed.
 *   - RequestErrorTypes.ERROR_HTTP_CODE: the HTTP code at the time of reception
 *                                        was not in the 200-299 (included)
 *                                        range.
 *   - RequestErrorTypes.ERROR_EVENT: The XHR had an error event before the
 *                                    response could be fetched.
 * @param {Object} options
 * @returns {Observable}
 */
export default function request(options: IRequestOptions<undefined | null | "" | "text">): Promise<IRequestResponse<string, "text">>;
export default function request(options: IRequestOptions<"arraybuffer">): Promise<IRequestResponse<ArrayBuffer, "arraybuffer">>;
export default function request(options: IRequestOptions<"document">): Promise<IRequestResponse<Document, "document">>;
export default function request(options: IRequestOptions<"json">): Promise<IRequestResponse<object, "json">>;
export default function request(options: IRequestOptions<"blob">): Promise<IRequestResponse<Blob, "blob">>;
/** Options given to `request` */
export interface IRequestOptions<ResponseType> {
    /** URL you want to request. */
    url: string;
    /** Dictionary of headers you want to set. `null` or `undefined` for no header. */
    headers?: {
        [header: string]: string;
    } | null;
    /** Wanted format for the response */
    responseType?: ResponseType;
    /**
     * Optional timeout, in milliseconds, after which we will cancel a request.
     * Set to DEFAULT_REQUEST_TIMEOUT by default.
     */
    timeout?: number;
    /**
     * "Cancelation token" used to be able to cancel the request.
     * When this token is "cancelled", the request will be aborted and the Promise
     * returned by `request` will be rejected.
     */
    cancelSignal?: CancellationSignal;
    /**
     * When defined, this callback will be called on each XHR "progress" event
     * with data related to this request's progress.
     */
    onProgress?: (info: IProgressInfo) => void;
}
/** Data emitted by `request`'s Promise when the request succeeded. */
export interface IRequestResponse<T, U> {
    /** Time taken by the request, in milliseconds. */
    requestDuration: number;
    /** Time (relative to the "time origin") at which the request ended. */
    receivedTime: number;
    /** Data requested. Its type will depend on the responseType. */
    responseData: T;
    /** `responseType` requested, gives an indice on the type of `responseData`. */
    responseType: U;
    /** Time (relative to the "time origin") at which the request began. */
    sendingTime: number;
    /** Full size of the requested data, in bytes. */
    size: number;
    /** HTTP status of the response */
    status: number;
    /**
     * Actual URL requested.
     * Can be different from the one given to `request` due to a possible
     * redirection.
     */
    url: string;
}
export interface IProgressInfo {
    currentTime: number;
    duration: number;
    size: number;
    sendingTime: number;
    url: string;
    totalSize?: number;
}
