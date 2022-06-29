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
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */
import features from "./features_object";
/**
 * Selects the features to include based on environment variables.
 *
 * @param {Object} features
 */
export default function initializeFeaturesObject() {
    if (0 /* __FEATURES__.EME */ === 1 /* __FEATURES__.IS_ENABLED */) {
        features.ContentDecryptor = require("../core/decrypt/index.ts").default;
    }
    if (0 /* __FEATURES__.BIF_PARSER */ === 1 /* __FEATURES__.IS_ENABLED */) {
        features.imageBuffer =
            require("../core/segment_buffers/implementations/image/index.ts").default;
        features.imageParser = require("../parsers/images/bif.ts").default;
    }
    // Feature switching the Native TextTrack implementation
    var HAS_NATIVE_MODE = 0 /* __FEATURES__.NATIVE_VTT */ ||
        0 /* __FEATURES__.NATIVE_SAMI */ ||
        0 /* __FEATURES__.NATIVE_TTML */ ||
        0 /* __FEATURES__.NATIVE_SRT */;
    if (0 /* __FEATURES__.SMOOTH */ === 1 /* __FEATURES__.IS_ENABLED */) {
        features.transports.smooth = require("../transports/smooth/index.ts").default;
    }
    if (0 /* __FEATURES__.DASH */ === 1 /* __FEATURES__.IS_ENABLED */) {
        features.transports.dash = require("../transports/dash/index.ts").default;
        features.dashParsers.js =
            require("../parsers/manifest/dash/js-parser/index.ts").default;
    }
    if (0 /* __FEATURES__.LOCAL_MANIFEST */ === 1 /* __FEATURES__.IS_ENABLED */) {
        features.transports.local = require("../transports/local/index.ts").default;
    }
    if (0 /* __FEATURES__.METAPLAYLIST */ === 1 /* __FEATURES__.IS_ENABLED */) {
        features.transports.metaplaylist =
            require("../transports/metaplaylist/index.ts").default;
    }
    if (HAS_NATIVE_MODE === 1 /* __FEATURES__.IS_ENABLED */) {
        features.nativeTextTracksBuffer =
            require("../core/segment_buffers/implementations/text/native/index.ts").default;
        if (0 /* __FEATURES__.NATIVE_VTT */ === 1 /* __FEATURES__.IS_ENABLED */) {
            features.nativeTextTracksParsers.vtt =
                require("../parsers/texttracks/webvtt/native/index.ts").default;
        }
        if (0 /* __FEATURES__.NATIVE_TTML */ === 1 /* __FEATURES__.IS_ENABLED */) {
            features.nativeTextTracksParsers.ttml =
                require("../parsers/texttracks/ttml/native/index.ts").default;
        }
        if (0 /* __FEATURES__.NATIVE_SAMI */ === 1 /* __FEATURES__.IS_ENABLED */) {
            features.nativeTextTracksParsers.sami =
                require("../parsers/texttracks/sami/native.ts").default;
        }
        if (0 /* __FEATURES__.NATIVE_SRT */ === 1 /* __FEATURES__.IS_ENABLED */) {
            features.nativeTextTracksParsers.srt =
                require("../parsers/texttracks/srt/native.ts").default;
        }
    }
    // Feature switching the HTML TextTrack implementation
    var HAS_HTML_MODE = 0 /* __FEATURES__.HTML_VTT */ ||
        0 /* __FEATURES__.HTML_SAMI */ ||
        0 /* __FEATURES__.HTML_TTML */ ||
        0 /* __FEATURES__.HTML_SRT */;
    if (HAS_HTML_MODE === 1 /* __FEATURES__.IS_ENABLED */) {
        features.htmlTextTracksBuffer =
            require("../core/segment_buffers/implementations/text/html/index.ts").default;
        if (0 /* __FEATURES__.HTML_SAMI */ === 1 /* __FEATURES__.IS_ENABLED */) {
            features.htmlTextTracksParsers.sami =
                require("../parsers/texttracks/sami/html.ts").default;
        }
        if (0 /* __FEATURES__.HTML_TTML */ === 1 /* __FEATURES__.IS_ENABLED */) {
            features.htmlTextTracksParsers.ttml =
                require("../parsers/texttracks/ttml/html/index.ts").default;
        }
        if (0 /* __FEATURES__.HTML_SRT */ === 1 /* __FEATURES__.IS_ENABLED */) {
            features.htmlTextTracksParsers.srt =
                require("../parsers/texttracks/srt/html.ts").default;
        }
        if (0 /* __FEATURES__.HTML_VTT */ === 1 /* __FEATURES__.IS_ENABLED */) {
            features.htmlTextTracksParsers.vtt =
                require("../parsers/texttracks/webvtt/html/index.ts").default;
        }
    }
    if (0 /* __FEATURES__.DIRECTFILE */ === 1 /* __FEATURES__.IS_ENABLED */) {
        var initDirectFile = require("../core/init/initialize_directfile.ts").default;
        var mediaElementTrackChoiceManager = require("../core/api/media_element_track_choice_manager.ts").default;
        features.directfile = { initDirectFile: initDirectFile, mediaElementTrackChoiceManager: mediaElementTrackChoiceManager };
    }
}
