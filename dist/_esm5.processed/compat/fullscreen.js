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
/**
 * Request fullScreen action on a given element.
 * @param {HTMLElement} elt
 */
function requestFullscreen(element) {
    if (!isFullscreen()) {
        var elt = element;
        /* eslint-disable @typescript-eslint/unbound-method */
        if (typeof elt.requestFullscreen === "function") {
            /* eslint-enable @typescript-eslint/unbound-method */
            /* eslint-disable @typescript-eslint/no-floating-promises */
            elt.requestFullscreen();
            /* eslint-enable @typescript-eslint/no-floating-promises */
        }
        else if (typeof elt.msRequestFullscreen === "function") {
            elt.msRequestFullscreen();
        }
        else if (typeof elt.mozRequestFullScreen === "function") {
            elt.mozRequestFullScreen();
        }
        else if (typeof elt.webkitRequestFullscreen === "function") {
            (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            elt.webkitRequestFullscreen
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            )(Element.ALLOW_KEYBOARD_INPUT);
        }
    }
}
/**
 * Exit fullscreen if an element is currently in fullscreen.
 */
function exitFullscreen() {
    if (isFullscreen()) {
        var doc = document;
        /* eslint-disable @typescript-eslint/unbound-method */
        if (typeof doc.exitFullscreen === "function") {
            /* eslint-enable @typescript-eslint/unbound-method */
            /* eslint-disable @typescript-eslint/no-floating-promises */
            doc.exitFullscreen();
            /* eslint-enable @typescript-eslint/no-floating-promises */
        }
        else if (typeof doc.msExitFullscreen === "function") {
            doc.msExitFullscreen();
        }
        else if (typeof doc.mozCancelFullScreen === "function") {
            doc.mozCancelFullScreen();
        }
        else if (typeof doc.webkitExitFullscreen === "function") {
            doc.webkitExitFullscreen();
        }
    }
}
/**
 * Returns true if an element in the document is being displayed in fullscreen
 * mode;
 * otherwise it's false.
 * @returns {boolean}
 */
function isFullscreen() {
    var doc = document;
    return (doc.fullscreenElement != null ||
        doc.mozFullScreenElement != null ||
        doc.webkitFullscreenElement != null ||
        doc.msFullscreenElement != null);
}
export { requestFullscreen, exitFullscreen, isFullscreen, };
