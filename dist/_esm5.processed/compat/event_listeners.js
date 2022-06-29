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
 * This file provides browser-agnostic event listeners under the form of
 * RxJS Observables
 */
import { NEVER, fromEvent as observableFromEvent, merge as observableMerge, } from "rxjs";
import config from "../config";
import log from "../log";
import isNonEmptyString from "../utils/is_non_empty_string";
import isNullOrUndefined from "../utils/is_null_or_undefined";
import noop from "../utils/noop";
import createSharedReference from "../utils/reference";
import isNode from "./is_node";
import shouldFavourCustomSafariEME from "./should_favour_custom_safari_EME";
var BROWSER_PREFIXES = ["", "webkit", "moz", "ms"];
var pixelRatio = isNode ||
    window.devicePixelRatio == null ||
    window.devicePixelRatio === 0 ? 1 :
    window.devicePixelRatio;
/**
 * Find the first supported event from the list given.
 * @param {HTMLElement} element
 * @param {string} eventNameSuffix
 * @returns {Boolean}
 */
function isEventSupported(element, eventNameSuffix) {
    var clone = document.createElement(element.tagName);
    var eventName = "on" + eventNameSuffix;
    if (eventName in clone) {
        return true;
    }
    else {
        clone.setAttribute(eventName, "return;");
        return typeof clone[eventName] === "function";
    }
}
/**
 * Find the first supported event from the list given.
 * @param {HTMLElement} element
 * @param {Array.<string>} eventNames
 * @returns {string|undefined}
 */
function findSupportedEvent(element, eventNames) {
    return eventNames
        .filter(function (name) { return isEventSupported(element, name); })[0];
}
/**
 * @param {Array.<string>} eventNames
 * @param {Array.<string>|undefined} prefixes
 * @returns {Array.<string>}
 */
function eventPrefixed(eventNames, prefixes) {
    return eventNames.reduce(function (parent, name) {
        return parent.concat((prefixes == null ? BROWSER_PREFIXES :
            prefixes)
            .map(function (p) { return p + name; }));
    }, []);
}
/**
 * @param {Array.<string>} eventNames
 * @param {Array.<string>|undefined} prefixes
 * @returns {Observable}
 */
function compatibleListener(eventNames, prefixes) {
    var mem;
    var prefixedEvents = eventPrefixed(eventNames, prefixes);
    return function (element) {
        // if the element is a HTMLElement we can detect
        // the supported event, and memoize it in `mem`
        if (element instanceof HTMLElement) {
            if (typeof mem === "undefined") {
                mem = findSupportedEvent(element, prefixedEvents);
            }
            if (isNonEmptyString(mem)) {
                return observableFromEvent(element, mem);
            }
            else {
                if (0 /* __ENVIRONMENT__.CURRENT_ENV */ === 1 /* __ENVIRONMENT__.DEV */) {
                    log.warn("compat: element ".concat(element.tagName) +
                        " does not support any of these events: " +
                        prefixedEvents.join(", "));
                }
                return NEVER;
            }
        }
        // otherwise, we need to listen to all the events
        // and merge them into one observable sequence
        return observableMerge.apply(void 0, prefixedEvents.map(function (eventName) {
            return observableFromEvent(element, eventName);
        }));
    };
}
/**
 * Returns a reference:
 *   - set to `true` when the document is visible
 *   - set to `false` when the document is hidden
 * @param {Object} stopListening - `CancellationSignal` allowing to free the
 * ressources allocated to update this value.
 * @returns {Object}
 */
function getDocumentVisibilityRef(stopListening) {
    var prefix;
    var doc = document;
    if (doc.hidden != null) {
        prefix = "";
    }
    else if (doc.mozHidden != null) {
        prefix = "moz";
    }
    else if (doc.msHidden != null) {
        prefix = "ms";
    }
    else if (doc.webkitHidden != null) {
        prefix = "webkit";
    }
    var hidden = isNonEmptyString(prefix) ? prefix + "Hidden" :
        "hidden";
    var visibilityChangeEvent = isNonEmptyString(prefix) ? prefix + "visibilitychange" :
        "visibilitychange";
    var isHidden = document[hidden];
    var ref = createSharedReference(isHidden);
    addEventListener(document, visibilityChangeEvent, function () {
        var isVisible = !(document[hidden]);
        ref.setValueIfChanged(isVisible);
    }, stopListening);
    stopListening.register(function () {
        ref.finish();
    });
    return ref;
}
/**
 * Returns a reference:
 *   - Set to `true` when the current page is considered visible and active.
 *   - Set to `false` otherwise.
 * @param {Object} stopListening - `CancellationSignal` allowing to free the
 * resources allocated to update this value.
 * @returns {Object}
 */
