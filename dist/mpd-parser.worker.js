/******/ (function() { // webpackBootstrap
/******/ 	"use strict";
var __webpack_exports__ = {};
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
let timer = 0;
let readTimer = 0;
const MAX_READ_SIZE = 15e3;
// We should always be in a Worker context here.
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
const worker = self;
let instance = null;
let linearMemory = null;
let mpdData = null;
worker.onmessage = onWorkerMessage;
function onWorkerMessage(msg) {
    const { data } = msg;
    if (data.type === 0 /* Initialize */) {
        initializeWasm(data.wasmUrl)
            .then(() => triggerMessage([0 /* Initialized */]))
            .catch((err) => {
            const initErrorMsg = err instanceof Error ? err.toString() :
                "Unknown initialization error";
            triggerMessage([2 /* InitializationError */,
                initErrorMsg]);
        });
    }
    else if (data.type === 1 /* ParseMpd */) {
        try {
            parseMpd(data.mpd);
        }
        catch (err) {
            const parsingErrorMsg = err instanceof Error ? err.toString() :
                "Unknown parsing error";
            triggerMessage([3 /* MPDParsingError */,
                parsingErrorMsg]);
            return;
        }
        triggerMessage([4 /* MPDParsingFinished */]);
    }
    else if (data.type === 2 /* ParseXlink */) {
        try {
            parseXlink(data.xlink);
        }
        catch (err) {
            const parsingErrorMsg = err instanceof Error ? err.toString() :
                "Unknown parsing error";
            triggerMessage([5 /* XLinkParsingError */,
                parsingErrorMsg]);
            return;
        }
        triggerMessage([6 /* XLinkParsingFinished */]);
    }
}
/**
 * Messages send by this worker are actually buffered to avoid making too much
 * postMessage call which might (to test) have a negative effect on performance.
 *
 * This array allows to send messages in bulk once it reached a sufficient size.
 */
const msgBuffer = [];
/**
 * A large amount of events sent by this worker are under an `ArrayBuffer`
 * format which can be fully moved to the main script (from the worker), through
 * the use of postMessage's "reportables" argument.
 *
 * This array allows to store a reference to all ArrayBuffers in the `msgBuffer`
 * array.
 */
const reportables = [];
function triggerMessage(msg) {
    msgBuffer.push(msg);
    if (msg[0] <= 10) {
        worker.postMessage(msgBuffer, reportables);
        msgBuffer.length = 0;
        reportables.length = 0;
    }
    else {
        let sendNow = false;
        if (msg[0] > 20) {
            // TODO I thought TS would be smarter than this
            const payload = msg[1];
            reportables.push(payload);
            sendNow = sendNow || payload.byteLength > 100;
        }
        if (sendNow) {
            worker.postMessage(msgBuffer, reportables);
            msgBuffer.length = 0;
            reportables.length = 0;
        }
    }
}
function initializeWasm(wasmUrl) {
    const imports = {
        env: {
            memoryBase: 0,
            tableBase: 0,
            memory: new WebAssembly.Memory({ initial: 10 }),
            table: new WebAssembly.Table({ initial: 2, element: "anyfunc" }),
            onTagOpen,
            onCustomEvent,
            onAttribute,
            readNext,
            onTagClose,
        },
    };
    const fetchedWasm = fetch(wasmUrl);
    const streamingProm = typeof WebAssembly.instantiateStreaming === "function" ?
        WebAssembly.instantiateStreaming(fetchedWasm, imports) :
        // We should already have checked that Promise are supported.
        // We don't want to include a polyfill to reduce the size of the worker file.
        /* eslint-disable no-restricted-properties */
        Promise.reject("`WebAssembly.instantiateStreaming` API not available");
    /* eslint-enable no-restricted-properties */
    return streamingProm
        .catch(async (err) => {
        const errMsg = err instanceof Error ? err.toString() :
            "unknown error";
        const warning = `Unable to call \`instantiateStreaming\` on WASM: ${errMsg}`;
        triggerMessage([1 /* InitializationWarning */,
            warning]);
        const res = await fetchedWasm;
        if (res.status < 200 || res.status >= 300) {
            const reqErr = new Error("WebAssembly request failed. status: " +
                String(res.status));
            throw reqErr;
        }
        const resAb = await res.arrayBuffer();
        return WebAssembly.instantiate(resAb, imports);
    })
        .then((instanceWasm) => {
        instance = instanceWasm;
        // TODO better types?
        linearMemory = instance.instance.exports.memory;
    });
}
let isParsing = false;
function parseMpd(mpd) {
    readTimer = 0;
    timer = 0;
    if (instance === null) {
        throw new Error("DashWasmParser not initialized");
    }
    if (isParsing) {
        throw new Error("Parsing operation already pending.");
    }
    isParsing = true;
    mpdData = { mpd, cursor: 0 };
    try {
        // TODO better type this
        instance.instance.exports.parse();
    }
    catch (err) {
        isParsing = false;
        throw err;
    }
    isParsing = false;
    console.error("!!!!!!!! Parse TIMER", timer, readTimer);
}
function parseXlink(xlinkData) {
    if (instance === null) {
        throw new Error("DashWasmParser not initialized");
    }
    if (isParsing) {
        throw new Error("Parsing operation already pending.");
    }
    isParsing = true;
    mpdData = { mpd: xlinkData, cursor: 0 };
    try {
        // TODO better type this
        instance.instance.exports.parse_xlink();
    }
    catch (err) {
        isParsing = false;
        throw err;
    }
    isParsing = false;
}
/**
 * Callback called when a new Element has been encountered by the WASM parser.
 * @param {number} tag - Identify the tag encountered (@see TagName)
 */
function onTagOpen(tag) {
    const p = performance.now();
    triggerMessage([11 /* TagOpen */, tag]);
    timer += (performance.now() - p);
}
/**
 * Callback called when an open Element's ending tag has been encountered by
 * the WASM parser.
 * @param {number} tag - Identify the tag in question (@see TagName)
 */
function onTagClose(tag) {
    const p = performance.now();
    triggerMessage([12 /* TagClose */, tag]);
    timer += (performance.now() - p);
}
/**
 * Callback called each time a new Element's attribute is encountered by
 * the WASM parser.
 *
 * TODO Merge all attributes into the same callback with `onTagOpen`? I
 * tried but there's some difficulties if doing that.
 *
 * @param {number} attr - Identify the Attribute in question (@see TagName)
 * @param {number} ptr - Pointer to the first byte containing the
 * attribute's data in the WebAssembly's linear memory.
 * @param {number} len - Length of the attribute's value, in bytes.
 */
function onAttribute(attr, ptr, len) {
    const p = performance.now();
    let payload;
    if (attr !== 69 /* EventStreamEltRange */) {
        payload = linearMemory
            .buffer.slice(ptr, ptr + len);
    }
    else {
        // XXX TODO comment
        if (mpdData === null) {
            return;
        }
        const dataView = new DataView(linearMemory.buffer);
        const rangeStart = dataView.getFloat64(ptr, true);
        const rangeEnd = dataView.getFloat64(ptr + 8, true);
        payload = mpdData.mpd.slice(rangeStart, rangeEnd);
    }
    triggerMessage([22 /* Attribute */, payload, attr]);
    timer += (performance.now() - p);
}
/**
 * Callback called on the various "custom events" triggered by the WASM.
 *
 * @see CustomEventType
 * @param {number} evt - The type of the event
 * @param {number} ptr - Pointer to the first byte of the event's payload in
 * the WebAssembly's linear memory.
 * @param {number} len - Length of the payload, in bytes.
 */
function onCustomEvent(evt, ptr, len) {
    const p = performance.now();
    const payload = linearMemory
        .buffer.slice(ptr, ptr + len);
    if (true) {
        if (evt === 0 /* Log */) {
            // "Log" are for debugging purpose-only.
            // It's safe to just console.log it out here.
            /* eslint-disable no-console */
            console.warn(new TextDecoder().decode(payload));
            /* eslint-enable no-console */
        }
    }
    if (evt === 1 /* Error */) {
        triggerMessage([21 /* ParserWarning */,
            payload]);
    }
    timer += (performance.now() - p);
}
/**
 * Callback called by the WebAssembly when it needs to read new data from
 * the MPD.
 *
 * @param {number} ptr - First byte offset, in the WebAssembly's linear
 * memory, where the MPD should be set (under an array of bytes form).
 * @param {number} wantedSize - Size of the data, in bytes, asked by the
 * WebAssembly parser. It might receive less depending on if there's less
 * data in the MPD or if it goes over the set maximum size it could read
 * at a time.
 * @returns {number} - Return the number of bytes effectively read and set
 * in WebAssembly's linear memory (at the `ptr` offset).
 */
function readNext(ptr, wantedSize) {
    const p = performance.now();
    if (mpdData === null) {
        throw new Error("DashWasmParser Error: No MPD to read.");
    }
    const { mpd, cursor } = mpdData;
    const sizeToRead = Math.min(wantedSize, MAX_READ_SIZE, mpd.byteLength - cursor);
    const arr = new Uint8Array(linearMemory.buffer, ptr, sizeToRead);
    arr.set(new Uint8Array(mpd, cursor, sizeToRead));
    mpdData.cursor += sizeToRead;
    readTimer += (performance.now() - p);
    return sizeToRead;
}


/******/ })()
;