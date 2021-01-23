import { manifestInfos } from "../../contents/DASH_static_SegmentTimeline";
import RxPlayer from "../../../src";
import XHRMock from "../../utils/request_mock";
import sleep from "../../utils/sleep.js";
import { waitForLoadedStateAfterLoadVideo } from "../../utils/waitForPlayerState";

let player;
let xhrMock;

describe("Fast-switching", function () {
  const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
  beforeEach(() => {
    player = new RxPlayer();
    xhrMock = new XHRMock();
  });

  afterEach(() => {
    player.dispose();
    xhrMock.restore();
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  const { url, transport } = manifestInfos;

  it("should enable fast-switching by default", async function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 3000;
    player.setVideoBitrate(0);
    player.setWantedBufferAhead(15);
    player.loadVideo({ url,
                       transport,
                       autoPlay: false });
    await waitForLoadedStateAfterLoadVideo(player);
    await sleep(1000);
    player.setVideoBitrate(Infinity);
    await sleep(1000);
    const videoSegmentBuffered = player.__priv_getSegmentBufferContent("video")
      .map(({ infos }) => {
        return { bitrate: infos.representation.bitrate,
                 time: infos.segment.time,
                 end: infos.segment.end };
      });
    expect(videoSegmentBuffered.length).toBeGreaterThanOrEqual(3);
    expect(videoSegmentBuffered[1].bitrate).toEqual(1996000);
    expect(videoSegmentBuffered[2].bitrate).toEqual(1996000);
  });

  it("should enable fast-switching if explicitely enabled", async function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 3000;
    player.setVideoBitrate(0);
    player.setWantedBufferAhead(15);
    player.loadVideo({ url,
                       transport,
                       autoPlay: false,
                       enableFastSwitching: true });
    await waitForLoadedStateAfterLoadVideo(player);
    await sleep(1000);
    player.setVideoBitrate(Infinity);
    await sleep(1000);
    const videoSegmentBuffered = player.__priv_getSegmentBufferContent("video")
      .map(({ infos }) => {
        return { bitrate: infos.representation.bitrate,
                 time: infos.segment.time,
                 end: infos.segment.end };
      });
    expect(videoSegmentBuffered.length).toBeGreaterThanOrEqual(3);
    expect(videoSegmentBuffered[1].bitrate).toEqual(1996000);
    expect(videoSegmentBuffered[2].bitrate).toEqual(1996000);
  });

  it("should disable fast-switching if explicitely disabled", async function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 3000;
    player.setVideoBitrate(0);
    player.setWantedBufferAhead(15);
    player.loadVideo({ url,
                       transport,
                       autoPlay: false,
                       enableFastSwitching: false });
    await waitForLoadedStateAfterLoadVideo(player);
    await sleep(1000);
    player.setVideoBitrate(Infinity);
    await sleep(1000);
    const videoSegmentBuffered = player.__priv_getSegmentBufferContent("video")
      .map(({ infos }) => {
        return { bitrate: infos.representation.bitrate,
                 time: infos.segment.time,
                 end: infos.segment.end };
      });
    expect(videoSegmentBuffered.length).toBeGreaterThanOrEqual(3);
    expect(videoSegmentBuffered[0].bitrate).toEqual(400000);
    expect(videoSegmentBuffered[1].bitrate).toEqual(400000);
    expect(videoSegmentBuffered[2].bitrate).toEqual(400000);
  });
});
