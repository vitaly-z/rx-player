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
import { IManifest } from "../../manifest";
import { IReadOnlySharedReference } from "../../utils/reference";
import ABRManager from "../abr";
import { PlaybackObserver } from "../api";
import { SegmentFetcherCreator } from "../fetchers";
import { IStreamOrchestratorOptions } from "../stream";
import { IMediaSourceLoaderEvent } from "./types";
/** Arguments needed by `createMediaSourceLoader`. */
export interface IMediaSourceLoaderArguments {
    /** Module helping to choose the right Representation. */
    abrManager: ABRManager;
    /** Various stream-related options. */
    bufferOptions: IStreamOrchestratorOptions;
    manifest: IManifest;
    /** Media Element on which the content will be played. */
    mediaElement: HTMLMediaElement;
    /** Emit playback conditions regularly. */
    playbackObserver: PlaybackObserver;
    /** Module to facilitate segment fetching. */
    segmentFetcherCreator: SegmentFetcherCreator;
    /** Last wanted playback rate. */
    speed: IReadOnlySharedReference<number>;
}
/**
 * Returns a function allowing to load or reload the content in arguments into
 * a single or multiple MediaSources.
 * @param {Object} args
 * @returns {Function}
 */
export default function createMediaSourceLoader({ mediaElement, manifest, speed, bufferOptions, abrManager, playbackObserver, segmentFetcherCreator }: IMediaSourceLoaderArguments): (mediaSource: MediaSource, initialTime: number, autoPlay: boolean) => Observable<IMediaSourceLoaderEvent>;
