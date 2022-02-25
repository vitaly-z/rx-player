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
import { ICustomError } from "../errors";
import { IParsedPeriod } from "../parsers/manifest";
import { IRepresentationFilter } from "./adaptation";
import { IPeriod } from "./types";
/**
 * Create an `IPeriod`-compatible object, which will declare the characteristics
 * of a content during a particular time period.
 * @param {Object} parsedPeriod
 * @param {function|undefined} representationFilter
 * @returns {Array.<Object>} Tuple of two values:
 *   1. The parsed Period as an object
 *   2. Array containing every minor errors that happened when the Manifest has
 *      been created, in the order they have happened..
 */
export declare function createPeriodObject(args: IParsedPeriod, representationFilter?: IRepresentationFilter | undefined): Promise<[IPeriod, ICustomError[]]>;
