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

import log from "../../../../log";
import { REGXP_LENGTH } from "../regexps";
import { IIntermediateCueStyle } from "./types";

/**
 * Apply `tts:extent` styling to an HTML element.
 * @param {HTMLElement} element
 * @param {string} extent
 */
export default function applyExtent(
  regionStyle : IIntermediateCueStyle,
  extent : string
) : void {
  const trimmedExtent = extent.trim();
  if (trimmedExtent === "auto") {
    return;
  }
  const splittedExtent = trimmedExtent.split(" ");
  if (splittedExtent.length !== 2) {
    return;
  }
  const firstExtent = REGXP_LENGTH.exec(splittedExtent[0]);
  const secondExtent = REGXP_LENGTH.exec(splittedExtent[1]);
  if (firstExtent !== null && secondExtent !== null) {
    if (firstExtent[2] === "px" ||
        firstExtent[2] === "%" ||
        firstExtent[2] === "em")
    {
      regionStyle.width = {
        isProportional: false,
        value: firstExtent[1] + firstExtent[2],
      };
    } else if (firstExtent[2] === "c") {
      regionStyle.width = {
        isProportional: true,
        value: firstExtent[1],
      };
    } else {
      log.warn("TTML Parser: unhandled extent unit:", firstExtent[2]);
    }

    if (secondExtent[2] === "px" ||
        secondExtent[2] === "%" ||
        secondExtent[2] === "em")
    {
      regionStyle.height = {
        isProportional: false,
        value: secondExtent[1] + secondExtent[2],
      };
    } else if (secondExtent[2] === "c") {
      regionStyle.height = {
        isProportional: true,
        value: secondExtent[1],
      };
    } else {
      log.warn("TTML Parser: unhandled extent unit:", secondExtent[2]);
    }
  }
}
