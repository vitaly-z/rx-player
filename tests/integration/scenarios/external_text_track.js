import RxPlayer from "../../../src";
import { manifestInfos } from "../../contents/DASH_static_SegmentTimeline";
import textTrackInfos from "../../contents/texttracks";
import { waitForLoadedStateAfterLoadVideo } from "../../utils/waitForPlayerState";

/**
 * Test ability to add an external text track when loading a video.
 */

describe("external text track", function () {
  let player;

  beforeEach(() => {
    player = new RxPlayer();
  });

  afterEach(() => {
    player.dispose();
  });

  it("should be able to add an external text track", async function () {

    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
      supplementaryTextTracks: {
        url: textTrackInfos.url,
        language: "en",
        closedCaption: false,
        mimeType: "text/vtt",
      },
    });

    await waitForLoadedStateAfterLoadVideo(player);

    const textTracks = player.getAvailableTextTracks();
    expect(textTracks.length).toEqual(1);
    expect(textTracks[0].language).toEqual("en");
    expect(textTracks[0].normalized).toEqual("eng");
    expect(textTracks[0].closedCaption).toEqual(false);
    expect(typeof textTracks[0].id).toEqual("string");
    expect(textTracks[0].id).not.toEqual("");
    expect(textTracks[0].active).toEqual(false);
  });

  it("should be able to add a closed caption text track", async function () {

    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
      supplementaryTextTracks: {
        url: textTrackInfos.url,
        language: "arm",
        closedCaption: true,
        mimeType: "text/vtt",
      },
    });

    await waitForLoadedStateAfterLoadVideo(player);

    const textTracks = player.getAvailableTextTracks();
    expect(textTracks.length).toEqual(1);
    expect(textTracks[0].language).toEqual("arm");
    expect(textTracks[0].normalized).toEqual("hye");
    expect(textTracks[0].closedCaption).toEqual(true);
    expect(typeof textTracks[0].id).toEqual("string");
    expect(textTracks[0].id).not.toEqual("");
    expect(textTracks[0].active).toEqual(false);

  });

  it("should be able to add multiple external text tracks", async function () {

    player.loadVideo({
      transport: manifestInfos.transport,
      url: manifestInfos.url,
      supplementaryTextTracks: [
        {
          url: textTrackInfos.url,
          language: "en",
          closedCaption: false,
          mimeType: "text/vtt",
        },
        {
          url: textTrackInfos.url,
          language: "fr",
          closedCaption: false,
          mimeType: "text/vtt",
        },
        {
          url: textTrackInfos.url,
          language: "ger",
          closedCaption: true,
          mimeType: "text/vtt",
        },
      ],
    });

    await waitForLoadedStateAfterLoadVideo(player);

    const textTracks = player.getAvailableTextTracks();
    expect(textTracks.length).toEqual(3);

    expect(textTracks[0].language).toEqual("en");
    expect(textTracks[0].normalized).toEqual("eng");
    expect(textTracks[0].closedCaption).toEqual(false);
    expect(typeof textTracks[0].id).toEqual("string");
    expect(textTracks[0].id).not.toEqual("");
    expect(textTracks[0].active).toEqual(false);

    expect(textTracks[1].language).toEqual("fr");
    expect(textTracks[1].normalized).toEqual("fra");
    expect(textTracks[1].closedCaption).toEqual(false);
    expect(typeof textTracks[1].id).toEqual("string");
    expect(textTracks[1].id).not.toEqual("");
    expect(textTracks[1].active).toEqual(false);

    expect(textTracks[2].language).toEqual("ger");
    expect(textTracks[2].normalized).toEqual("deu");
    expect(textTracks[2].closedCaption).toEqual(true);
    expect(typeof textTracks[2].id).toEqual("string");
    expect(textTracks[2].id).not.toEqual("");
    expect(textTracks[2].active).toEqual(false);
  });

  it("should switch initially to external text track if set as default language", async function () {

    const waysOfWritingDefaultTextTrack = [
      "en",
      "eng",
      { language: "en" },
      { language: "eng" },
      { language: "en", closedCaption: false },
      { language: "eng", closedCaption: false },
    ];

    for (const defaultTextTrack of waysOfWritingDefaultTextTrack) {
      player.loadVideo({
        transport: manifestInfos.transport,
        url: manifestInfos.url,
        supplementaryTextTracks: {
          url: textTrackInfos.url,
          language: "en",
          closedCaption: false,
          mimeType: "text/vtt",
        },
        defaultTextTrack,
      });

      await waitForLoadedStateAfterLoadVideo(player);

      const textTracks1 = player.getAvailableTextTracks();
      expect(textTracks1[0].active).toEqual(true);

      player.loadVideo({
        transport: manifestInfos.transport,
        url: manifestInfos.url,
        supplementaryTextTracks: [
          {
            url: textTrackInfos.url,
            language: "en",
            closedCaption: false,
            mimeType: "text/vtt",
          },
          {
            url: textTrackInfos.url,
            language: "fr",
            closedCaption: false,
            mimeType: "text/vtt",
          },
          {
            url: textTrackInfos.url,
            language: "ger",
            closedCaption: true,
            mimeType: "text/vtt",
          },
        ],
        defaultTextTrack,
      });

      await waitForLoadedStateAfterLoadVideo(player);

      const textTracks2 = player.getAvailableTextTracks();
      expect(textTracks2[0].active).toEqual(true);
    }
  });

  it("should switch initially to a closed caption external text track if set as default language", async function () {

    const waysOfWritingDefaultTextTrack = [
      { language: "en", closedCaption: true },
      { language: "eng", closedCaption: true },
    ];

    for (const defaultTextTrack of waysOfWritingDefaultTextTrack) {
      player.loadVideo({
        transport: manifestInfos.transport,
        url: manifestInfos.url,
        supplementaryTextTracks: {
          url: textTrackInfos.url,
          language: "en",
          closedCaption: true,
          mimeType: "text/vtt",
        },
        defaultTextTrack,
      });

      await waitForLoadedStateAfterLoadVideo(player);

      const textTracks1 = player.getAvailableTextTracks();
      expect(textTracks1[0].active).toEqual(true);

      player.loadVideo({
        transport: manifestInfos.transport,
        url: manifestInfos.url,
        supplementaryTextTracks: [
          {
            url: textTrackInfos.url,
            language: "en",
            closedCaption: true,
            mimeType: "text/vtt",
          },
          {
            url: textTrackInfos.url,
            language: "fr",
            closedCaption: false,
            mimeType: "text/vtt",
          },
          {
            url: textTrackInfos.url,
            language: "ger",
            closedCaption: true,
            mimeType: "text/vtt",
          },
        ],
        defaultTextTrack,
      });


      await waitForLoadedStateAfterLoadVideo(player);

      const textTracks2 = player.getAvailableTextTracks();
      expect(textTracks2[0].active).toEqual(true);
    }
  });

  it("should not switch initially to external text track if not set as default language", async function () {

    const waysOfWritingDefaultTextTrack = [
      "fr",
      undefined,
      null,
      { language: "english" },
      { language: "en", closedCaption: true },
      { language: "eng", closedCaption: true },
    ];

    for (const defaultTextTrack of waysOfWritingDefaultTextTrack) {
      player.loadVideo({
        transport: manifestInfos.transport,
        url: manifestInfos.url,
        supplementaryTextTracks: {
          url: textTrackInfos.url,
          language: "en",
          closedCaption: false,
          mimeType: "text/vtt",
        },
        defaultTextTrack,
      });

      await waitForLoadedStateAfterLoadVideo(player);

      const textTracks1 = player.getAvailableTextTracks();
      expect(textTracks1[0].active).toEqual(false);

      player.loadVideo({
        transport: manifestInfos.transport,
        url: manifestInfos.url,
        supplementaryTextTracks: [
          {
            url: textTrackInfos.url,
            language: "en",
            closedCaption: false,
            mimeType: "text/vtt",
          },
          {
            url: textTrackInfos.url,
            language: "fr",
            closedCaption: false,
            mimeType: "text/vtt",
          },
          {
            url: textTrackInfos.url,
            language: "ger",
            closedCaption: true,
            mimeType: "text/vtt",
          },
        ],
        defaultTextTrack,
      });

      await waitForLoadedStateAfterLoadVideo(player);

      const textTracks2 = player.getAvailableTextTracks();
      expect(textTracks2[0].active).toEqual(false);
    }
  });
});
