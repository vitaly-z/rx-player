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

import {
  IAdaptation,
  IManifest,
  IPeriod,
  IRepresentation,
} from "../../../manifest";
import createSharedReference, {
  ISharedReference,
} from "../../../utils/reference";
import { CancellationSignal } from "../../../utils/task_canceller";

interface IRepresentationContext {
  period : IPeriod;
  adaptation : IAdaptation;
  representation : IRepresentation;
}

export default function DecodingCapabilitiesProber(
  manifest : IManifest,
  cancelSignal : CancellationSignal
) : ISharedReference<IRepresentationContext[]> {
  const ret : ISharedReference<IRepresentationContext[]> = createSharedReference([]);
  let interval : number | undefined;
  const timeout = setTimeout(() => {
    async function check() {
      const unsupportedConfs : IRepresentationContext[] = [];
      const chars = _getDecodingCharacteristics(manifest);
      for (const mimeTypeStr of Object.keys(chars.video)) {
        if (mimeTypeStr !== "") {
          for (const otherChars of chars.video[mimeTypeStr]) {
            const supportObj = await navigator.mediaCapabilities.decodingInfo({
              type: "media-source",
              video: { contentType: mimeTypeStr,
                       width: otherChars.width ?? 1,
                       height: otherChars.height ?? 1,
                       bitrate: otherChars.bitrate ?? 1,
                       framerate: otherChars.framerate ?? 1 },
            });
            if (!supportObj.supported) {
              unsupportedConfs.push(...otherChars.representations);
            }
          }
        }
        ret.setValue(unsupportedConfs);
      }

    }
    interval = window.setInterval(() => {
      check().catch((_err : unknown) => {
        // XXX TODO log?
      });
    }, 5 * 60 * 1000);
  });
  // function onManifestUpdate() {
  //   const chars = _getDecodingCharacteristics(manifest);
  // }

  // manifest.addEventListener("manifestUpdate", onManifestUpdate);
  cancelSignal.register(() => {
    // manifest.removeEventListener("manifestUpdate", onManifestUpdate);
    clearTimeout(timeout);
    if (interval !== undefined) {
      clearInterval(interval);
    }
  });
  return ret;
}

interface IVideoDecodingCharacteristics {
  [x : string] : Array<{ width : number | undefined;
                         height : number | undefined;
                         bitrate : number | undefined;
                         framerate : number | undefined;
                         representations : IRepresentationContext[]; }>;
}

function _getDecodingCharacteristics(
  manifest : IManifest
) : { video : IVideoDecodingCharacteristics } {
  const decodingInfoObj : {
    video : IVideoDecodingCharacteristics;
  } = { video: {} };
  for (const period of manifest.periods) {
    for (const adaptation of (period.adaptations.video ?? [])) {
      for (const representation of adaptation.representations) {
        const mimeTypeStr = representation.getMimeTypeString();
        const tmpFrameRate = representation.frameRate !== undefined ?
          parseMaybeDividedNumber(representation.frameRate) :
          null;
        const framerate = tmpFrameRate !== null &&
                          !isNaN(tmpFrameRate) &&
                          isFinite(tmpFrameRate) ? tmpFrameRate :
                                                   undefined;
        const decodingForMimeType = decodingInfoObj.video[mimeTypeStr];
        const context = { period, adaptation, representation };
        if (decodingForMimeType === undefined) {
          decodingInfoObj.video[mimeTypeStr] = [
            { width: representation.width,
              height: representation.height,
              bitrate: representation.bitrate,
              framerate,
              representations: [context] },
          ];
        } else {
          let found = false;
          for (const characteristics of decodingForMimeType) {
            if (characteristics.bitrate === representation.bitrate &&
                characteristics.width === representation.width &&
                characteristics.height === representation.height &&
                characteristics.framerate === representation.frameRate)
            {
              found = true;
              characteristics.representations.push(context);
              break;
            }
          }
          if (!found) {
            decodingForMimeType.push({ width: representation.width,
                                       height: representation.height,
                                       bitrate: representation.bitrate,
                                       framerate,
                                       representations: [context] });
          }
        }
      }
    }
  }
  return decodingInfoObj;
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
