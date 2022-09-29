const REQUESTS = new Map();

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
}
