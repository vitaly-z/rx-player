import RxPlayer from "../../../src";
import sleep from "../../utils/sleep.js";
import { waitForLoadedStateAfterLoadVideo } from "../../utils/waitForPlayerState";
import XHRMock from "../../utils/request_mock";

/**
 * Performs a serie of basic tests on a content.
 *
 * @param {Object} manifestInfos - information about what should be found in the
 * manifest.
 * Structure of manifestInfos:
 * ```
 * url {string}
 * transport {string}
 * duration {number}
 * isDynamic {boolean}
 * isLive {boolean}
 * maximumPosition? {number}
 * minimumPosition? {number}
 * availabilityStartTime? {number}
 * periods[]
 *          .adaptations.{
 *            audio,
 *            video,
 *            text,
 *            image
 *          }[]
 *             .isClosedCaption? {boolean}
 *             .isAudioDescription? {boolean}
 *             .normalizedLanguage? {string}
 *             .language? {string}
 *             .representations[]
 *                               .bitrate {number}
 *                               .codec {string}
 *                               .mimeType {string}
 *                               .height? {number}
 *                               .width? {number}
 *                               .index
 *                                     .init
 *                                          .mediaURLs {string}
 *                                     .segments[]
 *                                                .time {number}
 *                                                .timescale {number}
 *                                                .duration {number}
 *                                                .mediaURLs {string}
 * ```
 */
