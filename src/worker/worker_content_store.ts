/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import createAdaptiveRepresentationSelector, {
  IRepresentationEstimator,
} from "../core/adaptive/adaptive_representation_selector";
import { ManifestFetcher, SegmentFetcherCreator } from "../core/fetchers";
import SegmentBuffersStore from "../core/segment_buffers";
import { IContentInitializationData } from "../main";
import Manifest from "../manifest";
import { IPlayerError } from "../public_types";
import createDashPipelines from "../transports/dash";
import TaskCanceller, {
  CancellationError,
} from "../utils/task_canceller";
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
import sendMessage, {
  ISentManifest,
} from "./send_message";

export default class WorkerContentStore {
  private _currentContent : IPreparedContentData | null;

  constructor() {
    this._currentContent = null;
  }

  public initializeNewContent(
    // XXX TODO just what is needed?
    context : IContentInitializationData
  ) : Promise<ISentManifest> {
    return new Promise((res, rej) => {
      this.disposeContent();
      const { contentId,
              url,
              lowLatencyMode } = context;
      let manifest : Manifest | null = null;
      let hasMediaSourceOpen : boolean = false;

      const mediaSource = new MediaSource();
      const handle = (mediaSource as any).handle;
      sendMessage({ type: "media-source", contentId, value: handle }, [handle]);
      mediaSource.addEventListener("sourceopen", function () {
        hasMediaSourceOpen = true;
        checkIfReadyAndValidate();
      });

      const dashPipelines = createDashPipelines({ lowLatencyMode });
      const manifestFetcher = new ManifestFetcher(
        url === undefined ? undefined : [url],
        dashPipelines,
        context.manifestRetryOptions);
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
      const unbindRejectOnCancellation = contentCanceller.signal
        .register((error: CancellationError) => {
          rej(error);
        });

      const segmentFetcherCreator = new SegmentFetcherCreator(
        dashPipelines,
        context.segmentRetryOptions,
        contentCanceller.signal);
      const segmentBuffersStore = new SegmentBuffersStore(null, mediaSource);

      this._currentContent = { contentId,
                               canceller: contentCanceller,
                               mediaSource,
                               manifest: null,
                               representationEstimator,
                               segmentBuffersStore,
                               segmentFetcherCreator };
      contentCanceller.signal.register(() => {
        manifestFetcher.dispose();
      });
      manifestFetcher.addEventListener("warning", (err : IPlayerError) => {
        sendMessage({ type: "warning",
                      contentId,
                      /* eslint-disable-next-line  @typescript-eslint/no-unsafe-return */
                      value: ({ type: err.type,
                                code: err.code } as any) });
      });
      manifestFetcher.addEventListener("manifestReady", (man : Manifest) => {
        manifest = man;
        checkIfReadyAndValidate();
      });
      manifestFetcher.addEventListener("error", (err : unknown) => {
        rej(err);
      });
      manifestFetcher.start();

      function checkIfReadyAndValidate() {
        if (manifest === null || !hasMediaSourceOpen || contentCanceller.isUsed()) {
          return;
        }

        const sentManifest = manifest.getShareableManifest();
        unbindRejectOnCancellation();
        res(sentManifest);
      }
    });
  }

  public getCurrentContent() : IPreparedContentData | null {
    return this._currentContent;
  }

  public disposeContent() {
    if (this._currentContent === null) {
      return;
    }
    this._currentContent.canceller.cancel();
    // clean-up every created SegmentBuffers
    this._currentContent.segmentBuffersStore.disposeAll();
  }
}

export interface IPreparedContentData {
  contentId : string;
  canceller : TaskCanceller;
  mediaSource : MediaSource;
  manifest : Manifest | null;
  representationEstimator : IRepresentationEstimator;
  segmentBuffersStore : SegmentBuffersStore;
  segmentFetcherCreator : SegmentFetcherCreator;
}
