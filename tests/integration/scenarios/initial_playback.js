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

import RxPlayer from "../../../src";
import { manifestInfos } from "../../contents/DASH_static_SegmentTimeline";
import sleep from "../../utils/sleep.js";
import waitForState, {
  waitForLoadedStateAfterLoadVideo,
} from "../../utils/waitForPlayerState";
import XHRMock from "../../utils/request_mock";

describe("basic playback use cases: non-linear DASH SegmentTimeline", function () {
  let player;
  let xhrMock;
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

  it("should begin playback on play", async function () {
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    player.play();
    await sleep(200);
    expect(player.getPosition()).toBeGreaterThan(0);
    expect(player.getPosition()).toBeLessThan(0.25);
    expect(player.getVideoLoadedTime()).toBeGreaterThan(0);
    expect(player.getVideoPlayedTime()).toBeGreaterThan(0);
  });

  it("should play slowly for a speed inferior to 1", async function () {
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    player.setPlaybackRate(0.5);
    player.play();
    const lastPosition = player.getPosition();
    await sleep(300);
    expect(player.getPosition()).toBeLessThan(0.35);
    expect(player.getPosition()).toBeGreaterThan(0.05);
    expect(player.getPosition()).toBeGreaterThan(lastPosition);
    expect(player.getVideoLoadedTime()).toBeGreaterThan(0);
    expect(player.getVideoPlayedTime()).toBeGreaterThan(0);
    expect(player.getPlaybackRate()).toEqual(0.5);
    expect(player.getVideoElement().playbackRate).toEqual(0.5);
  });

  it("should play faster for a speed superior to 1", async function () {
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    player.setPlaybackRate(3);
    player.play();
    await sleep(400);
    expect(player.getPosition()).toBeLessThan(1.25);
    expect(player.getPosition()).toBeGreaterThan(0.5);
    expect(player.getVideoLoadedTime()).toBeGreaterThan(0);
    expect(player.getVideoPlayedTime()).toBeGreaterThan(0);
    expect(player.getPlaybackRate()).toEqual(3);
    expect(player.getVideoElement().playbackRate).toEqual(3);
  });

  it("should be able to seek when loaded", async function () {
    player.loadVideo({ transport: manifestInfos.transport,
                       url: manifestInfos.url });
    await waitForLoadedStateAfterLoadVideo(player);
    player.seekTo(10);
    expect(player.getPosition()).toEqual(10);
    expect(player.getPlayerState()).toEqual("LOADED");
    player.play();
    await sleep(1200);
    expect(player.getPlayerState()).toEqual("PLAYING");
    expect(player.getPosition()).toBeGreaterThan(10);
  });

  it("should end if seeking to the end when loaded", async function () {
    player.loadVideo({ transport: manifestInfos.transport,
                       url: manifestInfos.url });
    await waitForLoadedStateAfterLoadVideo(player);
    player.seekTo(player.getMaximumPosition() + 15);
    await sleep(600);
    // FIXME: Chrome seems to have an issue with that content where we need to
    // seek two times for this test to pass.
    if (player.getPlayerState() === "PAUSED") {
      player.seekTo(player.getMaximumPosition() + 15);
      await sleep(600);
    }
    expect(player.getPlayerState()).toEqual("ENDED");
  });

  it("should end if seeking to the end when playing", async function () {
    player.loadVideo({ transport: manifestInfos.transport,
                       url: manifestInfos.url,
                       autoPlay: true });
    await waitForLoadedStateAfterLoadVideo(player);
    player.seekTo(player.getMaximumPosition() + 15);
    await sleep(600);
    expect(player.getPlayerState()).toEqual("ENDED");
  });

  it("should seek to minimum position for negative positions when loaded", async function () {
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    player.seekTo(-2);
    expect(player.getPosition()).toEqual(player.getMinimumPosition());
    expect(player.getPlayerState()).toEqual("LOADED");
    player.play();
    await sleep(200);
    expect(player.getPlayerState()).toEqual("PLAYING");
    expect(player.getPosition()).toBeGreaterThan(player.getMinimumPosition());
  });

  it("should seek to maximum position if manual seek is higher than maximum when loaded", async function () {
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    player.seekTo(200);
    expect(player.getPlayerState()).toEqual("LOADED");
    expect(player.getPosition()).toEqual(player.getMaximumPosition());
  });

  it("should seek to minimum position for negative positions after playing", async function () {
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    player.play();
    await sleep(100);
    player.seekTo(-2);
    expect(player.getPosition()).toEqual(player.getMinimumPosition());
    expect(player.getPlayerState()).toEqual("PLAYING");
  });

  it("should seek to maximum position if manual seek is higher than maximum after playing", async function () {
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    expect(player.getPlayerState()).toEqual("LOADED");
    player.play();
    player.seekTo(200);
    expect(player.getPosition()).toEqual(player.getMaximumPosition());
  });

  it("should seek to minimum position for negative positions when paused", async function () {
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    player.play();
    await sleep(100);
    player.pause();
    await sleep(10);
    expect(player.getPlayerState()).toEqual("PAUSED");
    player.seekTo(-2);
    expect(player.getPosition()).toEqual(player.getMinimumPosition());
    expect(player.getPlayerState()).toEqual("PAUSED");
  });

  it("should seek to maximum position if manual seek is higher than maximum when paused", async function () {
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    expect(player.getPlayerState()).toEqual("LOADED");
    player.play();
    await sleep(100);
    player.pause();
    await sleep(10);
    expect(player.getPlayerState()).toEqual("PAUSED");
    player.seekTo(200);
    expect(player.getPosition()).toEqual(player.getMaximumPosition());
    expect(player.getPlayerState()).toEqual("PAUSED");
  });

  it("should download first segment when wanted buffer ahead is under first segment duration", async function () {
    xhrMock.lock();
    player.setWantedBufferAhead(2);
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });

    await sleep(1);
    expect(xhrMock.getLockedXHR().length).toEqual(1); // Manifest
    await xhrMock.flush();
    await sleep(1);
    expect(xhrMock.getLockedXHR().length).toEqual(2); // init segments
    await xhrMock.flush();
    await sleep(1);
    expect(xhrMock.getLockedXHR().length).toEqual(2); // first two segments
    await xhrMock.flush(); // first two segments
    await sleep(1);
    expect(xhrMock.getLockedXHR().length).toEqual(0); // nada
    expect(player.getVideoLoadedTime()).toBeGreaterThan(4);
    expect(player.getVideoLoadedTime()).toBeLessThan(5);
  });

  it("should download more than the first segment when wanted buffer ahead is over the first segment duration", async function () {
    xhrMock.lock();
    player.setWantedBufferAhead(20);
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });

    await sleep(1);
    expect(xhrMock.getLockedXHR().length).toEqual(1); // Manifest
    await xhrMock.flush();
    await sleep(1);
    expect(xhrMock.getLockedXHR().length).toEqual(2); // init segments
    await xhrMock.flush();
    await sleep(1);
    expect(xhrMock.getLockedXHR().length).toEqual(2); // first two segments
    await xhrMock.flush(); // first two segments
    await sleep(1);
    expect(xhrMock.getLockedXHR().length).toEqual(2); // still
    await xhrMock.flush();
    await sleep(1);
    expect(player.getVideoLoadedTime()).toBeGreaterThan(7);
    expect(player.getVideoLoadedTime()).toBeLessThan(9);
  });

  it("should continue downloading when seek to wanter buffer ahead", async function() {
    player.setWantedBufferAhead(2);
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    await sleep(100);
    const videoLoadedTime = player.getVideoLoadedTime();
    player.seekTo(videoLoadedTime);
    await sleep(100);
    expect(player.getVideoLoadedTime()).toBeGreaterThan(videoLoadedTime);
    player.play();
    await sleep(100);
    expect(player.getPlayerState()).toEqual("PLAYING");
  });

  it("should respect a set max buffer ahead", async function() {
    player.setWantedBufferAhead(5);
    player.setMaxBufferAhead(10);
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    await sleep(40);
    player.seekTo(10);
    await sleep(40);
    player.seekTo(0);
    await sleep(40);

    // The real limit is actually closer to the duration of a segment
    expect(Math.round(player.getVideoLoadedTime())).toBeLessThan(13);
  });

  it("should delete buffer behind", async function() {
    player.setMaxBufferAhead(30);
    player.setMaxBufferBehind(2);

    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    await sleep(200);

    player.seekTo(6);
    await sleep(100);

    expect(Math.round(player.getVideoElement().buffered.start(0))).toEqual(4);
  });

  it("should be in SEEKING state when seeking to a buffered part when playing", async function() {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 5000;
    player.setWantedBufferAhead(30);
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    player.play();
    await sleep(1000);
    expect(player.getPlayerState()).toEqual("PLAYING");
    expect(player.getVideoBufferGap()).toBeGreaterThan(10);

    player.seekTo(10);
    await waitForState(player, "SEEKING", ["PLAYING"]);
    expect(player.getVideoBufferGap()).toBeGreaterThan(10);
    await sleep(1000);
    expect(player.getVideoBufferGap()).toBeGreaterThan(10);
    expect(player.getPlayerState()).toEqual("PLAYING");
  });

  it("should be in SEEKING state when seeking to a non-buffered part when playing", async function() {

    player.setWantedBufferAhead(4);
    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
    });
    await waitForLoadedStateAfterLoadVideo(player);
    player.play();
    await sleep(100);
    expect(player.getPlayerState()).toEqual("PLAYING");

    xhrMock.lock();

    player.seekTo(10);
    await waitForState(player, "SEEKING", ["PLAYING"]);
    expect(player.getVideoBufferGap()).toEqual(Infinity);

    await sleep(100);
    expect(player.getPlayerState()).toEqual("SEEKING");
    expect(player.getVideoBufferGap()).toEqual(Infinity);

    await xhrMock.flush();
    await sleep(100);
    expect(player.getVideoBufferGap()).toBeGreaterThan(1);
    expect(player.getVideoBufferGap()).toBeLessThan(10);
    expect(player.getPlayerState()).toEqual("PLAYING");
  });
});
