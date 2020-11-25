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

import log from "../../../../../log";
import { REGXP_LENGTH } from "../../regexps";
import { IIntermediateCueStyle } from "./types";

/**
 * @param {HTMLElement} element
 * @param {string} padding
 */
export default function applyPadding(
  regionStyle : IIntermediateCueStyle,
  padding : string
) : void {
  const trimmedPadding = padding.trim();
  const splittedPadding = trimmedPadding.split(" ");
  if (splittedPadding.length < 1) {
    return;
  }

  const firstPadding = REGXP_LENGTH.exec(splittedPadding[0]);
  if (firstPadding === null) {
    return;
  }
  if (firstPadding[2] === "px" ||
      firstPadding[2] === "%" ||
      firstPadding[2] === "em")
  {
    const firstPaddingValue = firstPadding[1] + firstPadding[2];
    if (splittedPadding.length === 1) {
      regionStyle.padding = firstPaddingValue;
    } else if (splittedPadding.length === 2) {
      regionStyle.paddingTop = {
        isProportional: false,
        value: firstPaddingValue,
      };
      regionStyle.paddingBottom = {
        isProportional: false,
        value: firstPaddingValue,
      };
    } else {
      regionStyle.paddingTop = {
        isProportional: false,
        value: firstPaddingValue,
      };
    }
  } else if (firstPadding[2] === "c") {
    if (splittedPadding.length === 1) {
      regionStyle.paddingTop = {
        isProportional: true,
        value: firstPadding[1],
      };
      regionStyle.paddingBottom = {
        isProportional: true,
        value: firstPadding[1],
      };
      regionStyle.paddingLeft = {
        isProportional: true,
        value: firstPadding[1],
      };
      regionStyle.paddingRight = {
        isProportional: true,
        value: firstPadding[1],
      };
    } else if (splittedPadding.length === 2) {
      regionStyle.paddingTop = {
        isProportional: true,
        value: firstPadding[1],
      };
      regionStyle.paddingBottom = {
        isProportional: true,
        value: firstPadding[1],
      };
    } else {
      regionStyle.paddingTop = {
        isProportional: true,
        value: firstPadding[1],
      };
    }
  } else {
    log.warn("TTML Parser: unhandled padding unit:", firstPadding[2]);
  }

  if (splittedPadding.length === 1) {
    return;
  }

  const secondPadding = REGXP_LENGTH.exec(splittedPadding[1]);
  if (secondPadding === null) {
    return;
  }
  if (secondPadding[2] === "px" ||
      secondPadding[2] === "%" ||
      secondPadding[2] === "em")
  {
    const secondPaddingValue = secondPadding[1] + secondPadding[2];
    if (splittedPadding.length < 4) {
      regionStyle.paddingLeft = {
        isProportional: false,
        value: secondPaddingValue,
      };
      regionStyle.paddingRight = {
        isProportional: false,
        value: secondPaddingValue,
      };
    } else {
      regionStyle.paddingRight = {
        isProportional: false,
        value: secondPaddingValue,
      };
    }
  } else if (secondPadding[2] === "c") {
    if (splittedPadding.length < 4) {
      regionStyle.paddingLeft = {
        isProportional: true,
        value: secondPadding[1],
      };
      regionStyle.paddingRight = {
        isProportional: true,
        value: secondPadding[1],
      };
    } else {
      regionStyle.paddingRight = {
        isProportional: true,
        value: secondPadding[1],
      };
    }
  } else {
    log.warn("TTML Parser: unhandled padding unit:", secondPadding[2]);
  }

  if (splittedPadding.length === 2) {
    return;
  }

  const thirdPadding = REGXP_LENGTH.exec(splittedPadding[2]);
  if (thirdPadding === null) {
    return;
  }
  if (thirdPadding[2] === "px" ||
      thirdPadding[2] === "%" ||
      thirdPadding[2] === "em")
  {
    const thirdPaddingValue = thirdPadding[1] + thirdPadding[2];
    regionStyle.paddingBottom = {
      isProportional: false,
      value: thirdPaddingValue,
    };
  } else if (thirdPadding[2] === "c") {
    regionStyle.paddingBottom = {
      isProportional: true,
      value: thirdPadding[1],
    };
  } else {
    log.warn("TTML Parser: unhandled padding unit:", thirdPadding[2]);
  }

  if (splittedPadding.length === 3) {
    return;
  }

  const fourthPadding = REGXP_LENGTH.exec(splittedPadding[3]);
  if (fourthPadding === null) {
    return;
  }
  if (fourthPadding[2] === "px" ||
      fourthPadding[2] === "%" ||
      fourthPadding[2] === "em")
  {
    const fourthPaddingValue = fourthPadding[1] + fourthPadding[2];
    regionStyle.paddingLeft = {
      isProportional: false,
      value: fourthPaddingValue,
    };
  } else if (fourthPadding[2] === "c") {
    regionStyle.paddingLeft = {
      isProportional: true,
      value: fourthPadding[1],
    };
  } else {
    log.warn("TTML Parser: unhandled padding unit:", fourthPadding[2]);
  }
}
