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
import { IRepresentation } from "../manifest";
/**
 * Use the `MediaCapabilities` web APIs to detect if the given Representation is
 * supported or not.
 * Returns `true` if it is supported, false it is not and `undefined if it
 * cannot tell.
 * @param {Object} representation
 * @param {string} adaptationType
 * @returns {Promise.<boolean|undefined>}
 */
export default function checkDecodingCapabilitiesSupport(representation: IRepresentation, adaptationType: "audio" | "video"): Promise<boolean | undefined>;
