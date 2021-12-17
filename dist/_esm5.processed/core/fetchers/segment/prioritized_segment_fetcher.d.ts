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
import ObservablePrioritizer, { IEndedTaskEvent, IInterruptedTaskEvent } from "./prioritizer";
import { ISegmentFetcher, ISegmentFetcherChunkCompleteEvent, ISegmentFetcherChunkEvent, ISegmentFetcherRetry, ISegmentLoaderContent } from "./segment_fetcher";
/**
 * This function basically put in relation:
 *   - an `ISegmentFetcher`, which will be used to perform the segment requests
 *   - a prioritizer, which will handle the priority of a segment request
 *
 * and returns functions to fetch segments with a given priority.
 * @param {Object} prioritizer
 * @param {Object} fetcher
 * @returns {Object}
 */
export default function applyPrioritizerToSegmentFetcher<TSegmentDataType>(prioritizer: ObservablePrioritizer<IPrioritizedSegmentFetcherEvent<TSegmentDataType>>, fetcher: ISegmentFetcher<TSegmentDataType>): IPrioritizedSegmentFetcher<TSegmentDataType>;
/** Oject returned by `applyPrioritizerToSegmentFetcher`. */
export interface IPrioritizedSegmentFetcher<TSegmentDataType> {
    /** Create a new request for a segment with a given priority. */
    createRequest: (content: ISegmentLoaderContent, priority?: number) => Observable<IPrioritizedSegmentFetcherEvent<TSegmentDataType>>;
    /** Update priority of a request created through `createRequest`. */
    updatePriority: (observable: Observable<IPrioritizedSegmentFetcherEvent<TSegmentDataType>>, priority: number) => void;
}
/** Event sent by a `IPrioritizedSegmentFetcher`. */
export declare type IPrioritizedSegmentFetcherEvent<TSegmentDataType> = ISegmentFetcherChunkEvent<TSegmentDataType> | ISegmentFetcherChunkCompleteEvent | ISegmentFetcherRetry | IInterruptedTaskEvent | IEndedTaskEvent;
