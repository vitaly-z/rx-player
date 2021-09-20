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
import { ISegmentListIntermediateRepresentation } from "../../../node_parser_types";
import ParsersStack, { IChildrenParser } from "../parsers_stack";
/**
 * Generate a "children parser" once inside a `SegmentList` node.
 * @param {Object} segListChildren
 * @param {WebAssembly.Memory} linearMemory
 * @param {ParsersStack} parsersStack
 * @returns {Function}
 */
export declare function generateSegmentListChildrenParser(segListChildren: ISegmentListIntermediateRepresentation, linearMemory: WebAssembly.Memory, parsersStack: ParsersStack): IChildrenParser;
