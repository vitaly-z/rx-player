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
var _a, _b;
import isNode from "./is_node";
// true on IE11
// false on Edge and other IEs/browsers.
var isIE11 = !isNode &&
    typeof window.MSInputMethodContext !== "undefined" &&
    typeof document.documentMode !== "undefined";
// true for IE / Edge
var isIEOrEdge = isNode ?
    false :
    navigator.appName === "Microsoft Internet Explorer" ||
        navigator.appName === "Netscape" &&
            /(Trident|Edge)\//.test(navigator.userAgent);
var isEdgeChromium = !isNode &&
    navigator.userAgent.toLowerCase().indexOf("edg/") !== -1;
var isFirefox = !isNode &&
    navigator.userAgent.toLowerCase().indexOf("firefox") !== -1;
var isSamsungBrowser = !isNode &&
    /SamsungBrowser/.test(navigator.userAgent);
var isTizen = !isNode &&
    /Tizen/.test(navigator.userAgent);
var isWebOs = !isNode &&
    /Web0S/.test(navigator.userAgent);
var isWebOs2021 = !isNode &&
    /WebOS.TV-2021/.test(navigator.userAgent);
var isWebOs2022 = !isNode &&
    /WebOS.TV-2022/.test(navigator.userAgent);
/** `true` on Safari on a PC platform (i.e. not iPhone / iPad etc.) */
var isSafariDesktop = !isNode && (Object.prototype.toString.call(window.HTMLElement).indexOf("Constructor") >= 0 ||
    ((_b = (_a = window.safari) === null || _a === void 0 ? void 0 : _a.pushNotification) === null || _b === void 0 ? void 0 : _b.toString()) ===
        "[object SafariRemoteNotification]");
/** `true` on Safari on an iPhone, iPad & iPod platform */
var isSafariMobile = !isNode &&
    typeof navigator.platform === "string" &&
    /iPad|iPhone|iPod/.test(navigator.platform);
export { isEdgeChromium, isIE11, isIEOrEdge, isFirefox, isSafariDesktop, isSafariMobile, isSamsungBrowser, isTizen, isWebOs, isWebOs2021, isWebOs2022, };
