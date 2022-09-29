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

import { RequestError } from "../../errors";
import idGenerator from "../id_generator";
import isNonEmptyString from "../is_non_empty_string";
import isNullOrUndefined from "../is_null_or_undefined";
import {
  CancellationError,
  CancellationSignal,
} from "../task_canceller";


/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable no-console */
/* eslint-disable prefer-const */

const workerScript = `const REQUESTS = new Map();

/**
 * @param {MessageEvent} evt
 */
onmessage = (evt) => {
  const { type, value } = evt.data;
  if (type === "abort") {
    const xhr = REQUESTS.get(value);
    if (xhr !== undefined) {
      REQUESTS.delete(value);
      xhr.abort();
    }
    return;
  } else if (type !== "send") {
    return;
  }

  const { requestId, url, headers, responseType, timeout, sendBack } = value;
  const xhr = new XMLHttpRequest();
  const sendingTime = performance.now();

  REQUESTS.set(requestId, xhr);

  xhr.onload = r => {
    if (xhr.readyState !== 4) {
      return;
    }
    REQUESTS.delete(requestId);
    if (200 <= xhr.status && xhr.status < 300) {
      const receivedTime = performance.now();
      const totalSize = xhr.response instanceof ArrayBuffer ?
        xhr.response.byteLength :
        r.total;
      const status = xhr.status;
      const loadedResponseType = xhr.responseType;
      const _url = xhr.responseURL ?
        xhr.responseURL :
        url;

      let responseData;
      if (loadedResponseType === "json") {
        // IE bug where response is string with responseType json
        responseData = typeof xhr.response === "object" ?
          xhr.response :
          toJSONForIE(xhr.responseText);
      } else {
        responseData = xhr.response;
      }

      const duration = performance.now() - sendingTime;
      const range = headers == null ? undefined : headers.range;
      if (responseData == null) {
        console.warn("!!!! WORKER PARSE ERROR ", _url, range, "size", totalSize, "duration", duration);
        if (sendBack) {
          postMessage({
            requestId,
            type: "parse-error",
            value: {
              url,
              status: xhr.status,
            },
          });
        }
        return;
      }
      console.warn("!!!! WORKER SUCCESS ", _url, range, "size", totalSize, "duration", duration);
      if (sendBack) {
        const transferable = responseType === "arraybuffer" ?
          responseData :
          undefined;
        postMessage({
          requestId,
          type: "response",
          value: {
            status,
            url: _url,
            responseType: loadedResponseType,
            sendingTime,
            receivedTime,
            requestDuration: receivedTime - sendingTime,
            size: totalSize,
            responseData,
          },
        }, [transferable]);
      }
    } else {
      const err = new Error(
        "Couldn't load data. Request returned with bad code."
      );
      err.xhr = xhr;
      const range = headers == null ? undefined : headers.range;
      console.error("!!!! WORKER ERROR ", url, range, xhr);
      if (sendBack) {
        postMessage({
          requestId,
          type: "bad-status",
          value: {
            url,
            status: xhr.status,
          },
        });
      }
    }
  };

  xhr.onerror = function() {
    REQUESTS.delete(requestId);
    const range = headers == null ? undefined : headers.range;
    console.error("!!!! WORKER NETERROR ", url, range, xhr);
    if (sendBack) {
      postMessage({
        requestId,
        type: "error",
        value: {
          url,
          status: xhr.status,
        },
      });
    }
  };

  xhr.ontimeout = function onXHRTimeout() {
    REQUESTS.delete(requestId);
    const range = headers == null ? undefined : headers.range;
    console.error("!!!! WORKER timeout ", url, range, xhr);
    if (sendBack) {
      postMessage({
        requestId,
        type: "timeout",
        value: {
          url,
          status: xhr.status,
        },
      });
    }
  };

  xhr.open("GET", url);
  if (timeout !== undefined) {
    xhr.timeout = timeout;
  }

  xhr.responseType = responseType;

  if (headers != null) {
    const _headers = headers;
    for (const key in _headers) {
      if (Object.prototype.hasOwnProperty.call(_headers, key)) {
        xhr.setRequestHeader(key, _headers[key]);
      }
    }
  }

  xhr.send();
};

/**
 * @param {string} data
 * @returns {Object|null}
 */
function toJSONForIE(data) {
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}`;
let worker : Worker;
try {
  const blob = new Blob([workerScript], { type: "application/javascript" });
  worker = new Worker(URL.createObjectURL(blob));
} catch (e) { // Backwards-compatibility
  console.error("Impossible to create worker", e);
  throw new Error("Impossible to create worker");
}
const generateRequestId = idGenerator();

