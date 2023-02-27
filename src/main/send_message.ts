import { IDecipherabilityStatusChangedElement } from "../core/decrypt/content_decryptor";
import {
  IManifestFetcherSettings,
  ISegmentFetcherCreatorBackoffOptions,
} from "../core/fetchers";
import { IAudioTrackSwitchingMode } from "../public_types";

export default function sendMessage(
  worker : Worker,
  msg : IMainThreadMessage,
  transferables? : Transferable[]
) : void {
  if (transferables === undefined) {
    worker.postMessage(msg);
  } else {
    worker.postMessage(msg, transferables);
  }
}

export interface IReferenceUpdate<TRefName extends string, TRefType> {
  type : "reference-update";
  value : { name : TRefName;
            newVal : TRefType; };
}

export interface IContentInitializationData {
  /** Unique identifier for that content */
  contentId : string;
  /** Url to the content's Manifest */
  url? : string | undefined;
  /** `true` to play low-latency contents optimally. */
  lowLatencyMode : boolean;
  initialVideoBitrate? : number | undefined;
  initialAudioBitrate? : number | undefined;
  manifestRetryOptions : IManifestFetcherSettings;
  segmentRetryOptions : ISegmentFetcherCreatorBackoffOptions;
}

export interface IPrepareContentMessage {
  type : "prepare";
  value : IContentInitializationData;
}

export interface IStartContentMessage {
  type : "start";
  value : IStartContentMessageValue;
}

export interface IStartContentMessageValue {
  initialTime : number;
  drmSystemId : string | undefined;
  /** Strategy when switching the current bitrate manually (smooth vs reload). */
  manualBitrateSwitchingMode : "seamless" | "direct";
  /**
   * Enable/Disable fastSwitching: allow to replace lower-quality segments by
   * higher-quality ones to have a faster transition.
   */
  enableFastSwitching : boolean;
  /** Strategy when switching of audio track. */
  audioTrackSwitchingMode : IAudioTrackSwitchingMode;
  /** Behavior when a new video and/or audio codec is encountered. */
  onCodecSwitch : "continue" | "reload";

  // TODO prepare chosen Adaptations here?
  // In which case the Period's `id` should probably be given instead of the
  // `initialTime`
}

export interface IPlaybackObservationMessage {
  type : "observation";
  value : IWorkerPlaybackObservation;
}

export interface IDecipherabilityStatusChangedMessage {
  type : "decipherabilityStatusChange";
  value : IDecipherabilityStatusChangedElement[];
}

/** Message allowing to update the URL of the content being played. */
export interface IUpdateContentUrlsMessage {
  type : "updateContentUrls";
  value : IUpdateContentUrlsMessageValue;
}

export interface IUpdateContentUrlsMessageValue {
  contentId : string;
  /**
   * URLs to reach that Manifest from the most prioritized URL to the least
   * prioritized URL.
   */
  urls : string[] | undefined;
  /**
   * If `true` the resource in question (e.g. DASH's MPD) will be refreshed
   * immediately.
   */
  refreshNow : boolean;
}

export interface IWorkerPlaybackObservation {
  position: { last : number;
             pending? : number | undefined; };
  duration : number;
  paused : { last : boolean;
             pending? : boolean | undefined; };
  readyState: number;
  speed: number;
}

export type IReferenceUpdateMessage =
  IReferenceUpdate<"wantedBufferAhead", number> |
  IReferenceUpdate<"maxVideoBufferSize", number> |
  IReferenceUpdate<"maxBufferBehind", number> |
  IReferenceUpdate<"maxBufferAhead", number> |
  IReferenceUpdate<"minAudioBitrate", number> |
  IReferenceUpdate<"maxAudioBitrate", number> |
  IReferenceUpdate<"minVideoBitrate", number> |
  IReferenceUpdate<"maxVideoBitrate", number> |
  IReferenceUpdate<"manualAudioBitrate", number> |
  IReferenceUpdate<"manualVideoBitrate", number> |
  IReferenceUpdate<"speed", number> |
  IReferenceUpdate<"limitVideoWidth", number> |
  IReferenceUpdate<"throttleVideo", number> |
  IReferenceUpdate<"throttleVideoBitrate", number>;

export type IMainThreadMessage =
  IPrepareContentMessage |
  /** The last prepared content can now begin. */
  IStartContentMessage |
  IReferenceUpdateMessage |
  IPlaybackObservationMessage |
  IDecipherabilityStatusChangedMessage |
  IUpdateContentUrlsMessage;
