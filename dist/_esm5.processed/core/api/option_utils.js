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
/**
 * This file exports various helpers to parse options given to various APIs,
 * throw if something is wrong, and return a normalized option object.
 */
import config from "../../config";
import log from "../../log";
import arrayIncludes from "../../utils/array_includes";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import { normalizeAudioTrack, normalizeTextTrack, } from "../../utils/languages";
import objectAssign from "../../utils/object_assign";
import warnOnce from "../../utils/warn_once";
/**
 * Parse options given to the API constructor and set default options as found
 * in the config.
 *
 * Do not mutate anything, only cross the given options and sane default options
 * (most coming from the config).
 * @param {Object|undefined} options
 * @returns {Object}
 */
function parseConstructorOptions(options) {
    var maxBufferAhead;
    var maxBufferBehind;
    var wantedBufferAhead;
    var maxVideoBufferSize;
    var throttleWhenHidden;
    var throttleVideoBitrateWhenHidden;
    var preferredAudioTracks;
    var preferredTextTracks;
    var preferredVideoTracks;
    var videoElement;
    var initialVideoBitrate;
    var initialAudioBitrate;
    var minAudioBitrate;
    var minVideoBitrate;
    var maxAudioBitrate;
    var maxVideoBitrate;
    var _a = config.getCurrent(), DEFAULT_INITIAL_BITRATES = _a.DEFAULT_INITIAL_BITRATES, DEFAULT_LIMIT_VIDEO_WIDTH = _a.DEFAULT_LIMIT_VIDEO_WIDTH, DEFAULT_MIN_BITRATES = _a.DEFAULT_MIN_BITRATES, DEFAULT_MAX_BITRATES = _a.DEFAULT_MAX_BITRATES, DEFAULT_MAX_BUFFER_AHEAD = _a.DEFAULT_MAX_BUFFER_AHEAD, DEFAULT_MAX_BUFFER_BEHIND = _a.DEFAULT_MAX_BUFFER_BEHIND, DEFAULT_MAX_VIDEO_BUFFER_SIZE = _a.DEFAULT_MAX_VIDEO_BUFFER_SIZE, DEFAULT_STOP_AT_END = _a.DEFAULT_STOP_AT_END, DEFAULT_THROTTLE_WHEN_HIDDEN = _a.DEFAULT_THROTTLE_WHEN_HIDDEN, DEFAULT_THROTTLE_VIDEO_BITRATE_WHEN_HIDDEN = _a.DEFAULT_THROTTLE_VIDEO_BITRATE_WHEN_HIDDEN, DEFAULT_WANTED_BUFFER_AHEAD = _a.DEFAULT_WANTED_BUFFER_AHEAD;
    if (isNullOrUndefined(options.maxBufferAhead)) {
        maxBufferAhead = DEFAULT_MAX_BUFFER_AHEAD;
    }
    else {
        maxBufferAhead = Number(options.maxBufferAhead);
        if (isNaN(maxBufferAhead)) {
            throw new Error("Invalid maxBufferAhead parameter. Should be a number.");
        }
    }
    if (isNullOrUndefined(options.maxBufferBehind)) {
        maxBufferBehind = DEFAULT_MAX_BUFFER_BEHIND;
    }
    else {
        maxBufferBehind = Number(options.maxBufferBehind);
        if (isNaN(maxBufferBehind)) {
            throw new Error("Invalid maxBufferBehind parameter. Should be a number.");
        }
    }
    if (isNullOrUndefined(options.wantedBufferAhead)) {
        wantedBufferAhead = DEFAULT_WANTED_BUFFER_AHEAD;
    }
    else {
        wantedBufferAhead = Number(options.wantedBufferAhead);
        if (isNaN(wantedBufferAhead)) {
            /* eslint-disable max-len */
            throw new Error("Invalid wantedBufferAhead parameter. Should be a number.");
            /* eslint-enable max-len */
        }
    }
    if (isNullOrUndefined(options.maxVideoBufferSize)) {
        maxVideoBufferSize = DEFAULT_MAX_VIDEO_BUFFER_SIZE;
    }
    else {
        maxVideoBufferSize = Number(options.maxVideoBufferSize);
        if (isNaN(maxVideoBufferSize)) {
            /* eslint-disable max-len */
            throw new Error("Invalid maxVideoBufferSize parameter. Should be a number.");
            /* eslint-enable max-len */
        }
    }
    var limitVideoWidth = isNullOrUndefined(options.limitVideoWidth) ?
        DEFAULT_LIMIT_VIDEO_WIDTH :
        !!options.limitVideoWidth;
    if (!isNullOrUndefined(options.throttleWhenHidden)) {
        warnOnce("`throttleWhenHidden` API is deprecated. Consider using " +
            "`throttleVideoBitrateWhenHidden` instead.");
        throttleWhenHidden = !!options.throttleWhenHidden;
    }
    else {
        throttleWhenHidden = DEFAULT_THROTTLE_WHEN_HIDDEN;
    }
    // `throttleWhenHidden` and `throttleVideoBitrateWhenHidden` can be in conflict
    // Do not activate the latter if the former is
    if (throttleWhenHidden) {
        throttleVideoBitrateWhenHidden = false;
    }
    else {
        throttleVideoBitrateWhenHidden =
            isNullOrUndefined(options.throttleVideoBitrateWhenHidden) ?
                DEFAULT_THROTTLE_VIDEO_BITRATE_WHEN_HIDDEN :
                !!options.throttleVideoBitrateWhenHidden;
    }
    if (options.preferredTextTracks !== undefined) {
        if (!Array.isArray(options.preferredTextTracks)) {
            warnOnce("Invalid `preferredTextTracks` option, it should be an Array");
            preferredTextTracks = [];
        }
        else {
            preferredTextTracks = options.preferredTextTracks;
        }
    }
    else {
        preferredTextTracks = [];
    }
    if (options.preferredAudioTracks !== undefined) {
        if (!Array.isArray(options.preferredAudioTracks)) {
            warnOnce("Invalid `preferredAudioTracks` option, it should be an Array");
            preferredAudioTracks = [];
        }
        else {
            preferredAudioTracks = options.preferredAudioTracks;
        }
    }
    else {
        preferredAudioTracks = [];
    }
    if (options.preferredVideoTracks !== undefined) {
        if (!Array.isArray(options.preferredVideoTracks)) {
            warnOnce("Invalid `preferredVideoTracks` option, it should be an Array");
            preferredVideoTracks = [];
        }
        else {
            preferredVideoTracks = options.preferredVideoTracks;
        }
    }
    else {
        preferredVideoTracks = [];
    }
    if (isNullOrUndefined(options.videoElement)) {
        videoElement = document.createElement("video");
    }
    else if (options.videoElement instanceof HTMLMediaElement) {
        videoElement = options.videoElement;
    }
    else {
        /* eslint-disable max-len */
        throw new Error("Invalid videoElement parameter. Should be a HTMLMediaElement.");
        /* eslint-enable max-len */
    }
    if (isNullOrUndefined(options.initialVideoBitrate)) {
        initialVideoBitrate = DEFAULT_INITIAL_BITRATES.video;
    }
    else {
        initialVideoBitrate = Number(options.initialVideoBitrate);
        if (isNaN(initialVideoBitrate)) {
            /* eslint-disable max-len */
            throw new Error("Invalid initialVideoBitrate parameter. Should be a number.");
            /* eslint-enable max-len */
        }
    }
    if (isNullOrUndefined(options.initialAudioBitrate)) {
        initialAudioBitrate = DEFAULT_INITIAL_BITRATES.audio;
    }
    else {
        initialAudioBitrate = Number(options.initialAudioBitrate);
        if (isNaN(initialAudioBitrate)) {
            /* eslint-disable max-len */
            throw new Error("Invalid initialAudioBitrate parameter. Should be a number.");
            /* eslint-enable max-len */
        }
    }
    if (isNullOrUndefined(options.minVideoBitrate)) {
        minVideoBitrate = DEFAULT_MIN_BITRATES.video;
    }
    else {
        minVideoBitrate = Number(options.minVideoBitrate);
        if (isNaN(minVideoBitrate)) {
            throw new Error("Invalid maxVideoBitrate parameter. Should be a number.");
        }
    }
    if (isNullOrUndefined(options.minAudioBitrate)) {
        minAudioBitrate = DEFAULT_MIN_BITRATES.audio;
    }
    else {
        minAudioBitrate = Number(options.minAudioBitrate);
        if (isNaN(minAudioBitrate)) {
            throw new Error("Invalid minAudioBitrate parameter. Should be a number.");
        }
    }
    if (isNullOrUndefined(options.maxVideoBitrate)) {
        maxVideoBitrate = DEFAULT_MAX_BITRATES.video;
    }
    else {
        maxVideoBitrate = Number(options.maxVideoBitrate);
        if (isNaN(maxVideoBitrate)) {
            throw new Error("Invalid maxVideoBitrate parameter. Should be a number.");
        }
        else if (minVideoBitrate > maxVideoBitrate) {
            throw new Error("Invalid maxVideoBitrate parameter. Its value, \"" +
                "".concat(maxVideoBitrate, "\", is inferior to the set minVideoBitrate, \"") +
                "".concat(minVideoBitrate, "\""));
        }
    }
    if (isNullOrUndefined(options.maxAudioBitrate)) {
        maxAudioBitrate = DEFAULT_MAX_BITRATES.audio;
    }
    else {
        maxAudioBitrate = Number(options.maxAudioBitrate);
        if (isNaN(maxAudioBitrate)) {
            throw new Error("Invalid maxAudioBitrate parameter. Should be a number.");
        }
        else if (minAudioBitrate > maxAudioBitrate) {
            throw new Error("Invalid maxAudioBitrate parameter. Its value, \"" +
                "".concat(maxAudioBitrate, "\", is inferior to the set minAudioBitrate, \"") +
                "".concat(minAudioBitrate, "\""));
        }
    }
    var stopAtEnd = isNullOrUndefined(options.stopAtEnd) ? DEFAULT_STOP_AT_END :
        !!options.stopAtEnd;
    return { maxBufferAhead: maxBufferAhead, maxBufferBehind: maxBufferBehind, limitVideoWidth: limitVideoWidth, videoElement: videoElement, wantedBufferAhead: wantedBufferAhead, maxVideoBufferSize: maxVideoBufferSize, throttleWhenHidden: throttleWhenHidden, throttleVideoBitrateWhenHidden: throttleVideoBitrateWhenHidden, preferredAudioTracks: preferredAudioTracks, preferredTextTracks: preferredTextTracks, preferredVideoTracks: preferredVideoTracks, initialAudioBitrate: initialAudioBitrate, initialVideoBitrate: initialVideoBitrate, minAudioBitrate: minAudioBitrate, minVideoBitrate: minVideoBitrate, maxAudioBitrate: maxAudioBitrate, maxVideoBitrate: maxVideoBitrate, stopAtEnd: stopAtEnd };
}
/**
 * Check the format of given reload options.
 * Throw if format in invalid.
 * @param {object | undefined} options
 */
