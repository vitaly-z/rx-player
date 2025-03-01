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
 * Selects the features to include.
 */
export default function initializeFeaturesObject() : void {
  const HAS_MEDIA_SOURCE =
    __FEATURES__.SMOOTH as number === __FEATURES__.IS_ENABLED as number ||
    __FEATURES__.DASH as number === __FEATURES__.IS_ENABLED as number ||
    __FEATURES__.LOCAL_MANIFEST as number === __FEATURES__.IS_ENABLED as number ||
    __FEATURES__.METAPLAYLIST as number === __FEATURES__.IS_ENABLED as number;
  if (HAS_MEDIA_SOURCE) {
    features.mediaSourceInit = require("../core/init/media_source_content_initializer.ts")
      .default;
  }
  if (__FEATURES__.EME as number === __FEATURES__.IS_ENABLED as number) {
    features.decrypt = require("../core/decrypt/index.ts").default;
  }

  if (__FEATURES__.BIF_PARSER as number === __FEATURES__.IS_ENABLED as number) {
    features.imageBuffer =
      require("../core/segment_buffers/implementations/image/index.ts").default;
    features.imageParser = require("../parsers/images/bif.ts").default;
  }

  // Feature switching the Native TextTrack implementation
  const HAS_NATIVE_MODE =
    __FEATURES__.NATIVE_VTT as number === __FEATURES__.IS_ENABLED as number ||
    __FEATURES__.NATIVE_SAMI as number === __FEATURES__.IS_ENABLED as number ||
    __FEATURES__.NATIVE_TTML as number === __FEATURES__.IS_ENABLED as number ||
    __FEATURES__.NATIVE_SRT as number === __FEATURES__.IS_ENABLED as number;

  if (__FEATURES__.SMOOTH as number === __FEATURES__.IS_ENABLED as number) {
    features.transports.smooth = require("../transports/smooth/index.ts").default;
  }
  if (__FEATURES__.DASH as number === __FEATURES__.IS_ENABLED as number) {
    features.transports.dash = require("../transports/dash/index.ts").default;
    features.dashParsers.js =
      require("../parsers/manifest/dash/js-parser/index.ts").default;
  }
  if (__FEATURES__.LOCAL_MANIFEST as number === __FEATURES__.IS_ENABLED as number) {
    features.transports.local = require("../transports/local/index.ts").default;
  }
  if (__FEATURES__.METAPLAYLIST as number === __FEATURES__.IS_ENABLED as number) {
    features.transports.metaplaylist =
      require("../transports/metaplaylist/index.ts").default;
  }
  if (__FEATURES__.DEBUG_ELEMENT as number === __FEATURES__.IS_ENABLED as number) {
    features.createDebugElement = require("../core/api/debug/index.ts").default;
  }

  if (HAS_NATIVE_MODE) {
    features.nativeTextTracksBuffer =
      require("../core/segment_buffers/implementations/text/native/index.ts").default;
    if (__FEATURES__.NATIVE_VTT as number === __FEATURES__.IS_ENABLED as number) {
      features.nativeTextTracksParsers.vtt =
        require("../parsers/texttracks/webvtt/native/index.ts").default;
    }

    if (__FEATURES__.NATIVE_TTML as number === __FEATURES__.IS_ENABLED as number) {
      features.nativeTextTracksParsers.ttml =
        require("../parsers/texttracks/ttml/native/index.ts").default;
    }

    if (__FEATURES__.NATIVE_SAMI as number === __FEATURES__.IS_ENABLED as number) {
      features.nativeTextTracksParsers.sami =
        require("../parsers/texttracks/sami/native.ts").default;
    }

    if (__FEATURES__.NATIVE_SRT as number === __FEATURES__.IS_ENABLED as number) {
      features.nativeTextTracksParsers.srt =
        require("../parsers/texttracks/srt/native.ts").default;
    }
  }

  // Feature switching the HTML TextTrack implementation
  const HAS_HTML_MODE =
    __FEATURES__.HTML_VTT as number === __FEATURES__.IS_ENABLED as number ||
    __FEATURES__.HTML_SAMI as number === __FEATURES__.IS_ENABLED as number ||
    __FEATURES__.HTML_TTML as number === __FEATURES__.IS_ENABLED as number ||
    __FEATURES__.HTML_SRT as number === __FEATURES__.IS_ENABLED as number;

  if (HAS_HTML_MODE) {
    features.htmlTextTracksBuffer =
      require("../core/segment_buffers/implementations/text/html/index.ts").default;
    if (__FEATURES__.HTML_SAMI as number === __FEATURES__.IS_ENABLED as number) {
      features.htmlTextTracksParsers.sami =
        require("../parsers/texttracks/sami/html.ts").default;
    }

    if (__FEATURES__.HTML_TTML as number === __FEATURES__.IS_ENABLED as number) {
      features.htmlTextTracksParsers.ttml =
        require("../parsers/texttracks/ttml/html/index.ts").default;
    }

    if (__FEATURES__.HTML_SRT as number === __FEATURES__.IS_ENABLED as number) {
      features.htmlTextTracksParsers.srt =
        require("../parsers/texttracks/srt/html.ts").default;
    }

    if (__FEATURES__.HTML_VTT as number === __FEATURES__.IS_ENABLED as number) {
      features.htmlTextTracksParsers.vtt =
        require("../parsers/texttracks/webvtt/html/index.ts").default;
    }
  }

  if (__FEATURES__.DIRECTFILE as number === __FEATURES__.IS_ENABLED as number) {
    const initDirectFile =
      require("../core/init/directfile_content_initializer.ts").default;
    const mediaElementTrackChoiceManager =
      require("../core/api/tracks_management/media_element_track_choice_manager.ts")
        .default;
    features.directfile = { initDirectFile,
                            mediaElementTrackChoiceManager };
  }
}
