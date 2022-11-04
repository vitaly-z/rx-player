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
 * Construct a "loaded" event.
 * @returns {Object}
 */
function loaded(segmentBuffersStore) {
    return { type: "loaded", value: { segmentBuffersStore: segmentBuffersStore } };
}
/**
 * Construct a "stalled" event.
 * @param {Object|null} rebuffering
 * @returns {Object}
 */
function stalled(rebuffering) {
    return { type: "stalled", value: rebuffering };
}
/**
 * Construct a "stalled" event.
 * @returns {Object}
 */
function unstalled() {
    return { type: "unstalled", value: null };
}
/**
 * Construct a "decipherabilityUpdate" event.
 * @param {Array.<Object>} arg
 * @returns {Object}
 */
function decipherabilityUpdate(arg) {
    return { type: "decipherabilityUpdate", value: arg };
}
/**
 * Construct a "manifestReady" event.
 * @param {Object} manifest
 * @returns {Object}
 */
function manifestReady(manifest) {
    return { type: "manifestReady", value: { manifest: manifest } };
}
/**
 * Construct a "manifestUpdate" event.
 * @returns {Object}
 */
function manifestUpdate() {
    return { type: "manifestUpdate", value: null };
}
/**
 * Construct a "representationChange" event.
 * @param {string} type
 * @param {Object} period
 * @returns {Object}
 */
function nullRepresentation(type, period) {
    return { type: "representationChange",
        value: { type: type, representation: null, period: period } };
}
/**
 * construct a "warning" event.
 * @param {error} value
 * @returns {object}
 */
function warning(value) {
    return { type: "warning", value: value };
}
/**
 * construct a "reloading-media-source" event.
 * @returns {object}
 */
function reloadingMediaSource() {
    return { type: "reloading-media-source", value: undefined };
}
var INIT_EVENTS = { loaded: loaded, decipherabilityUpdate: decipherabilityUpdate, manifestReady: manifestReady, manifestUpdate: manifestUpdate, nullRepresentation: nullRepresentation, reloadingMediaSource: reloadingMediaSource, stalled: stalled, unstalled: unstalled, warning: warning };
export default INIT_EVENTS;