const DEFAULT_RESPONSE_TYPE : XMLHttpRequestResponseType = "json";

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
export default function request(
  options : IRequestOptions< undefined | null | "" | "text" >
) : Promise<IRequestResponse< string, "text" >>;
export default function request(
  options : IRequestOptions< "arraybuffer" >
) : Promise<IRequestResponse< ArrayBuffer, "arraybuffer" >>;
export default function request(
  options : IRequestOptions< "document" >
) : Promise<IRequestResponse< Document, "document" >>;
export default function request(
  options : IRequestOptions< "json" >
)
// eslint-disable-next-line @typescript-eslint/ban-types
: Promise<IRequestResponse< object, "json" >>;
export default function request(
  options : IRequestOptions< "blob" >,
)
: Promise<IRequestResponse< Blob, "blob" >>;
export default function request<T>(
  options : IRequestOptions< XMLHttpRequestResponseType | null | undefined >
) : Promise<IRequestResponse< T, XMLHttpRequestResponseType >> {

  const requestOptions = {
    url: options.url,
    headers: options.headers,
    responseType: isNullOrUndefined(options.responseType) ? DEFAULT_RESPONSE_TYPE :
                                                            options.responseType,
    timeout: options.timeout,
  };

  return new Promise((resolve, reject) => {
    const { /** onProgress, */ cancelSignal } = options;
    const { url,
            headers,
            responseType,
            timeout } = requestOptions;
    const requestId = generateRequestId();
    let mainXhr : XMLHttpRequest | undefined;
    let timeoutId : undefined | number;
    let deregisterCancellationListener : (() => void) | null = null;
    let deregisterWorkerSignal : (() => void) | undefined;

    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);

    if (timeout !== undefined) {
      xhr.timeout = timeout;

      // We've seen on some browser (mainly on some LG TVs), that `xhr.timeout`
      // was either not supported or did not function properly despite the
      // browser being recent enough to support it.
      // That's why we also start a manual timeout. We do this a little later
      // than the "native one" performed on the xhr assuming that the latter
      // is more precise, it might also be more efficient.
      timeoutId = window.setTimeout(() => {
        clearCancellingProcess();
        cleanUpWorkerResources();
        reject(new RequestError(url, xhr.status, "TIMEOUT", xhr));
      }, timeout + 3000);
    }

    xhr.responseType = responseType;

    if (xhr.responseType === "document") {
      xhr.overrideMimeType("text/xml");
    }

    if (!isNullOrUndefined(headers)) {
      const _headers = headers;
      for (const key in _headers) {
        if (Object.prototype.hasOwnProperty.call(_headers, key)) {
          xhr.setRequestHeader(key, _headers[key]);
        }
      }
    }

    const sendingTime = performance.now();

    // Handle request cancellation
    if (cancelSignal !== undefined) {
      deregisterCancellationListener = cancelSignal
        .register(function abortRequest(err : CancellationError) {
          worker.postMessage({
            type: "abort",
            value: requestId,
          });
          clearCancellingProcess();
          cleanUpWorkerResources();
          if (!isNullOrUndefined(xhr) && xhr.readyState !== 4) {
            xhr.abort();
          }
          reject(err);
        });

      if (cancelSignal.isCancelled) {
        return;
      }
    }

    xhr.onerror = function onXHRError() {
      clearCancellingProcess();
      cleanUpWorkerResources();
      console.error("!!!! MAIN NETERROR ", url, headers?.range, xhr);
      reject(new RequestError(url, xhr.status, "ERROR_EVENT", xhr));
    };

    xhr.ontimeout = function onXHRTimeout() {
      clearCancellingProcess();
      cleanUpWorkerResources();
      reject(new RequestError(url, xhr.status, "TIMEOUT", xhr));
    };

    // if (onProgress !== undefined) {
    //   xhr.onprogress = function onXHRProgress(event) {
    //     const currentTime = performance.now();
    //     onProgress({ url,
    //                  duration: currentTime - sendingTime,
    //                  sendingTime,
    //                  currentTime,
    //                  size: event.loaded,
    //                  totalSize: event.total });
    //   };
    // }

    xhr.onload = function onXHRLoad(event : ProgressEvent) {
      if (xhr.readyState === 4) {
        clearCancellingProcess();
        cleanUpWorkerResources();
        if (xhr.status >= 200 && xhr.status < 300) {
          const receivedTime = performance.now();
          const totalSize = xhr.response instanceof
                              ArrayBuffer ? xhr.response.byteLength :
                                            event.total;
          const status = xhr.status;
          const loadedResponseType = xhr.responseType;
          const _url = isNonEmptyString(xhr.responseURL) ? xhr.responseURL :
                                                           url;

          let responseData : T;
          if (loadedResponseType === "json") {
            // IE bug where response is string with responseType json
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            responseData = typeof xhr.response === "object" ?
              xhr.response :
              toJSONForIE(xhr.responseText);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            responseData = xhr.response;
          }

          if (isNullOrUndefined(responseData)) {
            console.error("!!!! MAIN ERROR ", url, headers?.range, xhr);
            reject(new RequestError(url, xhr.status, "PARSE_ERROR", xhr));
            return;
          }

          console.warn("!!!! MAIN SUCCESS ",
                       url,
                       headers?.range,
                       "size", totalSize,
                       "duration", receivedTime - sendingTime);
          resolve({ status,
                    url: _url,
                    responseType: loadedResponseType,
                    sendingTime,
                    receivedTime,
                    requestDuration: receivedTime - sendingTime,
                    size: totalSize,
                    responseData });

        } else {
          reject(new RequestError(url, xhr.status, "ERROR_HTTP_CODE", xhr));
        }
      }
    };


    if ((window as any).REQBOTH) {
      mainXhr = xhr;
      xhr.send();
      worker.postMessage({
        type: "send",
        value: {
          requestId,
          url,
          headers,
          responseType,
          timeout,
        },
      });
    } else if ((window as any).REQWORKER) {
      if ((window as any).REQMAIN) {
        mainXhr = xhr;
        xhr.send();
      }
      worker.addEventListener("message", onMessage);
      if (cancelSignal !== undefined) {
        deregisterWorkerSignal = cancelSignal.register((err) => {
          worker.postMessage({
            type: "abort",
            value: requestId,
          });
          cleanUpWorkerResources();
          reject(err);
        });
      }

      worker.postMessage({
        type: "send",
        value: {
          requestId,
          url,
          headers,
          responseType,
          timeout,
          sendBack: true,
        },
      });
    } else {
      mainXhr = xhr;
      xhr.send();
    }

    /**
     * Clear resources and timers created to handle cancellation and timeouts.
     */
    function clearCancellingProcess() {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      if (deregisterCancellationListener !== null) {
        deregisterCancellationListener();
      }
    }

    function cleanUpWorkerResources() {
      deregisterWorkerSignal?.();
      worker.removeEventListener("message", onMessage);
    }

    function onMessage(evt: MessageEvent) {
      const { requestId: rid, type, value } = evt.data;
      if (requestId !== rid) {
        return;
      }

      if (type === "response") {
        if (mainXhr !== undefined) {
          mainXhr.abort();
        }
        clearCancellingProcess();
        cleanUpWorkerResources();
        resolve(value);
        return;
      } else if (type === "bad-status") {
        if (mainXhr !== undefined) {
          mainXhr.abort();
        }
        clearCancellingProcess();
        cleanUpWorkerResources();
        reject(new RequestError(url, value.status, "ERROR_HTTP_CODE", undefined));
        return;
      } else if (type === "error") {
        if (mainXhr !== undefined) {
          mainXhr.abort();
        }
        clearCancellingProcess();
        cleanUpWorkerResources();
        reject(new RequestError(url, value.status, "ERROR_EVENT", undefined));
        return;
      } else if (type === "timeout") {
        if (mainXhr !== undefined) {
          mainXhr.abort();
        }
        clearCancellingProcess();
        cleanUpWorkerResources();
        reject(new RequestError(url, value.status, "TIMEOUT", undefined));
        return;
      }
    }

  });
}

