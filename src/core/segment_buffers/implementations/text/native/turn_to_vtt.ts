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

import { IIntermediateCueElement, IIntermediateParagraphStyle } from "../../../../../parsers/texttracks/ttml/unified/types";
import { ITTMLCue } from "../../../../../parsers/texttracks/types";
import {
    ICompatVTTCue,
    isVTTCue,
    makeVTTCue,
  } from "../../../../../compat";
  import isNonEmptyString from "../../../../utils/is_non_empty_string";
  import {
    ITTParameters,
  } from "../get_parameters";
  import {
    IStyleList,
    IStyleObject,
  } from "../get_styling";
  import getTimeDelimiters from "../get_time_delimiters";
  import { REGXP_PERCENT_VALUES, } from "../regexps";

  const TEXT_ALIGN_TO_LIGN_ALIGN : Partial<Record<string, string>> = {
    left: "start",
    center: "center",
    right: "end",
    start: "start",
    end: "end",
  };

  /**
   * @type {Object}
   */
  const TEXT_ALIGN_TO_POSITION_ALIGN : Partial<Record<string, string>> = {
    left: "line-left",
    center: "center",
    right: "line-right",
  };

  /**
   * Parses an Element into a TextTrackCue or VTTCue.
   * /!\ Mutates the given cueElement Element
   * @param {Element} paragraph
   * @param {Number} offset
   * @param {Array.<Object>} styles
   * @param {Array.<Object>} regions
   * @param {Object} paragraphStyle
   * @param {Object} params
   * @param {Boolean} shouldTrimWhiteSpaceOnParagraph
   * @returns {TextTrackCue|null}
   */
export default function turnToVtt(
  cue: ITTMLCue
) : ICompatVTTCue|TextTrackCue|null {
    const text = generateTextContent(cue.element);
    const _cue = makeVTTCue(cue.start, cue.end, text);
    if (_cue === null) {
      return null;
    }
    if (isVTTCue(_cue)) {
      addStyle(_cue, cue);
    }
    return _cue;
  }

  /**
   * Generate text to display for a given paragraph.
   * @param {Element} paragraph - The <p> tag.
   * @param {Boolean} shouldTrimWhiteSpaceForParagraph
   * @returns {string}
   */
  function generateTextContent(cue : IIntermediateCueElement) : string {
      const cueTextElements = cue.paragraph.textContent;
      let text = "";
      for (let i = 0; i < cueTextElements.length; i++) {
        const cueTextElement = cueTextElements[i];
        if (cueTextElement.type === "text") {
          let textContent = cueTextElement.value;
          if (textContent === null) {
            textContent = "";
          }

          // DOM Parser turns HTML escape caracters into caracters,
          // that may be misinterpreted by VTTCue API (typically, less-than sign
          // and greater-than sign can be interpreted as HTML tags signs).
          // Original escaped caracters must be conserved.
          const escapedTextContent = textContent
            .replace(/&|\u0026/g, "&amp;")
            .replace(/<|\u003C/g, "&lt;")
            .replace(/>|\u2265/g, "&gt;")
            .replace(/\u200E/g, "&lrm;")
            .replace(/\u200F/g, "&rlm;")
            .replace(/\u00A0/g, "&nbsp;");

          text += escapedTextContent;
        } else if (cueTextElement.type === "jump") {
          text += "\n";
        }
      }
    return text;
  }

  /**
   * Adds applicable style properties to a cue.
   * /!\ Mutates cue argument.
   * @param {VTTCue} cue
   * @param {Object} style
   */
  function addStyle(cue : ICompatVTTCue, _cue : IIntermediateCueElement) {
    if (_cue.style.width !== undefined &&
        _cue.style.width.isProportional === false) {
      const results = REGXP_PERCENT_VALUES.exec(extent);
      if (results != null) {
        // Use width value of the extent attribute for size.
        // Height value is ignored.
        cue.size = Number(results[1]);
      }
    }

    const writingMode = style.writingMode;
    // let isVerticalText = true;
    switch (writingMode) {
      case "tb":
      case "tblr":
        cue.vertical = "lr";
        break;
      case "tbrl":
        cue.vertical = "rl";
        break;
      default:
        // isVerticalText = false;
        break;
    }
  
    const origin = style.origin;
    if (isNonEmptyString(origin)) {
      const results = REGXP_PERCENT_VALUES.exec(origin);
      if (results != null) {
        // for vertical text use first coordinate of tts:origin
        // to represent line of the cue and second - for position.
        // Otherwise (horizontal), use them the other way around.
        // if (isVerticalText) {
          // TODO check and uncomment
          // cue.position = Number(results[2]);
          // cue.line = Number(results[1]);
        // } else {
          // TODO check and uncomment
          // cue.position = Number(results[1]);
          // cue.line = Number(results[2]);
        // }
        // A boolean indicating whether the line is an integer
        // number of lines (using the line dimensions of the first
        // line of the cue), or whether it is a percentage of the
        // dimension of the video. The flag is set to true when lines
        // are counted, and false otherwise.
        // TODO check and uncomment
        // cue.snapToLines = false;
      }
    }
  
    const align = style.align;
    if (isNonEmptyString(align)) {
      cue.align = align;
      if (align === "center") {
        if (cue.align !== "center") {
          // Workaround for a Chrome bug http://crbug.com/663797
          // Chrome does not support align = "center"
          cue.align = "middle";
        }
        cue.position = "auto";
      }
  
      const positionAlign = TEXT_ALIGN_TO_POSITION_ALIGN[align];
      cue.positionAlign = positionAlign === undefined ? "" :
                                                        positionAlign;
  
      const lineAlign = TEXT_ALIGN_TO_LIGN_ALIGN[align];
      cue.lineAlign = lineAlign === undefined ? "" :
                                                lineAlign;
    }
  }