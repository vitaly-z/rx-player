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
import Manifest from "../../../manifest";
import { IPlayerError } from "../../../public_types";
import { ITransportPipelines } from "../../../transports";
/** What will be sent once parsed. */
export interface IManifestFetcherParsedResult {
    /** To differentiate it from a "warning" event. */
    type: "parsed";
    /** The resulting Manifest */
    manifest: Manifest;
    /**
     * The time (`performance.now()`) at which the request was started (at which
     * the JavaScript call was done).
     */
    sendingTime?: number | undefined;
    /** The time (`performance.now()`) at which the request was fully received. */
    receivedTime?: number | undefined;
    parsingTime?: number | undefined;
}
/** Emitted when a fetching or parsing minor error happened. */
export interface IManifestFetcherWarningEvent {
    /** To differentiate it from other events. */
    type: "warning";
    /** The error in question. */
    value: IPlayerError;
}
/** Response emitted by a Manifest fetcher. */
export interface IManifestFetcherResponse {
    /** To differentiate it from a "warning" event. */
    type: "response";
    /** Allows to parse a fetched Manifest into a `Manifest` structure. */
    parse(parserOptions: IManifestFetcherParserOptions): Observable<IManifestFetcherWarningEvent | IManifestFetcherParsedResult>;
}
export interface IManifestFetcherParserOptions {
    /**
     * If set, offset to add to `performance.now()` to obtain the current
     * server's time.
     */
    externalClockOffset?: number | undefined;
    /** The previous value of the Manifest (when updating). */
    previousManifest: Manifest | null;
    /**
     * If set to `true`, the Manifest parser can perform advanced optimizations
     * to speed-up the parsing process. Those optimizations might lead to a
     * de-synchronization with what is actually on the server, hence the "unsafe"
     * part.
     * To use with moderation and only when needed.
     */
    unsafeMode: boolean;
}
/** Options used by `createManifestFetcher`. */
export interface IManifestFetcherSettings {
    /**
     * Whether the content is played in a low-latency mode.
     * This has an impact on default backoff delays.
     */
    lowLatencyMode: boolean;
    /** Maximum number of time a request on error will be retried. */
    maxRetryRegular: number | undefined;
    /** Maximum number of time a request be retried when the user is offline. */
    maxRetryOffline: number | undefined;
}
/**
 * Class allowing to facilitate the task of loading and parsing a Manifest.
 * @class ManifestFetcher
 * @example
 * ```js
 * const manifestFetcher = new ManifestFetcher(manifestUrl, pipelines, options);
 * manifestFetcher.fetch().pipe(
 *   // Filter only responses (might also receive warning events)
 *   filter((evt) => evt.type === "response");
 *   // Parse the Manifest
 *   mergeMap(res => res.parse({ externalClockOffset }))
 *   // (again)
 *   filter((evt) => evt.type === "parsed");
 * ).subscribe(({ value }) => {
 *   console.log("Manifest:", value.manifest);
 * });
 * ```
 */
export default class ManifestFetcher {
    private _settings;
    private _manifestUrl;
    private _pipelines;
    /**
     * Construct a new ManifestFetcher.
     * @param {string | undefined} url - Default Manifest url, will be used when
     * no URL is provided to the `fetch` function.
     * `undefined` if unknown or if a Manifest should be retrieved through other
     * means than an HTTP request.
     * @param {Object} pipelines - Transport pipelines used to perform the
     * Manifest loading and parsing operations.
     * @param {Object} settings - Configure the `ManifestFetcher`.
     */
    constructor(url: string | undefined, pipelines: ITransportPipelines, settings: IManifestFetcherSettings);
    /**
     * (re-)Load the Manifest.
     * This method does not yet parse it, parsing will then be available through
     * a callback available on the response.
     *
     * You can set an `url` on which that Manifest will be requested.
     * If not set, the regular Manifest url - defined on the `ManifestFetcher`
     * instanciation - will be used instead.
     *
     * @param {string} [url]
     * @returns {Observable}
     */
    fetch(url?: string): Observable<IManifestFetcherResponse | IManifestFetcherWarningEvent>;
    /**
     * Parse an already loaded Manifest.
     *
     * This method should be reserved for Manifests for which no request has been
     * done.
     * In other cases, it's preferable to go through the `fetch` method, so
     * information on the request can be used by the parsing process.
     * @param {*} manifest
     * @param {Object} parserOptions
     * @returns {Observable}
     */
    parse(manifest: unknown, parserOptions: IManifestFetcherParserOptions): Observable<IManifestFetcherWarningEvent | IManifestFetcherParsedResult>;
    /**
     * Parse a Manifest.
     *
     * @param {Object} loaded - Information about the loaded Manifest as well as
     * about the corresponding request.
     * @param {Object} parserOptions - Options used when parsing the Manifest.
     * @returns {Observable}
     */
    private _parseLoadedManifest;
    /**
     * Construct "backoff settings" that can be used with a range of functions
     * allowing to perform multiple request attempts
     * @param {Function} onRetry
     * @returns {Object}
     */
    private _getBackoffSetting;
}