/**
 * @param {string} data
 * @returns {Object|null}
 */
function toJSONForIE(data : string) : unknown|null {
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

/** Options given to `request` */
export interface IRequestOptions<ResponseType> {
  /** URL you want to request. */
  url : string;
  /** Dictionary of headers you want to set. `null` or `undefined` for no header. */
  headers? : { [ header: string ] : string } |
             null |
             undefined;
  /** Wanted format for the response */
  responseType? : ResponseType | undefined;
  /**
   * Optional timeout, in milliseconds, after which we will cancel a request.
   * To not set or to set to `undefined` for disable.
   */
  timeout? : number | undefined;
  /**
   * "Cancelation token" used to be able to cancel the request.
   * When this token is "cancelled", the request will be aborted and the Promise
   * returned by `request` will be rejected.
   */
  cancelSignal? : CancellationSignal | undefined;
  /**
   * When defined, this callback will be called on each XHR "progress" event
   * with data related to this request's progress.
   */
  onProgress? : ((info : IProgressInfo) => void) | undefined;
}

/** Data emitted by `request`'s Promise when the request succeeded. */
export interface IRequestResponse<T, U> {
  /** Time taken by the request, in milliseconds. */
  requestDuration : number;
  /** Time (relative to the "time origin") at which the request ended. */
  receivedTime : number;
  /** Data requested. Its type will depend on the responseType. */
  responseData : T;
  /** `responseType` requested, gives an indice on the type of `responseData`. */
  responseType : U;
  /** Time (relative to the "time origin") at which the request began. */
  sendingTime : number;
  /** Full size of the requested data, in bytes. */
  size : number;
  /** HTTP status of the response */
  status : number;
  /**
   * Actual URL requested.
   * Can be different from the one given to `request` due to a possible
   * redirection.
   */
  url : string;
}

export interface IProgressInfo {
  currentTime : number;
  duration : number;
  size : number;
  sendingTime : number;
  url : string;
  totalSize? : number | undefined;
}