function getPageActivityRef(stopListening) {
    var isDocVisibleRef = getDocumentVisibilityRef(stopListening);
    var currentTimeout;
    var ref = createSharedReference(true);
    stopListening.register(function () {
        clearTimeout(currentTimeout);
        ref.finish();
    });
    isDocVisibleRef.onUpdate(function onDocVisibilityChange(isVisible) {
        clearTimeout(currentTimeout); // clear potential previous timeout
        if (!isVisible) {
            var INACTIVITY_DELAY = config.getCurrent().INACTIVITY_DELAY;
            currentTimeout = window.setTimeout(function () {
                ref.setValueIfChanged(false);
            }, INACTIVITY_DELAY);
        }
        ref.setValueIfChanged(true);
    }, { clearSignal: stopListening, emitCurrentValue: true });
    return ref;
}
/**
 * Get video width from Picture-in-Picture window
 * @param {HTMLMediaElement} mediaElement
 * @param {Object} pipWindow
 * @returns {number}
 */
function getVideoWidthFromPIPWindow(mediaElement, pipWindow) {
    var width = pipWindow.width, height = pipWindow.height;
    var videoRatio = mediaElement.clientHeight / mediaElement.clientWidth;
    var calcWidth = height / videoRatio;
    return Math.min(width, calcWidth);
}
/**
 * Emit when video enters and leaves Picture-In-Picture mode.
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
function getPictureOnPictureStateRef(elt, stopListening) {
    var mediaElement = elt;
    if (mediaElement.webkitSupportsPresentationMode === true &&
        typeof mediaElement.webkitSetPresentationMode === "function") {
        var isWebKitPIPEnabled = mediaElement.webkitPresentationMode === "picture-in-picture";
        var ref_1 = createSharedReference({
            isEnabled: isWebKitPIPEnabled,
            pipWindow: null,
        });
        addEventListener(mediaElement, "webkitpresentationmodechanged", function () {
            var isEnabled = mediaElement.webkitPresentationMode === "picture-in-picture";
            ref_1.setValue({ isEnabled: isEnabled, pipWindow: null });
        }, stopListening);
        stopListening.register(function () {
            ref_1.finish();
        });
        return ref_1;
    }
    var isPIPEnabled = (document.pictureInPictureElement === mediaElement);
    var ref = createSharedReference({ isEnabled: isPIPEnabled,
        pipWindow: null });
    addEventListener(mediaElement, "enterpictureinpicture", function (evt) {
        var _a;
        ref.setValue({
            isEnabled: true,
            pipWindow: (_a = evt.pictureInPictureWindow) !== null && _a !== void 0 ? _a : null,
        });
    }, stopListening);
    addEventListener(mediaElement, "leavepictureinpicture", function () {
        ref.setValue({ isEnabled: false, pipWindow: null });
    }, stopListening);
    stopListening.register(function () {
        ref.finish();
    });
    return ref;
}
/**
 * Returns a reference:
 *   - Set to `true` when video is considered as visible (the page is visible
 *     and/or the Picture-In-Picture is activated).
 *   - Set to `false` otherwise.
 * @param {Object} pipStatus
 * @param {Object} stopListening - `CancellationSignal` allowing to free the
 * resources reserved to listen to video visibility change.
 * @returns {Observable}
 */
function getVideoVisibilityRef(pipStatus, stopListening) {
    var isDocVisibleRef = getDocumentVisibilityRef(stopListening);
    var currentTimeout;
    var ref = createSharedReference(true);
    stopListening.register(function () {
        clearTimeout(currentTimeout);
        ref.finish();
    });
    isDocVisibleRef.onUpdate(checkCurrentVisibility, { clearSignal: stopListening });
    pipStatus.onUpdate(checkCurrentVisibility, { clearSignal: stopListening });
    checkCurrentVisibility();
    return ref;
    function checkCurrentVisibility() {
        if (pipStatus.getValue().isEnabled || isDocVisibleRef.getValue()) {
            ref.setValueIfChanged(true);
        }
        else {
            var INACTIVITY_DELAY = config.getCurrent().INACTIVITY_DELAY;
            currentTimeout = window.setTimeout(function () {
                ref.setValueIfChanged(false);
            }, INACTIVITY_DELAY);
        }
    }
}
/**
 * Get video width from HTML video element, or video estimated dimensions
 * when Picture-in-Picture is activated.
 * @param {HTMLMediaElement} mediaElement
 * @param {Object} pipStatusRef
 * @param {Object} stopListening
 * @returns {Object}
 */
