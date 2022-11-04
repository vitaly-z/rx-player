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
import { ISupplementaryImageTrack, ISupplementaryTextTrack } from "../../manifest";
import { IAudioTrackPreference, IAudioTrackSwitchingMode, IConstructorOptions, IKeySystemOption, ILoadedManifestFormat, ILoadVideoOptions, IManifestLoader, INetworkConfigOption, IRepresentationFilter, ISegmentLoader, IServerSyncInfos, ITextTrackPreference, IVideoTrackPreference } from "../../public_types";
/** Value once parsed for the `startAt` option of the `loadVideo` method. */
export declare type IParsedStartAtOption = {
    position: number;
} | {
    wallClockTime: number;
} | {
    percentage: number;
} | {
    fromLastPosition: number;
} | {
    fromFirstPosition: number;
};
export interface IParsedTransportOptions {
    aggressiveMode?: boolean | undefined;
    checkMediaSegmentIntegrity?: boolean | undefined;
    lowLatencyMode: boolean;
    manifestLoader?: IManifestLoader | undefined;
    manifestUpdateUrl?: string | undefined;
    referenceDateTime?: number | undefined;
    representationFilter?: IRepresentationFilter | undefined;
    segmentLoader?: ISegmentLoader | undefined;
    serverSyncInfos?: IServerSyncInfos | undefined;
    supplementaryImageTracks?: ISupplementaryImageTrack[] | undefined;
    supplementaryTextTracks?: ISupplementaryTextTrack[] | undefined;
    __priv_patchLastSegmentInSidx?: boolean | undefined;
}
/** Options of the RxPlayer's constructor once parsed. */
export interface IParsedConstructorOptions {
    maxBufferAhead: number;
    maxBufferBehind: number;
    wantedBufferAhead: number;
    maxVideoBufferSize: number;
    limitVideoWidth: boolean;
    throttleWhenHidden: boolean;
    throttleVideoBitrateWhenHidden: boolean;
    preferredAudioTracks: IAudioTrackPreference[];
    preferredTextTracks: ITextTrackPreference[];
    preferredVideoTracks: IVideoTrackPreference[];
    videoElement: HTMLMediaElement;
    initialVideoBitrate: number;
    initialAudioBitrate: number;
    minAudioBitrate: number;
    minVideoBitrate: number;
    maxAudioBitrate: number;
    maxVideoBitrate: number;
    stopAtEnd: boolean;
}
/**
 * Base type which the types for the parsed options of the RxPlayer's
 * `loadVideo` method exend.
 */
interface IParsedLoadVideoOptionsBase {
    url: string | undefined;
    transport: string;
    autoPlay: boolean;
    initialManifest: ILoadedManifestFormat | undefined;
    keySystems: IKeySystemOption[];
    lowLatencyMode: boolean;
    minimumManifestUpdateInterval: number;
    networkConfig: INetworkConfigOption;
    transportOptions: IParsedTransportOptions;
    defaultAudioTrack: IAudioTrackPreference | null | undefined;
    defaultTextTrack: ITextTrackPreference | null | undefined;
    startAt: IParsedStartAtOption | undefined;
    manualBitrateSwitchingMode: "seamless" | "direct";
    enableFastSwitching: boolean;
    audioTrackSwitchingMode: IAudioTrackSwitchingMode;
    onCodecSwitch: "continue" | "reload";
}
/**
 * Options of the RxPlayer's `loadVideo` method once parsed when a "native"
 * `textTrackMode` is asked.
 */
interface IParsedLoadVideoOptionsNative extends IParsedLoadVideoOptionsBase {
    textTrackMode: "native";
    hideNativeSubtitle: boolean;
}
/**
 * Options of the RxPlayer's `loadVideo` method once parsed when an "html"
 * `textTrackMode` is asked.
 */
interface IParsedLoadVideoOptionsHTML extends IParsedLoadVideoOptionsBase {
    textTrackMode: "html";
    textTrackElement: HTMLElement;
}
/**
 * Type enumerating all possible forms for the parsed options of the RxPlayer's
 * `loadVideo` method.
 */
export declare type IParsedLoadVideoOptions = IParsedLoadVideoOptionsNative | IParsedLoadVideoOptionsHTML;
/**
 * Parse options given to the API constructor and set default options as found
 * in the config.
 *
 * Do not mutate anything, only cross the given options and sane default options
 * (most coming from the config).
 * @param {Object|undefined} options
 * @returns {Object}
 */
declare function parseConstructorOptions(options: IConstructorOptions): IParsedConstructorOptions;
/**
 * Check the format of given reload options.
 * Throw if format in invalid.
 * @param {object | undefined} options
 */
declare function checkReloadOptions(options?: {
    reloadAt?: {
        position?: number;
        relative?: number;
    };
}): void;
/**
 * Parse options given to loadVideo and set default options as found
 * in the config.
 *
 * Do not mutate anything, only cross the given options and sane default options
 * (most coming from the config).
 *
 * Throws if any mandatory option is not set.
 * @param {Object|undefined} options
 * @param {Object} ctx - The player context, needed for some default values.
 * @returns {Object}
 */
declare function parseLoadVideoOptions(options: ILoadVideoOptions): IParsedLoadVideoOptions;
export { checkReloadOptions, parseConstructorOptions, parseLoadVideoOptions, };
