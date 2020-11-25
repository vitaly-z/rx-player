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

interface IIntermediateCueStyle {
  visibility?: string;
  justifyContent?: string;
  opacity?: string;
  display?: string;
  flexDirection?: string;
  color: string;
  position: string;
  overflow: string;
  width?: { isProportional: boolean; value: string };
  height?: { isProportional: boolean; value: string };
  padding?: string;
  paddingTop?: { isProportional: boolean; value: string };
  paddingBottom?: { isProportional: boolean; value: string };
  paddingLeft?: { isProportional: boolean; value: string };
  paddingRight?: { isProportional: boolean; value: string };
  top?: { isProportional: boolean; value: string };
  left?: { isProportional: boolean; value: string };
}

interface IIntermediateParagraphStyle {
  margin?: string;
  backgroundColor?: string;
  textAlign?: string;
  lineHeight?: { isProportional: boolean; value: string };
}

interface IIntermediateTextStyle {
  color?: string;
  backgroundColor?: string;
  textShadow?: string;
  textDecoration?: string;
  fontFamily?: string;
  fontStyle?: string;
  fontWeight?: string;
  fontSize?: { isProportional: boolean; value: string };
  direction?: string;
  unicodeBidi?: string;
  visibility?: string;
  display?: string;
  whiteSpace?: string;
  position?: string;
}

interface IIntermediateCueElement {
  cellResolution: { columns : number;
                    rows : number; };
  style: IIntermediateCueStyle;
  paragraph: {
    textContent: Array<{
      type: "jump";
    } | {
      type: "text";
      value: string;
      style: IIntermediateTextStyle;
    }>;
    style: IIntermediateParagraphStyle;
  };
}

export {
  IIntermediateCueElement,
  IIntermediateCueStyle,
  IIntermediateParagraphStyle,
  IIntermediateTextStyle,
};
