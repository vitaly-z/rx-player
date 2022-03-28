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
import { Observable } from "rxjs";
import { IImageTrackSegmentData, ISegmentLoaderArguments, ISegmentLoaderEvent, ISegmentParserArguments, ISegmentParserParsedInitSegment, ISegmentParserParsedSegment } from "../types";
/**
 * Loads an image segment.
 * @param {Object} args
 * @returns {Observable}
 */
export declare function imageLoader({ segment, url }: ISegmentLoaderArguments): Observable<ISegmentLoaderEvent<ArrayBuffer | null>>;
/**
 * Parses an image segment.
 * @param {Object} args
 * @returns {Object}
 */
export declare function imageParser({ response, content }: ISegmentParserArguments<Uint8Array | ArrayBuffer | null>): ISegmentParserParsedInitSegment<null> | ISegmentParserParsedSegment<IImageTrackSegmentData | null>;
