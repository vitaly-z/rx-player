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
import MediaElementTrackChoiceManager from "../core/api/media_element_track_choice_manager";
import type ContentDecryptor from "../core/decrypt";
import { IDirectfileEvent, IDirectFileOptions } from "../core/init/initialize_directfile";
import { SegmentBuffer } from "../core/segment_buffers";
import { IDashParserResponse, IMPDParserArguments } from "../parsers/manifest/dash/parsers_types";
import DashWasmParser from "../parsers/manifest/dash/wasm-parser";
import { IHTMLTextTracksParserFn, INativeTextTracksParserFn } from "../parsers/texttracks";
import { ITransportFunction } from "../transports";
export declare type IDirectFileInit = (args: IDirectFileOptions) => Observable<IDirectfileEvent>;
export declare type IContentDecryptorClass = typeof ContentDecryptor;
export declare type IHTMLTextTracksBuffer = new (mediaElement: HTMLMediaElement, textTrackElement: HTMLElement) => SegmentBuffer;
export declare type INativeTextTracksBuffer = new (mediaElement: HTMLMediaElement, hideNativeSubtitle: boolean) => SegmentBuffer;
export declare type IMediaElementTrackChoiceManager = typeof MediaElementTrackChoiceManager;
interface IBifThumbnail {
    index: number;
    duration: number;
    ts: number;
    data: Uint8Array;
}
interface IBifObject {
    fileFormat: string;
    version: string;
    imageCount: number;
    timescale: number;
    format: string;
    width: number;
    height: number;
    aspectRatio: string;
    isVod: boolean;
    thumbs: IBifThumbnail[];
}
export declare type IImageBuffer = new () => SegmentBuffer;
export declare type IImageParser = ((buffer: Uint8Array) => IBifObject);
export declare type IDashJsParser = (document: Document, args: IMPDParserArguments) => IDashParserResponse<string>;
export interface IFeaturesObject {
    directfile: {
        initDirectFile: IDirectFileInit;
        mediaElementTrackChoiceManager: IMediaElementTrackChoiceManager;
    } | null;
    ContentDecryptor: IContentDecryptorClass | null;
    htmlTextTracksBuffer: IHTMLTextTracksBuffer | null;
    htmlTextTracksParsers: Partial<Record<string, IHTMLTextTracksParserFn>>;
    imageBuffer: IImageBuffer | null;
    imageParser: IImageParser | null;
    transports: Partial<Record<string, ITransportFunction>>;
    dashParsers: {
        wasm: DashWasmParser | null;
        js: IDashJsParser | null;
    };
    nativeTextTracksBuffer: INativeTextTracksBuffer | null;
    nativeTextTracksParsers: Partial<Record<string, INativeTextTracksParserFn>>;
}
export interface IFeatureObject {
    _addFeature(features: IFeaturesObject): void;
}
export declare type IFeatureFunction = (features: IFeaturesObject) => void;
export declare type IFeature = IFeatureObject | IFeatureFunction;
export {};
