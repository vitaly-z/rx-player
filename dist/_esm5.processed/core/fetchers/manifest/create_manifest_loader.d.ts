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
import { ICustomError } from "../../../errors";
import { IManifestLoaderArguments, IManifestLoaderDataLoadedEvent, ITransportManifestPipeline } from "../../../transports";
import { IBackoffOptions } from "../utils/try_urls_with_backoff";
/**
 * A minor Error happened while loading the Manifest (usually a request error)
 * and the request will be retried.
 */
export interface IManifestLoaderWarning {
    type: "warning";
    /** The formatted minor error. */
    value: ICustomError;
}
/** Event emitted by `createManifestLoader`. */
export declare type IManifestLoaderEvent = IManifestLoaderDataLoadedEvent | IManifestLoaderWarning;
/**
 * Returns function allowing to download the Manifest through a
 * `resolver -> loader` transport pipeline.
 *
 * The function returned takes the loader's data in arguments and returns an
 * Observable which will emit:
 *
 *   - each time a minor request error is encountered (in which case the request
 *     is usually retried).
 *   - The loaded Manifest's data
 *
 * This observable will throw if, following the options given, the request and
 * possible retries all failed.
 * @param {Object} manifestPipeline
 * @param {Object} backoffOptions
 * @returns {Function}
 */
export default function createManifestLoader(manifestPipeline: ITransportManifestPipeline, backoffOptions: IBackoffOptions): (x: IManifestLoaderArguments) => Observable<IManifestLoaderEvent>;