function checkReloadOptions(options) {
    var _a, _b, _c, _d;
    if (options === null ||
        (typeof options !== "object" && options !== undefined)) {
        throw new Error("API: reload - Invalid options format.");
    }
    if ((options === null || options === void 0 ? void 0 : options.reloadAt) === null ||
        (typeof (options === null || options === void 0 ? void 0 : options.reloadAt) !== "object" && (options === null || options === void 0 ? void 0 : options.reloadAt) !== undefined)) {
        throw new Error("API: reload - Invalid 'reloadAt' option format.");
    }
    if (typeof ((_a = options === null || options === void 0 ? void 0 : options.reloadAt) === null || _a === void 0 ? void 0 : _a.position) !== "number" &&
        ((_b = options === null || options === void 0 ? void 0 : options.reloadAt) === null || _b === void 0 ? void 0 : _b.position) !== undefined) {
        throw new Error("API: reload - Invalid 'reloadAt.position' option format.");
    }
    if (typeof ((_c = options === null || options === void 0 ? void 0 : options.reloadAt) === null || _c === void 0 ? void 0 : _c.relative) !== "number" &&
        ((_d = options === null || options === void 0 ? void 0 : options.reloadAt) === null || _d === void 0 ? void 0 : _d.relative) !== undefined) {
        throw new Error("API: reload - Invalid 'reloadAt.relative' option format.");
    }
}
/**
 * Parse options given to loadVideo and set default options as found
 * in the config.
 *
 * Do not mutate anything, only cross the given options and sane default options
 * (most coming from the config).
 *
 * Throws if any mandatory option is not set.
 * @param {Object|undefined} options
 * @param {Object} ctx - The player context, needed for some default values.
 * @returns {Object}
 */