function getVideoWidthRef(mediaElement, pipStatusRef, stopListening) {
    var ref = createSharedReference(mediaElement.clientWidth * pixelRatio);
    var clearPreviousEventListener = noop;
    pipStatusRef.onUpdate(checkVideoWidth, { clearSignal: stopListening });
    addEventListener(window, "resize", checkVideoWidth, stopListening);
    var interval = window.setInterval(checkVideoWidth, 20000);
    checkVideoWidth();
    stopListening.register(function stopUpdatingVideoWidthRef() {
        clearPreviousEventListener();
        clearInterval(interval);
        ref.finish();
    });
    return ref;
    function checkVideoWidth() {
        clearPreviousEventListener();
        var pipStatus = pipStatusRef.getValue();
        if (!pipStatus.isEnabled) {
            ref.setValueIfChanged(mediaElement.clientWidth * pixelRatio);
        }
        else if (!isNullOrUndefined(pipStatus.pipWindow)) {
            var pipWindow_1 = pipStatus.pipWindow;
            var firstWidth = getVideoWidthFromPIPWindow(mediaElement, pipWindow_1);
            var onPipResize_1 = function () {
                ref.setValueIfChanged(getVideoWidthFromPIPWindow(mediaElement, pipWindow_1) * pixelRatio);
            };
            pipWindow_1.addEventListener("resize", onPipResize_1);
            clearPreviousEventListener = function () {
                pipWindow_1.removeEventListener("resize", onPipResize_1);
                clearPreviousEventListener = noop;
            };
            ref.setValueIfChanged(firstWidth * pixelRatio);
        }
        else {
            ref.setValueIfChanged(Infinity);
        }
    }
}
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
var onLoadedMetadata$ = compatibleListener(["loadedmetadata"]);
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
var onSeeking$ = compatibleListener(["seeking"]);
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
var onSeeked$ = compatibleListener(["seeked"]);
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
var onEnded$ = compatibleListener(["ended"]);
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
var onTimeUpdate$ = compatibleListener(["timeupdate"]);
/**
 * @param {HTMLElement} element
 * @returns {Observable}
 */
var onFullscreenChange$ = compatibleListener(["fullscreenchange", "FullscreenChange"], 
// On IE11, fullscreen change events is called MSFullscreenChange
BROWSER_PREFIXES.concat("MS"));
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
var onTextTrackChanges$ = function (textTrackList) {
    return observableMerge(compatibleListener(["addtrack"])(textTrackList), compatibleListener(["removetrack"])(textTrackList));
};
/**
 * @param {MediaSource} mediaSource
 * @returns {Observable}
 */
var onSourceOpen$ = compatibleListener(["sourceopen", "webkitsourceopen"]);
/**
 * @param {MediaSource} mediaSource
 * @returns {Observable}
 */
var onSourceClose$ = compatibleListener(["sourceclose", "webkitsourceclose"]);
/**
 * @param {MediaSource} mediaSource
 * @returns {Observable}
 */
var onSourceEnded$ = compatibleListener(["sourceended", "webkitsourceended"]);
/**
 * @param {SourceBuffer} sourceBuffer
 * @returns {Observable}
 */
var onUpdate$ = compatibleListener(["update"]);
/**
 * @param {MediaSource} mediaSource
 * @returns {Observable}
 */
var onRemoveSourceBuffers$ = compatibleListener(["onremovesourcebuffer"]);
/**
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
var onEncrypted$ = compatibleListener(shouldFavourCustomSafariEME() ? ["needkey"] :
    ["encrypted", "needkey"]);
/**
 * @param {MediaKeySession} mediaKeySession
 * @returns {Observable}
 */
var onKeyMessage$ = compatibleListener(["keymessage", "message"]);
/**
 * @param {MediaKeySession} mediaKeySession
 * @returns {Observable}
 */
var onKeyAdded$ = compatibleListener(["keyadded", "ready"]);
/**
 * @param {MediaKeySession} mediaKeySession
 * @returns {Observable}
 */
var onKeyError$ = compatibleListener(["keyerror", "error"]);
/**
 * @param {MediaKeySession} mediaKeySession
 * @returns {Observable}
 */
var onKeyStatusesChange$ = compatibleListener(["keystatuseschange"]);
/**
 * Utilitary function allowing to add an event listener and remove it
 * automatically once the given `CancellationSignal` emits.
 * @param {EventTarget} elt - The element on which should be attached the event
 * listener.
 * @param {string} evt - The event you wish to listen to
 * @param {Function} listener - The listener function
 * @param {Object} stopListening - Removes the event listener once this signal
 * emits
 */
function addEventListener(elt, evt, listener, stopListening) {
    elt.addEventListener(evt, listener);
    stopListening.register(function () {
        elt.removeEventListener(evt, listener);
    });
}
export { addEventListener, getPageActivityRef, getPictureOnPictureStateRef, getVideoVisibilityRef, getVideoWidthRef, onEncrypted$, onEnded$, onFullscreenChange$, onKeyAdded$, onKeyError$, onKeyMessage$, onKeyStatusesChange$, onLoadedMetadata$, onRemoveSourceBuffers$, onSeeked$, onSeeking$, onSourceClose$, onSourceEnded$, onSourceOpen$, onTextTrackChanges$, onTimeUpdate$, onUpdate$, };
