import XHRMock from "../../utils/request_mock";
import RxPlayer from "../../../src";
import { manifestInfos } from "../../contents/DASH_dynamic_SegmentTemplate_Multi_Periods";

/**
 *  Workaround to provide a "real" sleep function, which does not depend on
 *  jasmine fakeTimers.
 *  Here, the environment's setTimeout function is stored before being stubed
 *  by jasmine, allowing to sleep the wanted time without waiting jasmine's
 *  clock to tick.
 *  @param {Number} [ms=0]
 *  @returns {Promise}
 */
const sleepWithoutjasmineStub = (function() {
  const timeoutFn = window.setTimeout;
  return function _nextTick(ms = 0) {
    return new Promise((res) => {
      timeoutFn(res, ms);
    });
  };
})();

describe("DASH live content multi-periods (SegmentTemplate)", function() {
  let player;
  let xhrMock;
  let clock;

  beforeEach(() => {
    player = new RxPlayer();
    xhrMock = new XHRMock();
    clock = jasmine.useFakeTimers((1567781280 + 500) * 1000);
  });

  afterEach(() => {
    player.dispose();
    xhrMock.restore();
    clock.restore();
  });

  it("should return correct maximum position", async () => {
    xhrMock.lock();

    player.loadVideo({
      url: manifestInfos.url,
      transport: manifestInfos.transport,
    });

    await sleepWithoutjasmineStub(1);
    expect(xhrMock.getLockedXHR().length).toEqual(1);
    await xhrMock.flush();
    await sleepWithoutjasmineStub(1);

    const manifest = player.getManifest();
    expect(manifest).not.toEqual(null);
    const { periods } = manifest;

    expect(periods.length).toEqual(3);
    const now = 1567781280 + 500;
    const maxPos = player.getMaximumPosition();
    expect(maxPos).toBeCloseTo(now, 2);
  });

  it("should return correct minimum position", async () => {
    xhrMock.lock();

    player.loadVideo({
      url: manifestInfos.url,
      transport: manifestInfos.transport,
    });

    await sleepWithoutjasmineStub(1);
    expect(xhrMock.getLockedXHR().length).toEqual(1);
    await xhrMock.flush();
    await sleepWithoutjasmineStub(1);

    const manifest = player.getManifest();
    expect(manifest).not.toEqual(null);
    const { periods } = manifest;

    expect(periods.length).toEqual(3);
    const now = 1567781280 + 500;
    const minPos = player.getMinimumPosition();
    expect(minPos).toBeCloseTo(now - manifestInfos.tsbd, 2);
  });

  it("should correclty parse manifest and periods boundaries", async () => {
    xhrMock.lock();

    player.loadVideo({
      url: manifestInfos.url,
      transport: manifestInfos.transport,
    });

    await sleepWithoutjasmineStub(1);
    expect(xhrMock.getLockedXHR().length).toEqual(1);
    await xhrMock.flush();
    await sleepWithoutjasmineStub(1);

    const manifest = player.getManifest();
    expect(manifest).not.toEqual(null);
    const { periods } = manifest;

    expect(periods[0].start).toEqual(1567780920);
    expect(periods[0].end).toEqual(1567781100);
    expect(periods[1].start).toEqual(1567781100);
    expect(periods[1].end).toEqual(1567781280);
    expect(periods[2].start).toEqual(1567781280);
    expect(periods[2].end).toEqual(undefined);
  });
});
