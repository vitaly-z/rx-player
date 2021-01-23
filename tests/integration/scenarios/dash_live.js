import RxPlayer from "../../../src";
import {
  manifestInfos,
  noTimeShiftBufferDepthManifestInfos,
} from "../../contents/DASH_dynamic_SegmentTimeline";
import sleep from "../../utils/sleep.js";
import XHRMock from "../../utils/request_mock";

describe("DASH live content (SegmentTimeline)", function () {
  let player;
  let xhrMock;

  beforeEach(() => {
    player = new RxPlayer();
    xhrMock = new XHRMock();
  });

  afterEach(() => {
    player.dispose();
    xhrMock.restore();
  });

  it("should fetch and parse the Manifest", async function () {
    xhrMock.lock();
    player.loadVideo({
      url: manifestInfos.url,
      transport: manifestInfos.transport,
    });

    await sleep(1);
    expect(xhrMock.getLockedXHR().length).toEqual(1); // Manifest request
    await xhrMock.flush();
    await sleep(1);

    expect(player.getPlayerState()).toEqual("LOADING");

    const manifest = player.getManifest();
    expect(manifest).not.toEqual(null);
    expect(typeof manifest).toEqual("object");
    expect(manifest.transport)
      .toEqual(manifestInfos.transport);
    expect(typeof manifest.id).toEqual("string");
    expect(manifest.isDynamic).toEqual(true);
    expect(manifest.isLive).toEqual(true);
    expect(manifest.getUrl()).toEqual(manifestInfos.url);

    const adaptations = manifest.periods[0].adaptations;
    const firstPeriodAdaptationsInfos = manifestInfos.periods[0].adaptations;

    expect(adaptations.audio.length)
      .toEqual(firstPeriodAdaptationsInfos.audio.length);
    expect(adaptations.video.length)
      .toEqual(firstPeriodAdaptationsInfos.video.length);

    const firstAudioAdaptationInfos = firstPeriodAdaptationsInfos.audio[0];
    expect(!!adaptations.audio[0].isAudioDescription)
      .toEqual(firstAudioAdaptationInfos.isAudioDescription);
    expect(adaptations.audio[0].language)
      .toEqual(firstAudioAdaptationInfos.language);
    expect(adaptations.audio[0].normalizedLanguage)
      .toEqual(firstAudioAdaptationInfos.normalizedLanguage);
    expect(adaptations.audio[0].type).toEqual("audio");
    expect(typeof adaptations.audio[0].id).toEqual("string");
    expect(adaptations.audio[0].id).not.toEqual(adaptations.video[0].id);
    expect(adaptations.audio[0].representations.length)
      .toEqual(firstAudioAdaptationInfos.representations.length);
    expect(adaptations.audio[0].getAvailableBitrates())
      .toEqual(firstAudioAdaptationInfos.representations
        .map(representation => representation.bitrate));

    const firstVideoAdaptationInfos = firstPeriodAdaptationsInfos.video[0];
    expect(adaptations.video[0].type).toEqual("video");
    expect(adaptations.video[0].getAvailableBitrates())
      .toEqual(firstVideoAdaptationInfos.representations
        .map(representation => representation.bitrate));

    const audioRepresentation = adaptations.audio[0].representations[0];
    const audioRepresentationInfos = firstAudioAdaptationInfos
      .representations[0];
    expect(audioRepresentation.bitrate)
      .toEqual(audioRepresentationInfos.bitrate);
    expect(audioRepresentation.codec)
      .toEqual(audioRepresentationInfos.codec);
    expect(typeof audioRepresentation.id).toEqual("string");
    expect(audioRepresentation.mimeType)
      .toEqual(audioRepresentationInfos.mimeType);
    expect(typeof audioRepresentation.index).toEqual("object");

    const audioRepresentationIndex = audioRepresentation.index;
    const audioRepresentationIndexInfos = audioRepresentationInfos.index;
    const initAudioSegment = audioRepresentationIndex.getInitSegment();
    expect(typeof initAudioSegment.id).toEqual("string");
    expect(initAudioSegment.mediaURLs)
      .toEqual(audioRepresentationIndexInfos.init.mediaURLs);

    const nextAudioSegment1 = audioRepresentationIndex
      .getSegments(1527507769, 4);
    expect(nextAudioSegment1.length).toEqual(1);
    expect(nextAudioSegment1[0].duration)
      .toEqual(audioRepresentationIndexInfos.segments[0].duration);
    expect(typeof nextAudioSegment1[0].id).toEqual("string");
    expect(nextAudioSegment1[0].isInit).toEqual(false);
    expect(nextAudioSegment1[0].time)
      .toEqual(audioRepresentationIndexInfos.segments[0].time);
    expect(nextAudioSegment1[0].timescale)
      .toEqual(audioRepresentationIndexInfos.segments[0].timescale);
    expect(nextAudioSegment1[0].mediaURLs)
      .toEqual(audioRepresentationIndexInfos.segments[0].mediaURLs);

    const nextAudioSegment2 = audioRepresentationIndex
      .getSegments(1527507769, 10);
    expect(nextAudioSegment2.length).toEqual(2);
    expect(nextAudioSegment2[1].duration)
      .toEqual(audioRepresentationIndexInfos.segments[1].duration);
    expect(typeof nextAudioSegment2[1].id).toEqual("string");
    expect(nextAudioSegment2[1].isInit).toEqual(false);
    expect(nextAudioSegment2[1].time)
      .toEqual(audioRepresentationIndexInfos.segments[1].time);
    expect(nextAudioSegment2[1].timescale)
      .toEqual(audioRepresentationIndexInfos.segments[1].timescale);
    expect(nextAudioSegment2[1].mediaURLs)
      .toEqual(audioRepresentationIndexInfos.segments[1].mediaURLs);

    expect(audioRepresentationIndex.getSegments(1527507769, 287).length)
      .toEqual(48);
    expect(audioRepresentationIndex.getSegments(1527507769, 288).length)
      .toEqual(49);
    expect(audioRepresentationIndex
      .getSegments(1527507769, 300000000000).length).toEqual(49);

    const videoRepresentation = adaptations.video[0].representations[0];
    const videoRepresentationInfos = firstVideoAdaptationInfos
      .representations[0];

    expect(videoRepresentation.bitrate)
      .toEqual(videoRepresentationInfos.bitrate);
    expect(videoRepresentation.codec)
      .toEqual(videoRepresentationInfos.codec);
    expect(typeof videoRepresentation.id).toEqual("string");
    expect(videoRepresentation.height)
      .toEqual(videoRepresentationInfos.height);
    expect(videoRepresentation.width)
      .toEqual(videoRepresentationInfos.width);
    expect(videoRepresentation.mimeType)
      .toEqual(videoRepresentationInfos.mimeType);
    expect(typeof videoRepresentation.index)
      .toEqual("object");

    const videoRepresentationIndex = videoRepresentation.index;
    const videoRepresentationIndexInfos = videoRepresentationInfos.index;

    const initVideoSegment = videoRepresentationIndex.getInitSegment();
    expect(typeof initVideoSegment.id).toEqual("string");
    expect(initVideoSegment.mediaURLs)
      .toEqual(videoRepresentationIndexInfos.init.mediaURLs);

    const nextVideoSegment1 = videoRepresentationIndex
      .getSegments(1527507769, 4);
    expect(nextVideoSegment1.length).toEqual(1);
    expect(nextVideoSegment1[0].duration)
      .toEqual(videoRepresentationIndexInfos.segments[0].duration);
    expect(typeof nextVideoSegment1[0].id).toEqual("string");
    expect(nextVideoSegment1[0].isInit).toEqual(false);
    expect(nextVideoSegment1[0].time)
      .toEqual(videoRepresentationIndexInfos.segments[0].time);
    expect(nextVideoSegment1[0].timescale)
      .toEqual(videoRepresentationIndexInfos.segments[0].timescale);
    expect(nextVideoSegment1[0].mediaURLs)
      .toEqual(videoRepresentationIndexInfos.segments[0].mediaURLs);

    const nextVideoSegment2 = videoRepresentationIndex
      .getSegments(1527507769, 10);
    expect(nextVideoSegment2.length).toEqual(2);
    expect(nextVideoSegment2[1].duration)
      .toEqual(videoRepresentationIndexInfos.segments[1].duration);
    expect(typeof nextVideoSegment2[1].id).toEqual("string");
    expect(nextVideoSegment2[1].isInit).toEqual(false);
    expect(nextVideoSegment2[1].time)
      .toEqual(videoRepresentationIndexInfos.segments[1].time);
    expect(nextVideoSegment2[1].timescale)
      .toEqual(videoRepresentationIndexInfos.segments[1].timescale);
    expect(nextVideoSegment2[1].mediaURLs)
      .toEqual(videoRepresentationIndexInfos.segments[1].mediaURLs);

    expect(videoRepresentationIndex.getSegments(1527507769, 287).length)
      .toEqual(48);
    expect(videoRepresentationIndex.getSegments(1527507769, 288).length)
      .toEqual(49);
    expect(
      videoRepresentationIndex.getSegments(1527507769, 300000000000).length
    ).toEqual(49);

    expect(xhrMock.getLockedXHR().length).toBeGreaterThanOrEqual(2);
    const requestsDone = xhrMock.getLockedXHR().map(r => r.url);
    expect(requestsDone)
      .toContain(videoRepresentationIndexInfos.init.mediaURLs[0]);
    expect(requestsDone)
      .toContain(audioRepresentationIndexInfos.init.mediaURLs[0]);
  });

  it("should list the right bitrates", async function () {
    xhrMock.lock();
    player.loadVideo({
      url: manifestInfos.url,
      transport: manifestInfos.transport,
    });

    await sleep(1);
    await xhrMock.flush();
    await sleep(1);

    expect(player.getAvailableAudioBitrates()).toEqual([48000]);
    expect(player.getAvailableVideoBitrates()).toEqual([300000]);
  });

  describe("getAvailableAudioTracks", () => {
    it("should list the right audio languages", async function () {
      xhrMock.lock();

      player.loadVideo({
        url: manifestInfos.url,
        transport: manifestInfos.transport,
      });
      expect(player.getAvailableAudioTracks()).toEqual([]);

      await sleep(1);
      expect(player.getAvailableAudioTracks()).toEqual([]);
      await xhrMock.flush();
      await sleep(1);

      const audioTracks = player.getAvailableAudioTracks();

      const currentPeriod = player.getManifest().periods[0];
      const audioAdaptations = currentPeriod.adaptations.audio;
      expect(audioTracks.length)
        .toEqual(audioAdaptations ? audioAdaptations.length : 0);

      if (audioAdaptations) {
        for (let i = 0; i < audioAdaptations.length; i++) {
          const adaptation = audioAdaptations[i];

          for (let j = 0; j < audioTracks.length; j++) {
            let found = false;
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
            expect(found).toEqual(true);
          }
        }
      }
    });
  });

  describe("getAvailableTextTracks", () => {
    it("should list the right text languages", async function () {
      xhrMock.lock();
      player.loadVideo({
        url: manifestInfos.url,
        transport: manifestInfos.transport,
      });
      expect(player.getAvailableTextTracks()).toEqual([]);

      await sleep(1);
      expect(player.getAvailableTextTracks()).toEqual([]);
      await xhrMock.flush();
      await sleep(1);

      const textTracks = player.getAvailableTextTracks();

      const currentPeriod = player.getManifest().periods[0];
      const textAdaptations = currentPeriod.adaptations.text;
      expect(textTracks.length)
        .toEqual(textAdaptations ? textAdaptations.length : 0);

      if (textAdaptations) {
        for (let i = 0; i < textAdaptations.length; i++) {
          const adaptation = textAdaptations[i];

          for (let j = 0; j < textTracks.length; j++) {
            let found = false;
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
            expect(found).toEqual(true);
          }
        }
      }
    });
  });

  describe("getAvailableVideoTracks", () => {
    it("should list the right video tracks", async function () {
      xhrMock.lock();

      player.loadVideo({
        url: manifestInfos.url,
        transport:manifestInfos.transport,
      });
      expect(player.getAvailableVideoTracks()).toEqual([]);

      await sleep(1);
      expect(player.getAvailableVideoTracks()).toEqual([]);
      await xhrMock.flush();
      await sleep(1);

      const videoTracks = player.getAvailableVideoTracks();

      const currentPeriod = player.getManifest().periods[0];
      const videoAdaptations = currentPeriod.adaptations.video;
      expect(videoTracks.length)
        .toEqual(videoAdaptations ? videoAdaptations.length : 0);

      if (videoAdaptations) {
        for (let i = 0; i < videoAdaptations.length; i++) {
          const adaptation = videoAdaptations[i];

          for (let j = 0; j < videoTracks.length; j++) {
            let found = false;
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
            expect(found).toEqual(true);
          }
        }
      }
    });
  });

  describe("getMinimumPosition", () => {
    it("should return the last position minus the TimeShift window", async () => {
      xhrMock.lock();

      player.loadVideo({ url: manifestInfos.url,
                         transport:manifestInfos.transport });

      await sleep(1);
      await xhrMock.flush();
      await sleep(1);
      expect(player.getMinimumPosition())
        .toBeCloseTo(1527507768, 1);
    });
  });

  describe("getMaximumPosition", () => {
    it("should return the last playable position", async () => {
      xhrMock.lock();

      player.loadVideo({
        url: manifestInfos.url,
        transport:manifestInfos.transport,
      });

      await sleep(1);
      await xhrMock.flush();
      await sleep(1);
      expect(player.getMaximumPosition())
        .toBeCloseTo(1527508062, 1);
    });
  });
});