export default function launchTestsForContent(manifestInfos) {
  let player;
  let xhrMock;

  const { availabilityStartTime,
          isDynamic,
          isLive,
          maximumPosition,
          minimumPosition,
          periods: periodsInfos,
          transport } = manifestInfos;

  const firstPeriodIndex = isLive ? periodsInfos.length - 1 : 0;
  const videoRepresentationsForFirstPeriod =
    periodsInfos[firstPeriodIndex].adaptations.video &&
    periodsInfos[firstPeriodIndex].adaptations.video.length ?
      periodsInfos[firstPeriodIndex].adaptations.video[0].representations : [];
  const videoBitrates = videoRepresentationsForFirstPeriod
    .map(representation => representation.bitrate);

  const audioRepresentationsForFirstPeriod =
    periodsInfos[firstPeriodIndex].adaptations.audio &&
    periodsInfos[firstPeriodIndex].adaptations.audio.length ?
      periodsInfos[firstPeriodIndex].adaptations.audio[0].representations : [];
  const audioBitrates = audioRepresentationsForFirstPeriod
    .map(representation => representation.bitrate);

  describe("API tests", () => {
    beforeEach(() => {
      player = new RxPlayer();
      xhrMock = new XHRMock();
    });

    afterEach(() => {
      player.dispose();
      xhrMock.restore();
    });

    describe("loadVideo", () => {
      it("should fetch the manifest then the init segments", async function () {
        xhrMock.lock();

        // set the lowest bitrate to facilitate the test
        player.setVideoBitrate(0);
        player.setAudioBitrate(0);

        player.loadVideo({ url: manifestInfos.url, transport });

        // should only have the manifest for now
        await sleep(1);
        expect(xhrMock.getLockedXHR().length).toEqual(1);
        expect(xhrMock.getLockedXHR()[0].url).toEqual(manifestInfos.url);

        await xhrMock.flush(); // only wait for the manifest request
        await sleep(1);

        expect(player.getPlayerState()).toEqual("LOADING");

        const firstPeriodAdaptationsInfos = periodsInfos[firstPeriodIndex]
          .adaptations;
        const audioRepresentationInfos =
          firstPeriodAdaptationsInfos.audio &&
          firstPeriodAdaptationsInfos.audio[0] &&
          firstPeriodAdaptationsInfos.audio[0].representations[0];
        const videoRepresentationInfos =
          firstPeriodAdaptationsInfos.video &&
          firstPeriodAdaptationsInfos.video[0] &&
          firstPeriodAdaptationsInfos.video[0].representations[0];

        if (
          (audioRepresentationInfos && audioRepresentationInfos.index.init) ||
          (videoRepresentationInfos && videoRepresentationInfos.index.init)
        ) {
          if (
            (audioRepresentationInfos && audioRepresentationInfos.index.init) &&
            (videoRepresentationInfos && videoRepresentationInfos.index.init)
          ) {
            expect(xhrMock.getLockedXHR().length)
              .toEqual(2, "should request two init segments");
            const requestsDone = [
              xhrMock.getLockedXHR()[0].url,
              xhrMock.getLockedXHR()[1].url,
            ];
            expect(requestsDone)
              .toContain(videoRepresentationInfos.index.init.mediaURLs[0]);
            expect(requestsDone)
              .toContain(audioRepresentationInfos.index.init.mediaURLs[0]);
          } else if (!(
            audioRepresentationInfos && audioRepresentationInfos.index.init)
          ) {
            expect(xhrMock.getLockedXHR().length).toEqual(1);
            expect(xhrMock.getLockedXHR()[0].url)
              .toEqual(videoRepresentationInfos.index.init.mediaURLs[0]);
          } else {
            expect(xhrMock.getLockedXHR().length).toEqual(1);
            expect(xhrMock.getLockedXHR()[0].url)
              .toEqual(audioRepresentationInfos.index.init.mediaURLs[0]);
          }
        }
      });

      if (transport === "dash" || transport === "smooth") {
        it("should not do the initial manifest request if an `initialManifest` option is set as a string", async function () {
          const initialManifest = await (
            (await fetch(manifestInfos.url))
              .text());
          xhrMock.lock();
          player.loadVideo({ url: manifestInfos.url,
                             transport,
                             transportOptions: { initialManifest } });

          await sleep(5);
          expect(xhrMock.getLockedXHR().length).toBeGreaterThanOrEqual(1);
          expect(xhrMock.getLockedXHR()[0].url).not.toEqual(manifestInfos.url);
        });
        it("should not do the initial manifest request if an `initialManifest` option is set as a document", async function () {
          const initialManifestStr = await (
            (await fetch(manifestInfos.url))
              .text());
          const initialManifest = new DOMParser().parseFromString(initialManifestStr, "text/xml");
          xhrMock.lock();
          player.loadVideo({ url: manifestInfos.url,
                             transport,
                             transportOptions: { initialManifest } });

          await sleep(100);
          expect(xhrMock.getLockedXHR().length).toBeGreaterThanOrEqual(1);
          expect(xhrMock.getLockedXHR()[0].url).not.toEqual(manifestInfos.url);
        });
      }
    });

    describe("getError", () => {
      it("should return null if no fatal error has happened", async function() {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: false,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getError()).toEqual(null);
      });
    });

    describe("getManifest", () => {
      it("should return the manifest correctly parsed", async function () {
        xhrMock.lock();
        player.loadVideo({ url: manifestInfos.url, transport });

        await sleep(10);
        await xhrMock.flush(); // only wait for the manifest request
        await sleep(10);

        const manifest = player.getManifest();
        expect(manifest).not.toEqual(null);
        expect(typeof manifest).toEqual("object");
        expect(manifest.transport).toEqual(transport);
        expect(typeof manifest.id).toEqual("string");
        expect(manifest.isDynamic).toEqual(isDynamic);
        expect(manifest.isLive).toEqual(isLive);
        expect(manifest.getUrl()).toEqual(manifestInfos.url);

        expect(manifest.getMaximumPosition()).toEqual(maximumPosition);
        expect(manifest.getMinimumPosition()).toEqual(minimumPosition);
        expect(manifest.availabilityStartTime).toEqual(availabilityStartTime);

        expect(manifest.periods.length).toEqual(periodsInfos.length);
        for (
          let periodIndex = 0;
          periodIndex < periodsInfos.length;
          periodIndex++
        ) {
          const periodInfos = periodsInfos[periodIndex];
          const period = manifest.periods[periodIndex];

          expect(period.start).toEqual(periodInfos.start);
          expect(period.duration).toEqual(periodInfos.duration);
          expect(period.end)
            .toEqual(periodInfos.start + periodInfos.duration);

          const allAdaptationInfos = periodInfos.adaptations;
          const allAdaptations = period.adaptations;

          Object.keys(allAdaptations).forEach((type) => {
            const adaptations = allAdaptations[type];
            const adaptationsInfos = allAdaptationInfos[type];

            expect(adaptations.length).toEqual(adaptationsInfos.length);

            for (
              let adaptationIndex = 0;
              adaptationIndex < adaptations.length;
              adaptationIndex++
            ) {
              const adaptation = adaptations[adaptationIndex];
              const adaptationInfos = adaptationsInfos[adaptationIndex];
              const bitrates = adaptationInfos.representations
                .map(representation => representation.bitrate);

              expect(!!adaptation.isAudioDescription)
                .toEqual(!!adaptationInfos.isAudioDescription);

              expect(!!adaptation.isClosedCaption)
                .toEqual(!!adaptationInfos.isClosedCaption);

              expect(adaptation.language)
                .toEqual(adaptationInfos.language);

              expect(adaptation.normalizedLanguage)
                .toEqual(adaptationInfos.normalizedLanguage);

              expect(adaptation.getAvailableBitrates())
                .toEqual(bitrates);

              expect(typeof adaptation.id).toEqual("string");
              expect(adaptation.representations.length)
                .toEqual(adaptationInfos.representations.length);

              for (
                let representationIndex = 0;
                representationIndex < adaptation.representations.length;
                representationIndex++
              ) {
                const representation = adaptation
                  .representations[representationIndex];
                const representationInfos = adaptationInfos
                  .representations[representationIndex];

                expect(representation.bitrate)
                  .toEqual(representationInfos.bitrate);

                expect(representation.codec)
                  .toEqual(representationInfos.codec);

                expect(typeof representation.id).toEqual("string");

                expect(representation.mimeType)
                  .toEqual(representation.mimeType);

                expect(typeof representation.index).toEqual("object");

                const reprIndex = representation.index;
                const reprIndexInfos = representationInfos.index;

                const initSegment = reprIndex.getInitSegment();
                const initSegmentInfos = reprIndexInfos.init;
                if (initSegmentInfos) {
                  expect(initSegment.mediaURLs)
                    .toEqual(initSegmentInfos.mediaURLs);
                  expect(typeof initSegment.id).toEqual("string");
                }

                if (reprIndexInfos.segments.length) {
                  const timescale = reprIndexInfos.segments[0].timescale;
                  const firstSegmentTime =
                    reprIndexInfos.segments[0].time / timescale;
                  const rangeDuration = (
                    (
                      reprIndexInfos.segments[0].time +
                      reprIndexInfos.segments[0].duration / 2
                    ) / timescale
                  ) - firstSegmentTime;
                  const firstSegments =
                    reprIndex.getSegments(firstSegmentTime, rangeDuration);

                  expect(firstSegments.length).toEqual(1);

                  const firstSegment = firstSegments[0];

                  expect(firstSegment.time)
                    .toEqual(reprIndexInfos.segments[0].time);

                  expect(firstSegment.timescale)
                    .toEqual(reprIndexInfos.segments[0].timescale);

                  expect(firstSegment.mediaURLs)
                    .toEqual(reprIndexInfos.segments[0].mediaURLs);
                }
              }
            }
          });
        }
      });
    });

    describe("getCurrentAdaptations", () => {
      it("should return the currently played adaptations", async function () {
        player.setVideoBitrate(0);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });
        await waitForLoadedStateAfterLoadVideo(player);

        const currentAdaptations = player.getCurrentAdaptations();
        expect(typeof currentAdaptations).toEqual("object");
        expect(currentAdaptations.video)
          .toEqual(
            player.getManifest().periods[firstPeriodIndex].adaptations.video &&
            player.getManifest().periods[firstPeriodIndex].adaptations.video[0]
          );
        expect(currentAdaptations.text).toEqual(null);
        expect(currentAdaptations.image)
          .toEqual(
            (
              player.getManifest().periods[firstPeriodIndex]
                .adaptations.image &&
              player.getManifest().periods[firstPeriodIndex]
                .adaptations.image[0]
            ) || null
          );
        expect(currentAdaptations.audio)
          .toEqual(
            player.getManifest().periods[firstPeriodIndex]
              .adaptations.audio &&
            player.getManifest().periods[firstPeriodIndex]
              .adaptations.audio[0]
          );
      });
    });

    describe("getCurrentRepresentations", () => {
      it("should return the currently played representations", async () => {
        player.setVideoBitrate(0);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });
        await waitForLoadedStateAfterLoadVideo(player);

        const currentRepresentations = player.getCurrentRepresentations();
        expect(currentRepresentations.video)
          .toEqual(
            (
              player.getCurrentAdaptations().video &&
              player.getCurrentAdaptations().video.representations[0]
            ) || undefined
          );
        expect(currentRepresentations.text)
          .toEqual(undefined);
        expect(currentRepresentations.image)
          .toEqual(
            (
              player.getCurrentAdaptations().image &&
              player.getCurrentAdaptations().image.representations[0]
            ) || undefined
          );
        expect(currentRepresentations.audio)
          .toEqual(
            (
              player.getCurrentAdaptations().audio &&
              player.getCurrentAdaptations().audio.representations[0]
            ) || undefined
          );
      });
    });

    describe("getVideoElement", () => {
      it("should return a video element", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: false,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getVideoElement()).not.toBeNull();
        expect(player.getVideoElement().nodeType).toEqual(Element.ELEMENT_NODE);
        expect(player.getVideoElement().nodeName.toLowerCase()).toEqual("video");
      });
    });

    describe("getNativeTextTrack", () => {
      it("should be null if no enabled text track", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: false,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getNativeTextTrack()).toBeNull();
      });
    });

    describe("getPlayerState", () => {
      const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
      afterEach(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
      });
      it("should go from LOADING to LOADED", async () => {
        expect(player.getPlayerState()).toEqual("STOPPED");

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: false,
        });
        expect(player.getPlayerState()).toEqual("LOADING");
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPlayerState()).toEqual("LOADED");
        player.pause();
        expect(player.getPlayerState()).toEqual("LOADED");
        await sleep(1);
        expect(player.getPlayerState()).toEqual("LOADED");
      });

      it("should go to PLAYING when play is called", async function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 5000;
        expect(player.getPlayerState()).toEqual("STOPPED");

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: false,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        player.play();
        await sleep(1000);
        expect(player.getPlayerState()).toEqual("PLAYING");
      });

      it("should go to LOADING then to PLAYING immediately when autoPlay is set", async () => {
        expect(player.getPlayerState()).toEqual("STOPPED");

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPlayerState()).toEqual("PLAYING");
      });
    });

    describe("isLive", () => {
      if (isLive) {
        it("should return true", async () => {
          player.loadVideo({
            url: manifestInfos.url,
            transport,
            autoPlay: false,
          });
          await waitForLoadedStateAfterLoadVideo(player);
          expect(player.isLive()).toEqual(true);
        });
      } else {
        it("should return false", async () => {
          player.loadVideo({
            url: manifestInfos.url,
            transport,
            autoPlay: false,
          });
          await waitForLoadedStateAfterLoadVideo(player);
          expect(player.isLive()).toEqual(false);
        });
      }
    });

    describe("getUrl", () => {
      it("should return the URL of the manifest", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: false,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getUrl()).toEqual(manifestInfos.url);
      });
    });

    describe("getVideoDuration", () => {
      if (isLive) {
        it("should return Math.MAX_NUMBER", async () => {
          player.loadVideo({
            url: manifestInfos.url,
            transport,
            autoPlay: false,
          });
          await waitForLoadedStateAfterLoadVideo(player);
          expect(player.getVideoDuration()).toEqual(Math.MAX_NUMBER);
        });
      } else {
        it("should return the duration of the whole video", async () => {
          player.loadVideo({
            url: manifestInfos.url,
            transport,
            autoPlay: false,
          });
          await waitForLoadedStateAfterLoadVideo(player);
          expect(player.getVideoDuration()).toBeCloseTo(maximumPosition, 0.1);
        });
      }
    });

    describe("getVideoBufferGap", () => {
      const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
      afterEach(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
      });

      // TODO handle live contents
      it("should return the buffer gap of the current range", async function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;

        player.setVideoBitrate(Infinity);
        player.setWantedBufferAhead(10);
        expect(player.getWantedBufferAhead()).toEqual(10);
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: false,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        await sleep(1500);

        let bufferGap = player.getVideoBufferGap();
        expect(bufferGap).toBeGreaterThanOrEqual(9.5);
        expect(bufferGap).toBeLessThanOrEqual(10 + 10);

        player.setWantedBufferAhead(20);
        expect(player.getWantedBufferAhead()).toEqual(20);
        await sleep(1500);
        bufferGap = player.getVideoBufferGap();
        expect(bufferGap).toBeGreaterThanOrEqual(19.5);
        expect(bufferGap).toBeLessThanOrEqual(20 + 10);

        player.seekTo(minimumPosition + 10);
        await sleep(1500);
        expect(player.getWantedBufferAhead()).toEqual(20);
        bufferGap = player.getVideoBufferGap();
        expect(bufferGap).toBeGreaterThanOrEqual(19.5);
        expect(bufferGap).toBeLessThanOrEqual(20 + 10);

        player.seekTo(minimumPosition + 10 + 30);
        await sleep(1500);
        expect(player.getWantedBufferAhead()).toEqual(20);
        bufferGap = player.getVideoBufferGap();
        expect(bufferGap).toBeGreaterThanOrEqual(19.5);
        expect(bufferGap).toBeLessThanOrEqual(20 + 10);

        player.setWantedBufferAhead(Infinity);
        expect(player.getWantedBufferAhead()).toEqual(Infinity);
        await sleep(4000);
        bufferGap = player.getVideoBufferGap();
        expect(bufferGap)
          .toBeGreaterThanOrEqual(player.getMaximumPosition() -
                      minimumPosition - (10 + 30) - 2);
        expect(bufferGap)
          .toBeLessThanOrEqual(player.getMaximumPosition() -
                         minimumPosition - (10 + 30) + 10);
      });
    });

    describe("getVideoLoadedTime", () => {
      const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
      afterEach(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
      });
      // TODO handle live contents
      it("should return the time of the current loaded time", async function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 4000;
        player.setWantedBufferAhead(10);
        expect(player.getWantedBufferAhead()).toEqual(10);

        player.loadVideo({ url: manifestInfos.url,
                           transport,
                           autoPlay: false });
        await waitForLoadedStateAfterLoadVideo(player);
        await sleep(500);

        const initialBufferGap = player.getVideoBufferGap();
        expect(player.getPosition()).toBeCloseTo(minimumPosition, 0.1);
        expect(player.getVideoLoadedTime())
          .toBeCloseTo(initialBufferGap, 0.1);

        xhrMock.lock();
        player.seekTo(minimumPosition + 5);
        await sleep(300);
        expect(player.getVideoLoadedTime())
          .toBeCloseTo(initialBufferGap, 0.1);

        await xhrMock.flush();
        xhrMock.unlock();
        await sleep(300);
        expect(player.getVideoLoadedTime())
          .toBeCloseTo(initialBufferGap + 5, 10);

        player.seekTo(minimumPosition + 50);
        await sleep(300);
        expect(player.getVideoLoadedTime()).toBeCloseTo(10, 10);
      });
    });

    describe("getVideoPlayedTime", () => {
      const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
      afterEach(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
      });
      // TODO handle live contents
      it("should return the difference between the start of the current range and the current time", async function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 3000;
        player.setWantedBufferAhead(10);
        expect(player.getWantedBufferAhead()).toEqual(10);

        player.loadVideo({ url: manifestInfos.url,
                           transport,
                           autoPlay: false });
        await waitForLoadedStateAfterLoadVideo(player);
        await sleep(100);

        expect(player.getPosition()).toBeCloseTo(minimumPosition, 0.001);
        expect(player.getVideoPlayedTime()).toEqual(0);

        xhrMock.lock();
        player.seekTo(minimumPosition + 5);
        await sleep(100);
        expect(player.getVideoPlayedTime()).toBeCloseTo(5, 0.001);

        await xhrMock.flush();
        xhrMock.unlock();
        await sleep(300);
        expect(player.getVideoPlayedTime()).toBeCloseTo(5, 0.001);

        player.seekTo(minimumPosition + 30);
        await sleep(800);
        const initialLoadedTime = player.getVideoPlayedTime();
        expect(initialLoadedTime).toBeCloseTo(0, 4);

        player.seekTo(minimumPosition + 30 + 5);
        expect(player.getVideoPlayedTime())
          .toBeCloseTo(initialLoadedTime + 5, 1);
      });
    });

    // TODO handle live contents
    describe("getWallClockTime", () => {
      it("should be at the minimum time by default", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: false,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getWallClockTime()).toBeCloseTo(minimumPosition, 0.001);
      });

      it("should return the starting position if one", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          startAt: { position: minimumPosition + 4 },
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getWallClockTime())
          .toBeCloseTo(minimumPosition + 4, 0.001);
      });

      it("should update as soon as we seek", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        player.seekTo(12);
        expect(player.getWallClockTime()).toEqual(12);
      });
    });

    // TODO handle live contents
    describe("getPosition", () => {
      it("should be at the minimum time by default", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: false,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPosition()).toBeCloseTo(minimumPosition, 0.001);
      });

      it("should return the starting position if one", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          startAt: { position: minimumPosition + 4 },
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPosition()).toBeCloseTo(minimumPosition + 4, 0.001);
      });

      it("should update as soon as we seek", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        player.seekTo(12);
        expect(player.getPosition()).toEqual(12);
      });
    });

    describe("getPlaybackRate", () => {
      it("should be 1 by default", async () => {
        expect(player.getPlaybackRate()).toEqual(1);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getPlaybackRate()).toEqual(1);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPlaybackRate()).toEqual(1);
      });

      // TODO handle live contents
      it("should update when the speed is updated", async () => {
        player.setPlaybackRate(2);
        expect(player.getPlaybackRate()).toEqual(2);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getPlaybackRate()).toEqual(2);
        player.setPlaybackRate(3);
        expect(player.getPlaybackRate()).toEqual(3);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPlaybackRate()).toEqual(3);
        player.setPlaybackRate(0);
        expect(player.getPlaybackRate()).toEqual(0);
      });
    });

    describe("setPlaybackRate", () => {
      const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
      afterEach(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
      });
      // TODO handle live contents
      it("should update the speed accordingly", async function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000;
        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPosition()).toBeCloseTo(minimumPosition, 0.001);
        player.setPlaybackRate(1);
        player.play();
        await sleep(3000);
        const initialPosition = player.getPosition();
        expect(initialPosition).toBeCloseTo(minimumPosition + 3, 1);

        player.setPlaybackRate(3);
        await sleep(2000);
        const secondPosition = player.getPosition();
        expect(secondPosition)
          .toBeCloseTo(initialPosition + 3 * 2, 1.5);
      });
    });

    describe("getAvailableVideoBitrates", () => {
      it("should list the right video bitrates", async function () {
        xhrMock.lock();

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getAvailableVideoBitrates()).toEqual([]);

        await sleep(5);
        expect(player.getAvailableVideoBitrates()).toEqual([]);
        await xhrMock.flush();
        await sleep(10);

        expect(player.getAvailableVideoBitrates()).toEqual(videoBitrates);
      });
    });

    describe("getAvailableAudioBitrates", () => {
      it("should list the right audio bitrates", async function () {
        xhrMock.lock();

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getAvailableAudioBitrates()).toEqual([]);

        await sleep(5);
        expect(player.getAvailableAudioBitrates()).toEqual([]);
        await xhrMock.flush();
        await sleep(10);

        expect(player.getAvailableAudioBitrates()).toEqual(audioBitrates);
      });
    });

    describe("getManualAudioBitrate", () => {
      it("should stay at -1 by default", async () => {
        expect(player.getManualAudioBitrate()).toEqual(-1);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getManualAudioBitrate()).toEqual(-1);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getManualAudioBitrate()).toEqual(-1);
      });

      it("should be able to update", async () => {
        player.setAudioBitrate(10000);
        expect(player.getManualAudioBitrate()).toEqual(10000);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getManualAudioBitrate()).toEqual(10000);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getManualAudioBitrate()).toEqual(10000);
        player.setAudioBitrate(5);
        expect(player.getManualAudioBitrate()).toEqual(5);
      });
    });

    describe("getManualVideoBitrate", () => {
      it("should stay at -1 by default", async () => {
        expect(player.getManualVideoBitrate()).toEqual(-1);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getManualVideoBitrate()).toEqual(-1);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getManualVideoBitrate()).toEqual(-1);
      });

      it("should be able to update", async () => {
        player.setVideoBitrate(10000);
        expect(player.getManualVideoBitrate()).toEqual(10000);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getManualVideoBitrate()).toEqual(10000);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getManualVideoBitrate()).toEqual(10000);
        player.setVideoBitrate(5);
        expect(player.getManualVideoBitrate()).toEqual(5);
      });
    });

    describe("getVideoBitrate", () => {
      it("should give a value once loaded", async () => {
        expect(player.getVideoBitrate()).toEqual(undefined);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getVideoBitrate()).toEqual(undefined);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getAvailableVideoBitrates())
          .toContain(player.getVideoBitrate());
      });
    });

    describe("getAudioBitrate", () => {
      it("should give a value once loaded", async () => {
        expect(player.getAudioBitrate()).toEqual(undefined);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getAudioBitrate()).toEqual(undefined);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getAvailableAudioBitrates())
          .toContain(player.getAudioBitrate());
      });
    });

    describe("getMaxVideoBitrate", () => {
      it("should stay at Infinity by default", async () => {
        expect(player.getMaxVideoBitrate()).toEqual(Infinity);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getManualVideoBitrate()).toEqual(-1);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getManualVideoBitrate()).toEqual(-1);
      });

      it("should be able to update", async () => {
        player.setMaxVideoBitrate(10000);
        expect(player.getMaxVideoBitrate()).toEqual(10000);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getMaxVideoBitrate()).toEqual(10000);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getMaxVideoBitrate()).toEqual(10000);
        player.setMaxVideoBitrate(5);
        expect(player.getMaxVideoBitrate()).toEqual(5);
      });
    });

    describe("getMaxAudioBitrate", () => {
      it("should stay at Infinity by default", async () => {
        expect(player.getMaxAudioBitrate()).toEqual(Infinity);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getManualAudioBitrate()).toEqual(-1);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getManualAudioBitrate()).toEqual(-1);
      });

      it("should be able to update", async () => {
        player.setMaxVideoBitrate(10000);
        expect(player.getMaxVideoBitrate()).toEqual(10000);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });

        expect(player.getMaxVideoBitrate()).toEqual(10000);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getMaxVideoBitrate()).toEqual(10000);
        player.setMaxVideoBitrate(5);
        expect(player.getMaxVideoBitrate()).toEqual(5);
      });
    });

    describe("play", () => {
      it("should begin to play if LOADED", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPlayerState()).toEqual("LOADED");
        player.play();
        await sleep(10);
        expect(player.getPlayerState()).toEqual("PLAYING");
      });

      it("should resume if paused", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        await sleep(100);
        expect(player.getPlayerState()).toEqual("PLAYING");
        player.pause();
        await sleep(100);
        expect(player.getPlayerState()).toEqual("PAUSED");
        player.play();
        await sleep(100);
        expect(player.getPlayerState()).toEqual("PLAYING");
      });
    });

    describe("pause", () => {
      it("should have no effect when LOADED", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPlayerState()).toEqual("LOADED");
        player.pause();
        await sleep(10);
        expect(player.getPlayerState()).toEqual("LOADED");
      });

      it("should pause if playing", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPlayerState()).toEqual("PLAYING");
        player.pause();
        await sleep(100);
        expect(player.getPlayerState()).toEqual("PAUSED");
      });

      it("should do nothing if already paused", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPlayerState()).toEqual("PLAYING");
        player.pause();
        await sleep(100);
        expect(player.getPlayerState()).toEqual("PAUSED");
        player.pause();
        await sleep(100);
        expect(player.getPlayerState()).toEqual("PAUSED");
      });
    });

    // TODO handle live contents
    describe("seekTo", () => {
      it("should be able to seek to a given time once loaded", async () => {
        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getPosition()).toBeLessThan(minimumPosition + 0.1);
        player.seekTo(minimumPosition + 50);
        expect(player.getPosition()).toBeCloseTo(minimumPosition + 50, 0.5);
      });
    });

    describe("getVolume", () => {
      it("should return the current media elment volume", async () => {
        const initialVolume = player.getVideoElement().volume;
        expect(player.getVolume()).toEqual(initialVolume);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getVolume()).toEqual(initialVolume);
      });

      it("should be updated when the volume is updated", async () => {
        const initialVolume = player.getVideoElement().volume;
        expect(player.getVolume()).toEqual(initialVolume);
        player.setVolume(0.54);
        expect(player.getVolume()).toEqual(0.54);
        player.setVolume(0.44);
        expect(player.getVolume()).toEqual(0.44);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });

        expect(player.getVolume()).toEqual(0.44);
        player.setVolume(0.74);
        expect(player.getVolume()).toEqual(0.74);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getVolume()).toEqual(0.74);
        player.setVolume(0.92);
        expect(player.getVolume()).toEqual(0.92);
      });

      it("should return 0 if muted", async () => {
        const initialVolume = player.getVideoElement().volume;
        expect(player.getVolume()).toEqual(initialVolume);
        player.mute();
        expect(player.getVolume()).toEqual(0);
        player.unMute();
        expect(player.getVolume()).toEqual(initialVolume);
        player.mute();

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });

        expect(player.getVolume()).toEqual(0);
        player.setVolume(0.12);
        expect(player.getVolume()).toEqual(0.12);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getVolume()).toEqual(0.12);
      });
    });

    describe("setVolume", () => {
      it("should update the volume", async () => {
        player.setVolume(0.15);
        expect(player.getVolume()).toEqual(0.15);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });

        expect(player.getVolume()).toEqual(0.15);
        player.setVolume(0.16);
        expect(player.getVolume()).toEqual(0.16);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.getVolume()).toEqual(0.16);
        player.setVolume(0.17);
        expect(player.getVolume()).toEqual(0.17);
      });

      it("should un-mute when muted", async () => {
        player.mute();
        expect(player.isMute()).toEqual(true);
        player.setVolume(0.25);
        expect(player.getVolume()).toEqual(0.25);
        expect(player.isMute()).toEqual(false);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });

        expect(player.isMute()).toEqual(false);
        player.mute();
        expect(player.isMute()).toEqual(true);
        player.setVolume(0.33);
        expect(player.getVolume()).toEqual(0.33);
        expect(player.isMute()).toEqual(false);

        await waitForLoadedStateAfterLoadVideo(player);

        expect(player.isMute()).toEqual(false);
        player.mute();
        expect(player.isMute()).toEqual(true);
        player.setVolume(0.45);
        expect(player.getVolume()).toEqual(0.45);
        expect(player.isMute()).toEqual(false);
      });
    });

    describe("isMute", () => {
      it("should be false by default", async () => {
        expect(player.isMute()).toEqual(false);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });

        expect(player.isMute()).toEqual(false);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.isMute()).toEqual(false);
      });

      it("should be true if muted and false if un-muted", async () => {
        player.mute();
        expect(player.isMute()).toEqual(true);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });

        expect(player.isMute()).toEqual(true);
        player.unMute();
        expect(player.isMute()).toEqual(false);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.isMute()).toEqual(false);

        player.mute();
        expect(player.isMute()).toEqual(true);
        player.setVolume(1);
        expect(player.isMute()).toEqual(false);
      });
    });

    describe("mute", () => {
      it("should set the volume to 0", async () => {
        const initialVolume = player.getVideoElement().volume;
        player.mute();
        expect(player.isMute()).toEqual(true);
        expect(player.getVolume()).toEqual(0);
        expect(player.getVideoElement().volume).toEqual(0);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });

        expect(player.isMute()).toEqual(true);
        expect(player.getVolume()).toEqual(0);
        expect(player.getVideoElement().volume).toEqual(0);
        player.unMute();
        expect(player.isMute()).toEqual(false);
        expect(player.getVolume()).toEqual(initialVolume);
        expect(player.getVideoElement().volume).toEqual(initialVolume);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.isMute()).toEqual(false);
        expect(player.getVolume()).toEqual(initialVolume);
        expect(player.getVideoElement().volume).toEqual(initialVolume);

        player.mute();
        expect(player.isMute()).toEqual(true);
        expect(player.getVolume()).toEqual(0);
        expect(player.getVideoElement().volume).toEqual(0);
        player.setVolume(1);
        expect(player.isMute()).toEqual(false);
        expect(player.getVolume()).toEqual(initialVolume);
        expect(player.getVideoElement().volume).toEqual(initialVolume);
      });
    });

    describe("unMute", () => {
      it("should unmute when the volume is muted", async () => {
        const initialVolume = player.getVideoElement().volume;
        player.mute();
        expect(player.isMute()).toEqual(true);
        expect(player.getVolume()).toEqual(0);
        expect(player.getVideoElement().volume).toEqual(0);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });

        expect(player.isMute()).toEqual(true);
        expect(player.getVolume()).toEqual(0);
        expect(player.getVideoElement().volume).toEqual(0);
        player.unMute();
        expect(player.isMute()).toEqual(false);
        expect(player.getVolume()).toEqual(initialVolume);
        expect(player.getVideoElement().volume).toEqual(initialVolume);
        await waitForLoadedStateAfterLoadVideo(player);
        expect(player.isMute()).toEqual(false);
        expect(player.getVolume()).toEqual(initialVolume);
        expect(player.getVideoElement().volume).toEqual(initialVolume);

        player.mute();
        expect(player.isMute()).toEqual(true);
        expect(player.getVolume()).toEqual(0);
        expect(player.getVideoElement().volume).toEqual(0);
        player.setVolume(1);
        expect(player.isMute()).toEqual(false);
        expect(player.getVolume()).toEqual(initialVolume);
        expect(player.getVideoElement().volume).toEqual(initialVolume);
      });
    });

    describe("setVideoBitrate", () => {
      it("should set the video bitrate even if called before the loadVideo", () => {
        player.setVideoBitrate(1000000);
        expect(player.getManualVideoBitrate()).toEqual(1000000);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        expect(player.getManualVideoBitrate()).toEqual(1000000);
      });

      it("should set the video bitrate while playing", async () => {
        player.setVideoBitrate(0.001);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);

        expect(player.getManualVideoBitrate()).toEqual(0.001);

        if (videoBitrates.length) {
          expect(player.getVideoBitrate()).toEqual(videoBitrates[0]);

          if (videoBitrates.length > 1) {
            const newBitrate = videoBitrates[1];
            player.setVideoBitrate(newBitrate);
            await sleep(100);

            expect(player.getManualVideoBitrate()).toEqual(newBitrate);
            expect(player.getVideoBitrate()).toEqual(videoBitrates[1]);

            player.setVideoBitrate(newBitrate + 0.1);
            await sleep(100);

            expect(player.getManualVideoBitrate()).toEqual(newBitrate + 0.1);
            expect(player.getVideoBitrate()).toEqual(videoBitrates[1]);
          }
        } else {
          expect(player.getVideoBitrate()).toEqual(undefined);
        }
      });

      it("should set the minimum bitrate if set to 0", async () => {
        player.setVideoBitrate(0);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);

        expect(player.getManualVideoBitrate()).toEqual(0);
        if (videoBitrates.length) {
          expect(player.getVideoBitrate()).toEqual(videoBitrates[0]);
        } else {
          expect(player.getVideoBitrate()).toEqual(undefined);
        }
      });

      it("should set the maximum bitrate if set to Infinity", async () => {
        player.setVideoBitrate(Infinity);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        // TODO Check why it fails here for A-Team content

        expect(player.getManualVideoBitrate()).toEqual(Infinity);
        if (videoBitrates.length) {
          expect(player.getVideoBitrate())
            .toEqual(videoBitrates[videoBitrates.length - 1]);
        } else {
          expect(player.getVideoBitrate()).toEqual(undefined);
        }
      });
    });

    describe("setAudioBitrate", () => {
      it("should set the audio bitrate even if called before the loadVideo", () => {
        player.setAudioBitrate(1000000);
        expect(player.getManualAudioBitrate()).toEqual(1000000);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        expect(player.getManualAudioBitrate()).toEqual(1000000);
      });

      it("should set the audio bitrate while playing", async () => {
        player.setAudioBitrate(0.001);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);

        expect(player.getManualAudioBitrate()).toEqual(0.001);
        if (audioBitrates.length) {
          expect(player.getAudioBitrate()).toEqual(audioBitrates[0]);

          if (audioBitrates.length > 1) {
            const newBitrate = audioBitrates[1];
            player.setAudioBitrate(newBitrate);
            await sleep(100);

            expect(player.getManualAudioBitrate()).toEqual(newBitrate);
            expect(player.getAudioBitrate()).toEqual(audioBitrates[1]);

            player.setAudioBitrate(newBitrate + 0.1);
            await sleep(100);

            expect(player.getManualAudioBitrate()).toEqual(newBitrate + 0.1);
            expect(player.getAudioBitrate()).toEqual(audioBitrates[1]);
          }
        } else {
          expect(player.getAudioBitrate()).toEqual(undefined);
        }
      });

      it("should set the minimum bitrate if set to 0", async () => {
        player.setAudioBitrate(0);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);

        expect(player.getManualAudioBitrate()).toEqual(0);
        if (audioBitrates.length) {
          expect(player.getAudioBitrate()).toEqual(audioBitrates[0]);
        } else {
          expect(player.getAudioBitrate()).toEqual(undefined);
        }
      });

      it("should set the maximum bitrate if set to Infinity", async () => {
        player.setAudioBitrate(Infinity);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: true,
        });
        await waitForLoadedStateAfterLoadVideo(player);

        expect(player.getManualAudioBitrate()).toEqual(Infinity);
        if (audioBitrates.length) {
          expect(player.getAudioBitrate())
            .toEqual(audioBitrates[audioBitrates.length - 1]);
        } else {
          expect(player.getAudioBitrate()).toEqual(undefined);
        }
      });
    });

    describe("getAvailableAudioTracks", () => {
      it("should list the right audio languages", async function () {
        xhrMock.lock();

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });
        expect(player.getAvailableAudioTracks()).toEqual([]);

        await sleep(1);
        expect(player.getAvailableAudioTracks()).toEqual([]);
        await xhrMock.flush();
        await sleep(50);

        const audioTracks = player.getAvailableAudioTracks();

        const currentPeriod = player.getManifest().periods[firstPeriodIndex];
        const audioAdaptations = currentPeriod.adaptations.audio;
        expect(audioTracks.length)
          .toEqual(audioAdaptations ? audioAdaptations.length : 0);

        if (audioAdaptations) {
          for (let i = 0; i < audioAdaptations.length; i++) {
            const adaptation = audioAdaptations[i];
            let found = false;
            for (let j = 0; j < audioTracks.length; j++) {
              const audioTrack = audioTracks[j];
              if (audioTrack.id === adaptation.id) {
                found = true;
                expect(audioTrack.language).toEqual(adaptation.language || "");
                expect(audioTrack.normalized)
                  .toEqual(adaptation.normalizedLanguage || "");
                expect(audioTrack.audioDescription)
                  .toEqual(!!adaptation.isAudioDescription);

                const activeAudioTrack = player.getAudioTrack();
                expect(audioTrack.active)
                  .toEqual(activeAudioTrack ?
                    activeAudioTrack.id === audioTrack.id : false);
              }
            }
            expect(found).toEqual(true);
          }
        }
      });
    });

    describe("getAvailableTextTracks", () => {
      it("should list the right text languages", async function () {
        xhrMock.lock();

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });
        expect(player.getAvailableTextTracks()).toEqual([]);

        await sleep(1);
        expect(player.getAvailableTextTracks()).toEqual([]);
        await xhrMock.flush();
        await sleep(50);

        const textTracks = player.getAvailableTextTracks();

        const currentPeriod = player.getManifest().periods[firstPeriodIndex];
        const textAdaptations = currentPeriod.adaptations.text;
        expect(textTracks.length)
          .toEqual(textAdaptations ? textAdaptations.length : 0);

        if (textAdaptations) {
          for (let i = 0; i < textAdaptations.length; i++) {
            const adaptation = textAdaptations[i];
            let found = false;
            for (let j = 0; j < textTracks.length; j++) {
              const textTrack = textTracks[j];
              if (textTrack.id === adaptation.id) {
                found = true;
                expect(textTrack.language).toEqual(adaptation.language || "");
                expect(textTrack.normalized)
                  .toEqual(adaptation.normalizedLanguage || "");
                expect(textTrack.closedCaption)
                  .toEqual(!!adaptation.isClosedCaption);

                const activeTextTrack = player.getTextTrack();
                expect(textTrack.active)
                  .toEqual(activeTextTrack ?
                    activeTextTrack.id === textTrack.id : false);
              }
            }
            expect(found).toEqual(true);
          }
        }
      });
    });

    describe("getAvailableVideoTracks", () => {
      it("should list the right video tracks", async function () {
        xhrMock.lock();

        player.loadVideo({
          url: manifestInfos.url,
          transport,
        });
        expect(player.getAvailableVideoTracks()).toEqual([]);

        await sleep(1);
        expect(player.getAvailableVideoTracks()).toEqual([]);
        await xhrMock.flush();
        await sleep(50);

        const videoTracks = player.getAvailableVideoTracks();

        const currentPeriod = player.getManifest().periods[firstPeriodIndex];
        const videoAdaptations = currentPeriod.adaptations.video;
        expect(videoTracks.length)
          .toEqual(videoAdaptations ? videoAdaptations.length : 0);

        if (videoAdaptations) {
          for (let i = 0; i < videoAdaptations.length; i++) {
            const adaptation = videoAdaptations[i];
            let found = false;
            for (let j = 0; j < videoTracks.length; j++) {
              const videoTrack = videoTracks[j];
              if (videoTrack.id === adaptation.id) {
                found = true;

                for (
                  let representationIndex = 0;
                  representationIndex < videoTrack.representations.length;
                  representationIndex++
                ) {
                  const reprTrack = videoTrack
                    .representations[representationIndex];
                  const representation =
                    adaptation.getRepresentation(reprTrack.id);
                  expect(reprTrack.bitrate).toEqual(representation.bitrate);
                  expect(reprTrack.frameRate)
                    .toEqual(representation.frameRate);
                  expect(reprTrack.width).toEqual(representation.width);
                  expect(reprTrack.height).toEqual(representation.height);
                }

                const activeVideoTrack = player.getVideoTrack();
                expect(videoTrack.active)
                  .toEqual(activeVideoTrack ?
                    activeVideoTrack.id === videoTrack.id : false);
              }
            }
            expect(found).toEqual(true);
          }
        }
      });
    });

    describe("setWantedBufferAhead", () => {
      const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
      afterEach(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
      });
      // TODO handle live contents
      it("should download until a set wanted buffer ahead", async function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 8000;
        player.setVideoBitrate(0);
        player.setWantedBufferAhead(10);
        expect(player.getWantedBufferAhead()).toEqual(10);

        player.loadVideo({
          url: manifestInfos.url,
          transport,
          autoPlay: false,
        });
        await waitForLoadedStateAfterLoadVideo(player);
        await sleep(800);
        let buffered = player.getVideoElement().buffered;
        expect(buffered.length).toEqual(1);
        expect(buffered.start(0)).toBeCloseTo(minimumPosition, 0.5);
        let endOfCurrentRange = buffered.end(0);
        expect(endOfCurrentRange)
          .toBeGreaterThanOrEqual(minimumPosition + 9.7);
        expect(endOfCurrentRange)
          .toBeLessThanOrEqual(minimumPosition + 10 + 10);

        player.setWantedBufferAhead(20);
        expect(player.getWantedBufferAhead()).toEqual(20);
        await sleep(800);
        buffered = player.getVideoElement().buffered;
        expect(buffered.length).toEqual(1);
        expect(buffered.start(0)).toBeCloseTo(minimumPosition, 0.5);
        endOfCurrentRange = buffered.end(0);
        expect(endOfCurrentRange)
          .toBeGreaterThanOrEqual(minimumPosition + 19.7);
        expect(endOfCurrentRange)
          .toBeLessThanOrEqual(minimumPosition + 20 + 10);

        player.seekTo(minimumPosition + 10);
        await sleep(800);
        buffered = player.getVideoElement().buffered;
        expect(player.getWantedBufferAhead()).toEqual(20);
        expect(buffered.length).toEqual(1);
        expect(buffered.start(0)).toBeCloseTo(minimumPosition, 0.5);
        endOfCurrentRange = buffered.end(0);
        expect(endOfCurrentRange)
          .toBeGreaterThanOrEqual(Math.min(
            minimumPosition + 10 + 19.7,
            player.getMaximumPosition() - 2
          ));
        expect(endOfCurrentRange)
          .toBeLessThanOrEqual(minimumPosition + 10 + 20 + 10);

        player.seekTo(minimumPosition + 10 + 20 + 10 + 10);
        await sleep(1200);
        buffered = player.getVideoElement().buffered;
        expect(player.getWantedBufferAhead()).toEqual(20);
        expect(buffered.length).toEqual(2);
        expect(buffered.start(1))
          .toBeLessThanOrEqual(minimumPosition + 10 + 20 + 10 + 10);
        endOfCurrentRange = buffered.end(1);
        expect(endOfCurrentRange)
          .toBeGreaterThanOrEqual(Math.min(
            minimumPosition + 10 + 20 + 10 +10 + 19.4,
            player.getMaximumPosition() - 2
          ));
        expect(endOfCurrentRange)
          .toBeLessThanOrEqual(minimumPosition + 10 + 20 + 10 +10 + 20 + 10);

        player.setWantedBufferAhead(Infinity);
        expect(player.getWantedBufferAhead()).toEqual(Infinity);
        await sleep(2000);
        buffered = player.getVideoElement().buffered;
        expect(buffered.length).toEqual(2);
        expect(buffered.start(1))
          .toBeLessThanOrEqual(minimumPosition + 10 + 20 + 10 + 10);
        endOfCurrentRange = buffered.end(1);
        expect(endOfCurrentRange)
          .toBeGreaterThanOrEqual(player.getMaximumPosition() - 2);
        expect(endOfCurrentRange)
          .toBeLessThanOrEqual(player.getMaximumPosition() + 10);
      });
    });
  });
}
