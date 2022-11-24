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

import createAdaptiveRepresentationSelector, {
  IRepresentationEstimator,
} from "../core/adaptive/adaptive_representation_selector";
import { SegmentFetcherCreator } from "../core/fetchers";
import MediaDurationUpdater from "../core/init/utils/media_duration_updater";
import SegmentBuffersStore from "../core/segment_buffers";
import { IContentInitializationData } from "../main";
import Manifest from "../manifest";
import { ITransportPipelines } from "../transports";
import TaskCanceller from "../utils/task_canceller";
import {
  limitVideoWidth,
  manualAudioBitrate,
  manualVideoBitrate,
  maxAudioBitrate,
  maxVideoBitrate,
  minAudioBitrate,
  minVideoBitrate,
  throttleVideo,
  throttleVideoBitrate,
} from "./globals";

export default class WorkerContentStore {
  private _currentContent : IPreparedContentData | null;

  constructor() {
    this._currentContent = null;
  }

  public setNewContent(
    // XXX TODO just what is needed?
    context : IContentInitializationData,
    pipelines : ITransportPipelines,
    manifest : Manifest,
    mediaSource : MediaSource
  ) : void {
    this.disposePreviousContent();
    const { contentId,
            lowLatencyMode } = context;
    const representationEstimator = createAdaptiveRepresentationSelector({
      initialBitrates: {
        audio: context.initialAudioBitrate ?? 0,
        video: context.initialVideoBitrate ?? 0,
      },
      lowLatencyMode,
      minAutoBitrates: {
        audio: minAudioBitrate,
        video: minVideoBitrate,
      },
      maxAutoBitrates: {
        audio: maxAudioBitrate,
        video: maxVideoBitrate,
      },
      manualBitrates: {
        audio: manualAudioBitrate,
        video: manualVideoBitrate,
      },
      throttlers: {
        limitWidth: { video: limitVideoWidth },
        throttle: { video: throttleVideo },
        throttleBitrate: { video: throttleVideoBitrate },
      },
    });

    const contentCanceller = new TaskCanceller();

    const segmentFetcherCreator = new SegmentFetcherCreator(
      pipelines,
      context.segmentRetryOptions,
      contentCanceller.signal);
    const segmentBuffersStore = new SegmentBuffersStore(null, mediaSource);

    /** Maintains the MediaSource's duration up-to-date with the Manifest */
    const mediaDurationUpdater = new MediaDurationUpdater(manifest, mediaSource);

    this._currentContent = { contentId,
                             canceller: contentCanceller,
                             mediaSource,
                             manifest,
                             mediaDurationUpdater,
                             representationEstimator,
                             segmentBuffersStore,
                             segmentFetcherCreator };

  }

  public getCurrentContent() : IPreparedContentData | null {
    return this._currentContent;
  }

  public disposePreviousContent() {
    if (this._currentContent === null) {
      return;
    }
    this._currentContent.canceller.cancel();
    this._currentContent.mediaDurationUpdater.stop();
    // clean-up every created SegmentBuffers
    this._currentContent.segmentBuffersStore.disposeAll();
  }
}

export interface IPreparedContentData {
  contentId : string;
  canceller : TaskCanceller;
  mediaSource : MediaSource;
  manifest : Manifest;
  mediaDurationUpdater : MediaDurationUpdater;
  representationEstimator : IRepresentationEstimator;
  segmentBuffersStore : SegmentBuffersStore;
  segmentFetcherCreator : SegmentFetcherCreator;
}