function parseLoadVideoOptions(options) {
    var _a, _b, _c, _d, _e, _f;
    var url;
    var transport;
    var keySystems;
    var textTrackMode;
    var textTrackElement;
    var startAt;
    var _g = config.getCurrent(), DEFAULT_AUDIO_TRACK_SWITCHING_MODE = _g.DEFAULT_AUDIO_TRACK_SWITCHING_MODE, DEFAULT_AUTO_PLAY = _g.DEFAULT_AUTO_PLAY, DEFAULT_CODEC_SWITCHING_BEHAVIOR = _g.DEFAULT_CODEC_SWITCHING_BEHAVIOR, DEFAULT_ENABLE_FAST_SWITCHING = _g.DEFAULT_ENABLE_FAST_SWITCHING, DEFAULT_MANUAL_BITRATE_SWITCHING_MODE = _g.DEFAULT_MANUAL_BITRATE_SWITCHING_MODE, DEFAULT_SHOW_NATIVE_SUBTITLE = _g.DEFAULT_SHOW_NATIVE_SUBTITLE, DEFAULT_TEXT_TRACK_MODE = _g.DEFAULT_TEXT_TRACK_MODE;
    if (isNullOrUndefined(options)) {
        throw new Error("No option set on loadVideo");
    }
    if (!isNullOrUndefined(options.url)) {
        url = String(options.url);
    }
    else if (isNullOrUndefined((_a = options.transportOptions) === null || _a === void 0 ? void 0 : _a.initialManifest) &&
        isNullOrUndefined((_b = options.transportOptions) === null || _b === void 0 ? void 0 : _b.manifestLoader)) {
        throw new Error("Unable to load a content: no url set on loadVideo.\n" +
            "Please provide at least either an `url` argument, a " +
            "`transportOptions.initialManifest` option or a " +
            "`transportOptions.manifestLoader` option so the RxPlayer " +
            "can load the content.");
    }
    if (isNullOrUndefined(options.transport)) {
        throw new Error("No transport set on loadVideo");
    }
    else {
        transport = String(options.transport);
    }
    var autoPlay = isNullOrUndefined(options.autoPlay) ? DEFAULT_AUTO_PLAY :
        !!options.autoPlay;
    if (isNullOrUndefined(options.keySystems)) {
        keySystems = [];
    }
    else {
        keySystems = Array.isArray(options.keySystems) ? options.keySystems :
            [options.keySystems];
        for (var _i = 0, keySystems_1 = keySystems; _i < keySystems_1.length; _i++) {
            var keySystem = keySystems_1[_i];
            if (typeof keySystem.type !== "string" ||
                typeof keySystem.getLicense !== "function") {
                throw new Error("Invalid key system given: Missing type string or " +
                    "getLicense callback");
            }
        }
    }
    var lowLatencyMode = options.lowLatencyMode === undefined ?
        false :
        !!options.lowLatencyMode;
    var transportOptsArg = typeof options.transportOptions === "object" &&
        options.transportOptions !== null ?
        options.transportOptions :
        {};
    var initialManifest = (_c = options.transportOptions) === null || _c === void 0 ? void 0 : _c.initialManifest;
    var minimumManifestUpdateInterval = (_e = (_d = options.transportOptions) === null || _d === void 0 ? void 0 : _d.minimumManifestUpdateInterval) !== null && _e !== void 0 ? _e : 0;
    var audioTrackSwitchingMode = isNullOrUndefined(options.audioTrackSwitchingMode)
        ? DEFAULT_AUDIO_TRACK_SWITCHING_MODE
        : options.audioTrackSwitchingMode;
    if (!arrayIncludes(["seamless", "direct", "reload"], audioTrackSwitchingMode)) {
        log.warn("The `audioTrackSwitchingMode` loadVideo option must match one of " +
            "the following strategy name:\n" +
            "- `seamless`\n" +
            "- `direct`\n" +
            "- `reload`\n" +
            "If badly set, " + DEFAULT_AUDIO_TRACK_SWITCHING_MODE +
            " strategy will be used as default");
        audioTrackSwitchingMode = DEFAULT_AUDIO_TRACK_SWITCHING_MODE;
    }
    var onCodecSwitch = isNullOrUndefined(options.onCodecSwitch)
        ? DEFAULT_CODEC_SWITCHING_BEHAVIOR
        : options.onCodecSwitch;
    if (!arrayIncludes(["continue", "reload"], onCodecSwitch)) {
        log.warn("The `onCodecSwitch` loadVideo option must match one of " +
            "the following string:\n" +
            "- `continue`\n" +
            "- `reload`\n" +
            "If badly set, " + DEFAULT_CODEC_SWITCHING_BEHAVIOR +
            " will be used as default");
        onCodecSwitch = DEFAULT_CODEC_SWITCHING_BEHAVIOR;
    }
    var transportOptions = objectAssign({}, transportOptsArg, {
        /* eslint-disable import/no-deprecated */
        supplementaryImageTracks: [],
        supplementaryTextTracks: [],
        /* eslint-enable import/no-deprecated */
        lowLatencyMode: lowLatencyMode,
    });
    // remove already parsed data to simplify the `transportOptions` object
    delete transportOptions.initialManifest;
    delete transportOptions.minimumManifestUpdateInterval;
    if (options.supplementaryTextTracks !== undefined) {
        warnOnce("The `supplementaryTextTracks` loadVideo option is deprecated.\n" +
            "Please use the `TextTrackRenderer` tool instead.");
        var supplementaryTextTracks = Array.isArray(options.supplementaryTextTracks) ?
            options.supplementaryTextTracks : [options.supplementaryTextTracks];
        for (var _h = 0, supplementaryTextTracks_1 = supplementaryTextTracks; _h < supplementaryTextTracks_1.length; _h++) {
            var supplementaryTextTrack = supplementaryTextTracks_1[_h];
            if (typeof supplementaryTextTrack.language !== "string" ||
                typeof supplementaryTextTrack.mimeType !== "string" ||
                typeof supplementaryTextTrack.url !== "string") {
                throw new Error("Invalid supplementary text track given. " +
                    "Missing either language, mimetype or url");
            }
        }
        transportOptions.supplementaryTextTracks = supplementaryTextTracks;
    }
    if (options.supplementaryImageTracks !== undefined) {
        warnOnce("The `supplementaryImageTracks` loadVideo option is deprecated.\n" +
            "Please use the `parseBifThumbnails` tool instead.");
        var supplementaryImageTracks = Array.isArray(options.supplementaryImageTracks) ?
            options.supplementaryImageTracks : [options.supplementaryImageTracks];
        for (var _j = 0, supplementaryImageTracks_1 = supplementaryImageTracks; _j < supplementaryImageTracks_1.length; _j++) {
            var supplementaryImageTrack = supplementaryImageTracks_1[_j];
            if (typeof supplementaryImageTrack.mimeType !== "string" ||
                typeof supplementaryImageTrack.url !== "string") {
                throw new Error("Invalid supplementary image track given. " +
                    "Missing either mimetype or url");
            }
        }
        transportOptions.supplementaryImageTracks = supplementaryImageTracks;
    }
    if (isNullOrUndefined(options.textTrackMode)) {
        textTrackMode = DEFAULT_TEXT_TRACK_MODE;
    }
    else {
        if (options.textTrackMode !== "native" && options.textTrackMode !== "html") {
            throw new Error("Invalid textTrackMode.");
        }
        textTrackMode = options.textTrackMode;
    }
    if (!isNullOrUndefined(options.defaultAudioTrack)) {
        warnOnce("The `defaultAudioTrack` loadVideo option is deprecated.\n" +
            "Please use the `preferredAudioTracks` constructor option or the" +
            "`setPreferredAudioTracks` method instead");
    }
    var defaultAudioTrack = normalizeAudioTrack(options.defaultAudioTrack);
    if (!isNullOrUndefined(options.defaultTextTrack)) {
        warnOnce("The `defaultTextTrack` loadVideo option is deprecated.\n" +
            "Please use the `preferredTextTracks` constructor option or the" +
            "`setPreferredTextTracks` method instead");
    }
    var defaultTextTrack = normalizeTextTrack(options.defaultTextTrack);
    var hideNativeSubtitle = !DEFAULT_SHOW_NATIVE_SUBTITLE;
    if (!isNullOrUndefined(options.hideNativeSubtitle)) {
        warnOnce("The `hideNativeSubtitle` loadVideo option is deprecated");
        hideNativeSubtitle = !!options.hideNativeSubtitle;
    }
    var manualBitrateSwitchingMode = (_f = options.manualBitrateSwitchingMode) !== null && _f !== void 0 ? _f : DEFAULT_MANUAL_BITRATE_SWITCHING_MODE;
    var enableFastSwitching = isNullOrUndefined(options.enableFastSwitching) ?
        DEFAULT_ENABLE_FAST_SWITCHING :
        options.enableFastSwitching;
    if (textTrackMode === "html") {
        // TODO Better way to express that in TypeScript?
        if (isNullOrUndefined(options.textTrackElement)) {
            throw new Error("You have to provide a textTrackElement " +
                "in \"html\" textTrackMode.");
        }
        else if (!(options.textTrackElement instanceof HTMLElement)) {
            throw new Error("textTrackElement should be an HTMLElement.");
        }
        else {
            textTrackElement = options.textTrackElement;
        }
    }
    else if (!isNullOrUndefined(options.textTrackElement)) {
        log.warn("API: You have set a textTrackElement without being in " +
            "an \"html\" textTrackMode. It will be ignored.");
    }
    if (!isNullOrUndefined(options.startAt)) {
        // TODO Better way to express that in TypeScript?
        if (options.startAt.wallClockTime
            instanceof Date) {
            var wallClockTime = options.startAt
                .wallClockTime.getTime() / 1000;
            startAt = objectAssign({}, options.startAt, { wallClockTime: wallClockTime });
        }
        else {
            startAt = options.startAt;
        }
    }
    var networkConfig = isNullOrUndefined(options.networkConfig) ?
        {} :
        { manifestRetry: options.networkConfig.manifestRetry,
            offlineRetry: options.networkConfig.offlineRetry,
            segmentRetry: options.networkConfig.segmentRetry };
    // TODO without cast
    /* eslint-disable @typescript-eslint/consistent-type-assertions */
    return { autoPlay: autoPlay, defaultAudioTrack: defaultAudioTrack, defaultTextTrack: defaultTextTrack, enableFastSwitching: enableFastSwitching, hideNativeSubtitle: hideNativeSubtitle, keySystems: keySystems, initialManifest: initialManifest, lowLatencyMode: lowLatencyMode, manualBitrateSwitchingMode: manualBitrateSwitchingMode, audioTrackSwitchingMode: audioTrackSwitchingMode, minimumManifestUpdateInterval: minimumManifestUpdateInterval, networkConfig: networkConfig, onCodecSwitch: onCodecSwitch, startAt: startAt, textTrackElement: textTrackElement, textTrackMode: textTrackMode, transport: transport, transportOptions: transportOptions, url: url };
    /* eslint-enable @typescript-eslint/consistent-type-assertions */
}
export { checkReloadOptions, parseConstructorOptions, parseLoadVideoOptions, };
