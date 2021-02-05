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

import { Representation } from "../manifest";

export interface IMediaCapabilitiesInfos { supported: boolean;
                                           smooth: boolean;
                                           powerEfficient: boolean; }

type IMediaDecodingType = "media-source" | "file";

interface IVideoConfiguration {
  contentType: string;
  width: number;
  height: number;
  bitrate: number;
  framerate: number;
  // Other attributes as defind in MediaCapabilities spec :
  // boolean hasAlphaChannel;
  // HdrMetadataType hdrMetadataType;
  // ColorGamut colorGamut;
  // TransferFunction transferFunction;
}

interface IAudioConfiguration {
  contentType: string;
  channels?: string;
  bitrate?: number;
  samplerate?: number;
  // Other attributes as defind in MediaCapabilities spec :
  // spatialRendering?: boolean;
}

interface IMediaConfiguration {
  video?: IVideoConfiguration;
  audio?: IAudioConfiguration;
}

interface IMediaDecodingConfiguration extends IMediaConfiguration {
  type: IMediaDecodingType;
  keySystemConfiguration?: any;
}

interface IMediaEncodingConfiguration extends IMediaConfiguration {
  type: IMediaDecodingType;
}

export interface IMediaCapabilities {
  decodingInfo: (configuration: IMediaDecodingConfiguration) =>
    Promise<IMediaCapabilitiesInfos>;
  encodingInfo: (configuration: IMediaEncodingConfiguration) =>
    Promise<IMediaCapabilitiesInfos>;
}

/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
const mediaCapabilities: IMediaCapabilities | undefined =
/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
  (navigator as any).mediaCapabilities;

function getVideoConfiguration(
  representation: Representation
): IVideoConfiguration | undefined {
  const contentType = representation.getMimeTypeString();
  const width = representation.width;
  const height = representation.height;
  const bitrate = representation.bitrate;
  const framerate = representation.frameRate !== undefined ?
    parseInt(representation.frameRate, 10) :
    undefined;
  if (width === undefined ||
      height === undefined ||
      framerate === undefined) {
    return undefined;
  }
  return { contentType,
           width,
           height,
           bitrate,
           framerate };
}

function getAudioConfiguration(representation: Representation): IAudioConfiguration {
  const contentType = representation.getMimeTypeString();
  const bitrate = representation.bitrate;
  return { contentType,
           bitrate };
}

export function getVideoDecodingInfos(
  video: Representation
): undefined | Promise<IMediaCapabilitiesInfos> {
  return getDecodingInfos({ video });
}

export function getAudioDecodingInfos(
  audio: Representation
): undefined | Promise<IMediaCapabilitiesInfos> {
  return getDecodingInfos({ audio });
}

export default function getDecodingInfos(representations: {
  video?: Representation;
  audio?: Representation;
  type?: IMediaDecodingType;
}): undefined | Promise<IMediaCapabilitiesInfos> {
  if (mediaCapabilities === undefined) {
    return undefined;
  }
  const { video, audio, type } = representations;
  const videoConfiguration = (video !== undefined) ?
    getVideoConfiguration(video) :
    undefined;
  const audioConfiguration = (audio !== undefined) ?
    getAudioConfiguration(audio) :
    undefined;
  if (videoConfiguration === undefined &&
      audioConfiguration === undefined) {
    return undefined;
  }
  return mediaCapabilities.decodingInfo({ video: videoConfiguration,
                                          audio: audioConfiguration,
                                          type: type ?? "media-source" });
}
