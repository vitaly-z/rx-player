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
import { IKeySystemOption } from "../../public_types";
import { ITransportPipelines } from "../../transports";
import { IReadOnlySharedReference } from "../../utils/reference";
import { IAdaptiveRepresentationSelectorArguments } from "../adaptive";
import { PlaybackObserver } from "../api";
import { IManifestFetcherParsedResult, IManifestFetcherWarningEvent, ManifestFetcher } from "../fetchers";
import { ITextTrackSegmentBufferOptions } from "../segment_buffers";
import { IAudioTrackSwitchingMode } from "../stream";
import { IInitialTimeOptions } from "./get_initial_time";
import { IInitEvent } from "./types";
/** Arguments to give to the `InitializeOnMediaSource` function. */
export interface IInitializeArguments {
    /** Options concerning the ABR logic. */
    adaptiveOptions: IAdaptiveRepresentationSelectorArguments;
    /** `true` if we should play when loaded. */
    autoPlay: boolean;
    /** Options concerning the media buffers. */
    bufferOptions: {
        /** Buffer "goal" at which we stop downloading new segments. */
        wantedBufferAhead: IReadOnlySharedReference<number>;
        /** Buffer maximum size in kiloBytes at which we stop downloading */
        maxVideoBufferSize: IReadOnlySharedReference<number>;
        /** Max buffer size after the current position, in seconds (we GC further up). */
        maxBufferAhead: IReadOnlySharedReference<number>;
        /** Max buffer size before the current position, in seconds (we GC further down). */
        maxBufferBehind: IReadOnlySharedReference<number>;
        /** Strategy when switching the current bitrate manually (smooth vs reload). */
        manualBitrateSwitchingMode: "seamless" | "direct";
        /**
         * Enable/Disable fastSwitching: allow to replace lower-quality segments by
         * higher-quality ones to have a faster transition.
         */
        enableFastSwitching: boolean;
        /** Strategy when switching of audio track. */
        audioTrackSwitchingMode: IAudioTrackSwitchingMode;
        /** Behavior when a new video and/or audio codec is encountered. */
        onCodecSwitch: "continue" | "reload";
    };
    /** Regularly emit current playback conditions. */
    playbackObserver: PlaybackObserver;
    /** Every encryption configuration set. */
    keySystems: IKeySystemOption[];
    /** `true` to play low-latency contents optimally. */
    lowLatencyMode: boolean;
    /** Initial Manifest value. */
    manifest$: Observable<IManifestFetcherWarningEvent | IManifestFetcherParsedResult>;
    /** Interface allowing to load and refresh the Manifest */
    manifestFetcher: ManifestFetcher;
    /** The HTMLMediaElement on which we will play. */
    mediaElement: HTMLMediaElement;
    /** Limit the frequency of Manifest updates. */
    minimumManifestUpdateInterval: number;
    /** Interface allowing to interact with the transport protocol */
    transport: ITransportPipelines;
    /** Configuration for the segment requesting logic. */
    segmentRequestOptions: {
        /** Maximum number of time a request on error will be retried. */
        regularError: number | undefined;
        /** Maximum number of time a request be retried when the user is offline. */
        offlineError: number | undefined;
        /**
         * Amount of time after which a request should be aborted.
         * `undefined` indicates that a default value is wanted.
         * `-1` indicates no timeout.
         */
        requestTimeout: number | undefined;
    };
    /** Emit the playback rate (speed) set by the user. */
    speed: IReadOnlySharedReference<number>;
    /** The configured starting position. */
    startAt?: IInitialTimeOptions | undefined;
    /** Configuration specific to the text track. */
    textTrackOptions: ITextTrackSegmentBufferOptions;
}
/**
 * Begin content playback.
 *
 * Returns an Observable emitting notifications about the content lifecycle.
 * On subscription, it will perform every necessary tasks so the content can
 * play. Among them:
 *
 *   - Creates a MediaSource on the given `mediaElement` and attach to it the
 *     necessary SourceBuffer instances.
 *
 *   - download the content's Manifest and handle its refresh logic
 *
 *   - Perform decryption if needed
 *
 *   - ask for the choice of the wanted Adaptation through events (e.g. to
 *     choose a language)
 *
 *   - requests and push the right segments (according to the Adaptation choice,
 *     the current position, the network conditions etc.)
 *
 * This Observable will throw in the case where a fatal error (i.e. which has
 * stopped content playback) is encountered, with the corresponding error as a
 * payload.
 *
 * This Observable will never complete, it will always run until it is
 * unsubscribed from.
 * Unsubscription will stop playback and reset the corresponding state.
 *
 * @param {Object} args
 * @returns {Observable}
 */
export default function InitializeOnMediaSource({ adaptiveOptions, autoPlay, bufferOptions, keySystems, lowLatencyMode, manifest$, manifestFetcher, mediaElement, minimumManifestUpdateInterval, playbackObserver, segmentRequestOptions, speed, startAt, transport, textTrackOptions }: IInitializeArguments): Observable<IInitEvent>;