describe("DASH live content with no timeShiftBufferDepth (SegmentTimeline)", function () {
  let player;
  let xhrMock;

  beforeEach(() => {
    player = new RxPlayer();
    xhrMock = new XHRMock();
  });

  afterEach(() => {
    player.dispose();
    xhrMock.restore();
  });

  it("should fetch and parse the Manifest", async function () {
    xhrMock.lock();
    player.loadVideo({
      url: noTimeShiftBufferDepthManifestInfos.url,
      transport: noTimeShiftBufferDepthManifestInfos.transport,
    });

    await sleep(1);
    expect(xhrMock.getLockedXHR().length).toEqual(1); // Manifest request
    await xhrMock.flush();
    await sleep(1);

    expect(player.getPlayerState()).toEqual("LOADING");

    const manifest = player.getManifest();
    expect(manifest).not.toEqual(null);
    expect(typeof manifest).toEqual("object");
    expect(manifest.transport)
      .toEqual(noTimeShiftBufferDepthManifestInfos.transport);
    expect(typeof manifest.id).toEqual("string");
    expect(manifest.isLive).toEqual(true);
    expect(manifest.getUrl()).toEqual(noTimeShiftBufferDepthManifestInfos.url);

    const adaptations = manifest.periods[0].adaptations;
    const firstPeriodAdaptationsInfos =
      noTimeShiftBufferDepthManifestInfos.periods[0].adaptations;

    expect(adaptations.audio.length)
      .toEqual(firstPeriodAdaptationsInfos.audio.length);
    expect(adaptations.video.length)
      .toEqual(firstPeriodAdaptationsInfos.video.length);

    const firstAudioAdaptationInfos = firstPeriodAdaptationsInfos.audio[0];
    expect(!!adaptations.audio[0].isAudioDescription)
      .toEqual(firstAudioAdaptationInfos.isAudioDescription);
    expect(adaptations.audio[0].language)
      .toEqual(firstAudioAdaptationInfos.language);
    expect(adaptations.audio[0].normalizedLanguage)
      .toEqual(firstAudioAdaptationInfos.normalizedLanguage);
    expect(adaptations.audio[0].type).toEqual("audio");
    expect(typeof adaptations.audio[0].id).toEqual("string");
    expect(adaptations.audio[0].id).not.toEqual(adaptations.video[0].id);
    expect(adaptations.audio[0].representations.length)
      .toEqual(firstAudioAdaptationInfos.representations.length);
    expect(adaptations.audio[0].getAvailableBitrates())
      .toEqual(firstAudioAdaptationInfos.representations
        .map(representation => representation.bitrate)
      );

    const firstVideoAdaptationInfos = firstPeriodAdaptationsInfos.video[0];
    expect(adaptations.video[0].type).toEqual("video");
    expect(adaptations.video[0].getAvailableBitrates())
      .toEqual(firstVideoAdaptationInfos.representations
        .map(representation => representation.bitrate)
      );

    const audioRepresentation = adaptations.audio[0].representations[0];
    const audioRepresentationInfos = firstAudioAdaptationInfos
      .representations[0];
    expect(audioRepresentation.bitrate)
      .toEqual(audioRepresentationInfos.bitrate);
    expect(audioRepresentation.codec)
      .toEqual(audioRepresentationInfos.codec);
    expect(typeof audioRepresentation.id).toEqual("string");
    expect(audioRepresentation.mimeType)
      .toEqual(audioRepresentationInfos.mimeType);
    expect(typeof audioRepresentation.index).toEqual("object");

    const audioRepresentationIndex = audioRepresentation.index;
    const audioRepresentationIndexInfos = audioRepresentationInfos.index;
    const initAudioSegment = audioRepresentationIndex.getInitSegment();
    expect(typeof initAudioSegment.id).toEqual("string");
    expect(initAudioSegment.mediaURLs)
      .toEqual(audioRepresentationIndexInfos.init.mediaURLs);

    const nextAudioSegment1 = audioRepresentationIndex
      .getSegments(1527507762, 5);
    expect(nextAudioSegment1.length).toEqual(1);
    expect(nextAudioSegment1[0].duration)
      .toEqual(audioRepresentationIndexInfos.segments[0].duration);
    expect(typeof nextAudioSegment1[0].id).toEqual("string");
    expect(nextAudioSegment1[0].isInit).toEqual(false);
    expect(nextAudioSegment1[0].time)
      .toEqual(audioRepresentationIndexInfos.segments[0].time);
    expect(nextAudioSegment1[0].timescale)
      .toEqual(audioRepresentationIndexInfos.segments[0].timescale);
    expect(nextAudioSegment1[0].mediaURLs)
      .toEqual(audioRepresentationIndexInfos.segments[0].mediaURLs);

    const nextAudioSegment2 = audioRepresentationIndex
      .getSegments(1527507762, 11);
    expect(nextAudioSegment2.length).toEqual(2);
    expect(nextAudioSegment2[1].duration)
      .toEqual(audioRepresentationIndexInfos.segments[1].duration);
    expect(typeof nextAudioSegment2[1].id).toEqual("string");
    expect(nextAudioSegment2[1].isInit).toEqual(false);
    expect(nextAudioSegment2[1].time)
      .toEqual(audioRepresentationIndexInfos.segments[1].time);
    expect(nextAudioSegment2[1].timescale)
      .toEqual(audioRepresentationIndexInfos.segments[1].timescale);
    expect(nextAudioSegment2[1].mediaURLs)
      .toEqual(audioRepresentationIndexInfos.segments[1].mediaURLs);

    expect(audioRepresentationIndex.getSegments(1527507762, 294).length)
      .toEqual(49);
    expect(audioRepresentationIndex.getSegments(1527507762, 295).length)
      .toEqual(50);
    expect(
      audioRepresentationIndex.getSegments(1527507762, 300000000000).length
    ).toEqual(50);

    const videoRepresentation = adaptations.video[0].representations[0];
    const videoRepresentationInfos = firstVideoAdaptationInfos
      .representations[0];

    expect(videoRepresentation.bitrate)
      .toEqual(videoRepresentationInfos.bitrate);
    expect(videoRepresentation.codec)
      .toEqual(videoRepresentationInfos.codec);
    expect(typeof videoRepresentation.id).toEqual("string");
    expect(videoRepresentation.height)
      .toEqual(videoRepresentationInfos.height);
    expect(videoRepresentation.width)
      .toEqual(videoRepresentationInfos.width);
    expect(videoRepresentation.mimeType)
      .toEqual(videoRepresentationInfos.mimeType);
    expect(typeof videoRepresentation.index)
      .toEqual("object");

    const videoRepresentationIndex = videoRepresentation.index;
    const videoRepresentationIndexInfos = videoRepresentationInfos.index;

    const initVideoSegment = videoRepresentationIndex.getInitSegment();
    expect(typeof initVideoSegment.id).toEqual("string");
    expect(initVideoSegment.mediaURLs)
      .toEqual(videoRepresentationIndexInfos.init.mediaURLs);

    const nextVideoSegment1 = videoRepresentationIndex
      .getSegments(1527507762, 5);
    expect(nextVideoSegment1.length).toEqual(1);
    expect(nextVideoSegment1[0].duration)
      .toEqual(videoRepresentationIndexInfos.segments[0].duration);
    expect(typeof nextVideoSegment1[0].id).toEqual("string");
    expect(nextVideoSegment1[0].isInit).toEqual(false);
    expect(nextVideoSegment1[0].time)
      .toEqual(videoRepresentationIndexInfos.segments[0].time);
    expect(nextVideoSegment1[0].timescale)
      .toEqual(videoRepresentationIndexInfos.segments[0].timescale);
    expect(nextVideoSegment1[0].mediaURLs)
      .toEqual(videoRepresentationIndexInfos.segments[0].mediaURLs);

    const nextVideoSegment2 = videoRepresentationIndex
      .getSegments(1527507762, 11);
    expect(nextVideoSegment2.length).toEqual(2);
    expect(nextVideoSegment2[1].duration)
      .toEqual(videoRepresentationIndexInfos.segments[1].duration);
    expect(typeof nextVideoSegment2[1].id).toEqual("string");
    expect(nextVideoSegment2[1].isInit).toEqual(false);
    expect(nextVideoSegment2[1].time)
      .toEqual(videoRepresentationIndexInfos.segments[1].time);
    expect(nextVideoSegment2[1].timescale)
      .toEqual(videoRepresentationIndexInfos.segments[1].timescale);
    expect(nextVideoSegment2[1].mediaURLs)
      .toEqual(videoRepresentationIndexInfos.segments[1].mediaURLs);

    expect(videoRepresentationIndex.getSegments(1527507762, 294).length)
      .toEqual(49);
    expect(videoRepresentationIndex.getSegments(1527507762, 295).length)
      .toEqual(50);
    expect(
      videoRepresentationIndex.getSegments(1527507762, 300000000000).length
    ).toEqual(50);

    expect(xhrMock.getLockedXHR().length).toBeGreaterThanOrEqual(2);
    const requestsDone = xhrMock.getLockedXHR().map(r => r.url);
    expect(requestsDone)
      .toContain(videoRepresentationIndexInfos.init.mediaURLs[0]);
    expect(requestsDone)
      .toContain(audioRepresentationIndexInfos.init.mediaURLs[0]);
  });

  it("should list the right bitrates", async function () {
    xhrMock.lock();
    player.loadVideo({
      url: noTimeShiftBufferDepthManifestInfos.url,
      transport: noTimeShiftBufferDepthManifestInfos.transport,
    });

    await sleep(1);
    await xhrMock.flush();
    await sleep(1);

    expect(player.getAvailableAudioBitrates()).toEqual([48000]);
    expect(player.getAvailableVideoBitrates()).toEqual([300000]);
  });

  describe("getAvailableAudioTracks", () => {
    it("should list the right audio languages", async function () {
      xhrMock.lock();

      player.loadVideo({
        url: noTimeShiftBufferDepthManifestInfos.url,
        transport: noTimeShiftBufferDepthManifestInfos.transport,
      });
      expect(player.getAvailableAudioTracks()).toEqual([]);

      await sleep(1);
      expect(player.getAvailableAudioTracks()).toEqual([]);
      await xhrMock.flush();
      await sleep(1);

      const audioTracks = player.getAvailableAudioTracks();

      const currentPeriod = player.getManifest().periods[0];
      const audioAdaptations = currentPeriod.adaptations.audio;
      expect(audioTracks.length)
        .toEqual(audioAdaptations ? audioAdaptations.length : 0);

      if (audioAdaptations) {
        for (let i = 0; i < audioAdaptations.length; i++) {
          const adaptation = audioAdaptations[i];

          for (let j = 0; j < audioTracks.length; j++) {
            let found = false;
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
            expect(found).toEqual(true);
          }
        }
      }
    });
  });

  describe("getAvailableTextTracks", () => {
    it("should list the right text languages", async function () {
      xhrMock.lock();
      player.loadVideo({
        url: noTimeShiftBufferDepthManifestInfos.url,
        transport: noTimeShiftBufferDepthManifestInfos.transport,
      });
      expect(player.getAvailableTextTracks()).toEqual([]);

      await sleep(1);
      expect(player.getAvailableTextTracks()).toEqual([]);
      await xhrMock.flush();
      await sleep(1);

      const textTracks = player.getAvailableTextTracks();

      const currentPeriod = player.getManifest().periods[0];
      const textAdaptations = currentPeriod.adaptations.text;
      expect(textTracks.length)
        .toEqual(textAdaptations ? textAdaptations.length : 0);

      if (textAdaptations) {
        for (let i = 0; i < textAdaptations.length; i++) {
          const adaptation = textAdaptations[i];

          for (let j = 0; j < textTracks.length; j++) {
            let found = false;
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
            expect(found).toEqual(true);
          }
        }
      }
    });
  });

  describe("getAvailableVideoTracks", () => {
    it("should list the right video tracks", async function () {
      xhrMock.lock();

      player.loadVideo({
        url: noTimeShiftBufferDepthManifestInfos.url,
        transport:noTimeShiftBufferDepthManifestInfos.transport,
      });
      expect(player.getAvailableVideoTracks()).toEqual([]);

      await sleep(1);
      expect(player.getAvailableVideoTracks()).toEqual([]);
      await xhrMock.flush();
      await sleep(1);

      const videoTracks = player.getAvailableVideoTracks();

      const currentPeriod = player.getManifest().periods[0];
      const videoAdaptations = currentPeriod.adaptations.video;
      expect(videoTracks.length)
        .toEqual(videoAdaptations ? videoAdaptations.length : 0);

      if (videoAdaptations) {
        for (let i = 0; i < videoAdaptations.length; i++) {
          const adaptation = videoAdaptations[i];

          for (let j = 0; j < videoTracks.length; j++) {
            let found = false;
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
            expect(found).toEqual(true);
          }
        }
      }
    });
  });

  describe("getMinimumPosition", () => {
    it("should return the time of the first segment declared", async () => {
      xhrMock.lock();

      player.loadVideo({
        url: noTimeShiftBufferDepthManifestInfos.url,
        transport:noTimeShiftBufferDepthManifestInfos.transport,
      });

      await sleep(1);
      await xhrMock.flush();
      await sleep(1);
      expect(player.getMinimumPosition()).toEqual(6);
    });
  });

  describe("getMaximumPosition", () => {
    it("should return the last playable position", async () => {
      xhrMock.lock();

      player.loadVideo({
        url: noTimeShiftBufferDepthManifestInfos.url,
        transport:noTimeShiftBufferDepthManifestInfos.transport,
      });

      await sleep(1);
      await xhrMock.flush();
      await sleep(1);
      expect(player.getMaximumPosition())
        .toBeCloseTo(1527508062, 1);
    });
  });
});
