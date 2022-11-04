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
import { ICdnMetadata } from "../../parsers/manifest";
import { CancellationSignal } from "../../utils/task_canceller";
import { IImageTrackSegmentData, ILoadedImageSegmentFormat, ISegmentContext, ISegmentLoaderCallbacks, ISegmentLoaderOptions, ISegmentLoaderResultSegmentCreated, ISegmentLoaderResultSegmentLoaded, ISegmentParserParsedInitChunk, ISegmentParserParsedMediaChunk } from "../types";
/**
 * Loads an image segment.
 * @param {Object|null} wantedCdn
 * @param {Object} content
 * @param {Object} options
 * @param {Object} cancelSignal
 * @param {Object} callbacks
 * @returns {Promise}
 */
export declare function imageLoader(wantedCdn: ICdnMetadata | null, content: ISegmentContext, options: ISegmentLoaderOptions, cancelSignal: CancellationSignal, callbacks: ISegmentLoaderCallbacks<ILoadedImageSegmentFormat>): Promise<ISegmentLoaderResultSegmentLoaded<ILoadedImageSegmentFormat> | ISegmentLoaderResultSegmentCreated<ILoadedImageSegmentFormat>>;
/**
 * Parses an image segment.
 * @param {Object} loadedSegment
 * @param {Object} content
 * @returns {Object}
 */
export declare function imageParser(loadedSegment: {
    data: ArrayBuffer | Uint8Array | null;
    isChunked: boolean;
}, content: ISegmentContext): ISegmentParserParsedMediaChunk<IImageTrackSegmentData | null> | ISegmentParserParsedInitChunk<null>;
