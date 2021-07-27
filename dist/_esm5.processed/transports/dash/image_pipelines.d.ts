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
import { CancellationSignal } from "../../utils/task_canceller";
import { IImageTrackSegmentData, ILoadedImageSegmentFormat, ISegmentContext, ISegmentLoaderCallbacks, ISegmentLoaderResultChunkedComplete, ISegmentLoaderResultSegmentCreated, ISegmentLoaderResultSegmentLoaded, ISegmentParserParsedInitSegment, ISegmentParserParsedSegment } from "../types";
/**
 * Loads an image segment.
 * @param {string|null} url
 * @param {Object} content
 * @param {Object} cancelSignal
 * @param {Object} callbacks
 * @returns {Promise}
 */
export declare function imageLoader(url: string | null, content: ISegmentContext, cancelSignal: CancellationSignal, callbacks: ISegmentLoaderCallbacks<ILoadedImageSegmentFormat>): Promise<ISegmentLoaderResultSegmentLoaded<ILoadedImageSegmentFormat> | ISegmentLoaderResultSegmentCreated<ILoadedImageSegmentFormat> | ISegmentLoaderResultChunkedComplete>;
/**
 * Parses an image segment.
 * @param {Object} args
 * @returns {Object}
 */
export declare function imageParser(loadedSegment: {
    data: ArrayBuffer | Uint8Array | null;
    isChunked: boolean;
}, content: ISegmentContext): ISegmentParserParsedSegment<IImageTrackSegmentData | null> | ISegmentParserParsedInitSegment<null>;
