import XHRMock from "../../utils/request_mock";
import sleep from "../../utils/sleep.js";

import RxPlayer from "../../../src";

import { manifestInfos } from "../../contents/DASH_dynamic_SegmentTimeline";

const MANIFEST_URL_INFOS = manifestInfos.url;

/**
 *  Workaround to provide a "real" sleep function, which does not depend on
 *  jasmine fakeTimers.
 *  Here, the environment's setTimeout function is stored before being stubed
 *  by jasmine, allowing to sleep the wanted time without waiting jasmine's
 *  clock to tick.
 *  @param {Number} [ms=0]
 *  @returns {Promise}
 */
const sleepWithoutJasmineStub = (function() {
  const timeoutFn = window.setTimeout;
  return function _nextTick(ms = 0) {
    return new Promise((res) => {
      timeoutFn(res, ms);
    });
  };
})();

/**
 * Test various cases of errors due to Manifest loading or parsing.
 */

describe("manifest error management", function () {
  let player;
  let xhrMock;

  beforeEach(() => {
    player = new RxPlayer();
    xhrMock = new XHRMock();
  });

  afterEach(() => {
    player.dispose();
    jasmine.clock().uninstall();
    xhrMock.restore();
  });

  it("should retry to download the manifest 5 times", async () => {
    const clock = jasmine.clock().install();
    xhrMock.respondTo(MANIFEST_URL_INFOS.url, [ 500, {
      "Content-Type": "text/plain"
    }, ""]);
    xhrMock.lock();

    player.loadVideo({
      url: manifestInfos.url,
      transport: manifestInfos.transport,
    });

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();

    clock.uninstall();

    await sleep(5);
    expect(player.getManifest()).toEqual(null);
    const error = player.getError();
    expect(error).not.toEqual(null);
    expect(error.type).toEqual(RxPlayer.ErrorTypes.NETWORK_ERROR);
    expect(error.code).toEqual(RxPlayer.ErrorCodes.PIPELINE_LOAD_ERROR);
  });

  it("should parse the manifest if it works the second time", async () => {
    const clock = jasmine.clock().install();

    xhrMock.respondTo(MANIFEST_URL_INFOS.url, [ 500, {
      "Content-Type": "text/plain"
    }, ""]);
    xhrMock.lock();

    player.loadVideo({
      url: manifestInfos.url,
      transport: manifestInfos.transport,
    });

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    xhrMock.restore();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);
    await sleepWithoutJasmineStub(50);

    clock.uninstall();

    await sleep(50);
    expect(player.getManifest()).not.toEqual(null);
    expect(typeof player.getManifest()).toEqual("object");
    expect(player.getError()).toEqual(null);
  });

  it("should parse the manifest if it works the third time", async () => {
    const clock = jasmine.clock().install();
    xhrMock.respondTo(MANIFEST_URL_INFOS.url, [ 500, {
      "Content-Type": "text/plain"
    }, ""]);
    xhrMock.lock();

    player.loadVideo({
      url: manifestInfos.url,
      transport: manifestInfos.transport,
    });

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    xhrMock.restore();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);
    await sleepWithoutJasmineStub(50);

    clock.uninstall();

    await sleep(5);
    expect(player.getManifest()).not.toEqual(null);
    expect(typeof player.getManifest()).toEqual("object");
    expect(player.getError()).toEqual(null);
  });

  it("should parse the manifest if it works the fourth time", async () => {
    const clock = jasmine.clock().install();
    xhrMock.respondTo(MANIFEST_URL_INFOS.url, [ 500, {
      "Content-Type": "text/plain"
    }, ""]);
    xhrMock.lock();

    player.loadVideo({
      url: manifestInfos.url,
      transport: manifestInfos.transport,
    });

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    xhrMock.restore();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);
    await sleepWithoutJasmineStub(50);

    clock.uninstall();

    await sleep(5);
    expect(player.getManifest()).not.toEqual(null);
    expect(typeof player.getManifest()).toEqual("object");
    expect(player.getError()).toEqual(null);
  });

  it("should parse the manifest if it works the fifth time", async () => {
    const clock = jasmine.clock().install();
    xhrMock.respondTo(MANIFEST_URL_INFOS.url, [ 500, {
      "Content-Type": "text/plain"
    }, ""]);
    xhrMock.lock();

    player.loadVideo({
      url: manifestInfos.url,
      transport: manifestInfos.transport,
    });

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    clock.tick(5000);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);

    await sleepWithoutJasmineStub(50);
    xhrMock.flush();
    xhrMock.restore();
    clock.tick(5000);

    expect(player.getError()).toEqual(null);
    await sleepWithoutJasmineStub(50);

    clock.uninstall();

    await sleep(5);
    expect(player.getManifest()).not.toEqual(null);
    expect(typeof player.getManifest()).toEqual("object");
    expect(player.getError()).toEqual(null);
  });
});
