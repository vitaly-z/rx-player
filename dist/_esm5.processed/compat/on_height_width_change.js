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
import log from "../log";
import createSharedReference from "../utils/reference";
import isNode from "./is_node";
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
var _ResizeObserver = isNode ? undefined :
    window.ResizeObserver;
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
/**
 * Emit the current height and width of the given `element` each time it
 * changes.
 *
 * On some browsers, we might not be able to rely on a native API to know when
 * it changes, the `interval` argument allow us to provide us an inverval in
 * milliseconds at which we should query that element's size.
 * @param {HTMLElement} element
 * @param {number} interval
 * @returns {Observable}
 */
export default function onHeightWidthChange(element, interval, cancellationSignal) {
    var _a = element.getBoundingClientRect(), initHeight = _a.height, initWidth = _a.width;
    var ref = createSharedReference({
        height: initHeight,
        width: initWidth,
    });
    var lastHeight = initHeight;
    var lastWidth = initWidth;
    if (_ResizeObserver !== undefined) {
        var resizeObserver_1 = new _ResizeObserver(function (entries) {
            if (entries.length === 0) {
                log.error("Compat: Resized but no observed element.");
                return;
            }
            var entry = entries[0];
            var _a = entry.contentRect, height = _a.height, width = _a.width;
            if (height !== lastHeight || width !== lastWidth) {
                lastHeight = height;
                lastWidth = width;
                ref.setValue({ height: height, width: width });
            }
        });
        resizeObserver_1.observe(element);
        cancellationSignal.register(function () {
            resizeObserver_1.disconnect();
        });
    }
    else {
        var intervalId_1 = setInterval(function () {
            var _a = element.getBoundingClientRect(), height = _a.height, width = _a.width;
            if (height !== lastHeight || width !== lastWidth) {
                lastHeight = height;
                lastWidth = width;
                ref.setValue({ height: height, width: width });
            }
        }, interval);
        cancellationSignal.register(function () {
            clearInterval(intervalId_1);
        });
    }
    return ref;
}
