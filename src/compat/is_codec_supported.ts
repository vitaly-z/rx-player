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
import { IRepresentation } from "../manifest";
import { MediaSource_ } from "./browser_compatibility_types";

// XXX TODO
function canUseMediaCapabilitiesApi() : boolean {
  return true;
}

/**
 * Returns true if the given codec is supported by the browser's MediaSource
 * implementation.
 * @param {string} mimeType - The MIME media type that you want to test support
 * for in the current browser.
 * This may include the codecs parameter to provide added details about the
 * codecs used within the file.
 * @returns {Boolean}
 */
export default async function isCodecSupported(
  representation : IRepresentation,
  adaptationType : "audio" | "video"
) : Promise<boolean> {
  if (canUseMediaCapabilitiesApi() && adaptationType === "video") {
    const mimeTypeStr = representation.getMimeTypeString();
    const width = representation.width ?? 1;
    const height = representation.height ?? 1;
    const bitrate = representation.bitrate;

    let framerate = 1;
    if (representation.frameRate !== undefined) {
      const tmpFrameRate = parseMaybeDividedNumber(representation.frameRate);
      if (tmpFrameRate !== null && isFinite(tmpFrameRate)) {
        framerate = tmpFrameRate;
      }
    }

    try {
      const supportObj = await navigator.mediaCapabilities.decodingInfo({
        type: "media-source",
        video: {
          contentType: mimeTypeStr,
          width,
          height,
          bitrate,
          framerate,
        },
      });
      return supportObj.supported;
    } catch (err) {
      log.warn("Compat: mediaCapabilities.decodingInfo API failed for video content",
               err);
    }
  }

  if (MediaSource_ == null) {
    return false;
  }

  /* eslint-disable-next-line @typescript-eslint/unbound-method */
  if (typeof MediaSource_.isTypeSupported === "function") {
    const mimeTypeStr = representation.getMimeTypeString();
    return MediaSource_.isTypeSupported(mimeTypeStr);
  }

  return true;
}

/**
 * Frame rates can be expressed as divisions of integers.
 * This function tries to convert it to a floating point value.
 * TODO in v4, declares `frameRate` as number directly
 * @param {string} val
 * @param {string} displayName
 * @returns {Array.<number | Error | null>}
 */
function parseMaybeDividedNumber(val : string) : number | null {
  const matches = /^(\d+)\/(\d+)$/.exec(val);
  if (matches !== null) {
    // No need to check, we know both are numbers
    return +matches[1] / +matches[2];
  }
  return Number.parseFloat(val);
}
