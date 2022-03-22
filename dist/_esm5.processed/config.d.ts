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
import { IDefaultConfig } from "./default_config";
declare class ConfigHandler {
    _config: {
        DEFAULT_UNMUTED_VOLUME: number;
        DEFAULT_REQUEST_TIMEOUT: number;
        DEFAULT_TEXT_TRACK_MODE: "native" | "html";
        DEFAULT_MANUAL_BITRATE_SWITCHING_MODE: "direct" | "seamless";
        DEFAULT_ENABLE_FAST_SWITCHING: boolean;
        DEFAULT_AUDIO_TRACK_SWITCHING_MODE: "direct" | "seamless";
        DELTA_POSITION_AFTER_RELOAD: {
            bitrateSwitch: number;
            trackSwitch: {
                audio: number;
                video: number;
                other: number;
            };
        };
        DEFAULT_CODEC_SWITCHING_BEHAVIOR: "reload" | "continue";
        DEFAULT_AUTO_PLAY: boolean;
        DEFAULT_SHOW_NATIVE_SUBTITLE: boolean;
        DEFAULT_STOP_AT_END: boolean;
        DEFAULT_WANTED_BUFFER_AHEAD: number;
        DEFAULT_MAX_BUFFER_AHEAD: number;
        DEFAULT_MAX_BUFFER_BEHIND: number;
        DEFAULT_MAX_VIDEO_BUFFER_SIZE: number;
        MAXIMUM_MAX_BUFFER_AHEAD: Partial<Record<"audio" | "video" | "image" | "text", number>>;
        MAXIMUM_MAX_BUFFER_BEHIND: Partial<Record<"audio" | "video" | "image" | "text", number>>;
        DEFAULT_INITIAL_BITRATES: {
            audio: number;
            video: number;
            other: number;
        };
        DEFAULT_MIN_BITRATES: Record<"audio" | "video" | "other", number>;
        DEFAULT_MAX_BITRATES: Record<"audio" | "video" | "other", number>;
        INACTIVITY_DELAY: number;
        DEFAULT_THROTTLE_WHEN_HIDDEN: boolean;
        DEFAULT_THROTTLE_VIDEO_BITRATE_WHEN_HIDDEN: boolean;
        DEFAULT_LIMIT_VIDEO_WIDTH: boolean;
        DEFAULT_LIVE_GAP: {
            DEFAULT: number;
            LOW_LATENCY: number;
        };
        BUFFER_DISCONTINUITY_THRESHOLD: number;
        FORCE_DISCONTINUITY_SEEK_DELAY: number;
        BITRATE_REBUFFERING_RATIO: number;
        BUFFER_GC_GAPS: {
            CALM: number;
            BEEFY: number;
        };
        DEFAULT_MAX_MANIFEST_REQUEST_RETRY: number;
        DEFAULT_MAX_REQUESTS_RETRY_ON_ERROR: number;
        DEFAULT_MAX_REQUESTS_RETRY_ON_OFFLINE: number;
        INITIAL_BACKOFF_DELAY_BASE: {
            REGULAR: number;
            LOW_LATENCY: number;
        };
        MAX_BACKOFF_DELAY_BASE: {
            REGULAR: number;
            LOW_LATENCY: number;
        };
        SAMPLING_INTERVAL_MEDIASOURCE: number;
        SAMPLING_INTERVAL_LOW_LATENCY: number;
        SAMPLING_INTERVAL_NO_MEDIASOURCE: number;
        ABR_MINIMUM_TOTAL_BYTES: number;
        ABR_MINIMUM_CHUNK_SIZE: number;
        ABR_STARVATION_FACTOR: {
            DEFAULT: number;
            LOW_LATENCY: number;
        };
        ABR_REGULAR_FACTOR: {
            DEFAULT: number;
            LOW_LATENCY: number;
        };
        ABR_STARVATION_GAP: {
            DEFAULT: number;
            LOW_LATENCY: number;
        };
        OUT_OF_STARVATION_GAP: {
            DEFAULT: number;
            LOW_LATENCY: number;
        };
        ABR_STARVATION_DURATION_DELTA: number;
        ABR_FAST_EMA: number;
        ABR_SLOW_EMA: number;
        RESUME_GAP_AFTER_SEEKING: {
            DEFAULT: number;
            LOW_LATENCY: number;
        };
        RESUME_GAP_AFTER_NOT_ENOUGH_DATA: {
            DEFAULT: number;
            LOW_LATENCY: number;
        };
        RESUME_GAP_AFTER_BUFFERING: {
            DEFAULT: number;
            LOW_LATENCY: number;
        };
        REBUFFERING_GAP: {
            DEFAULT: number;
            LOW_LATENCY: number;
        };
        MINIMUM_BUFFER_AMOUNT_BEFORE_FREEZING: number;
        UNFREEZING_SEEK_DELAY: number;
        FREEZING_STALLED_DELAY: number;
        UNFREEZING_DELTA_POSITION: number;
        MAX_TIME_MISSING_FROM_COMPLETE_SEGMENT: number;
        MAX_MANIFEST_BUFFERED_START_END_DIFFERENCE: number;
        MAX_MANIFEST_BUFFERED_DURATION_DIFFERENCE: number;
        MINIMUM_SEGMENT_SIZE: number;
        APPEND_WINDOW_SECURITIES: {
            START: number;
            END: number;
        };
        MAXIMUM_HTML_TEXT_TRACK_UPDATE_INTERVAL: number;
        TEXT_TRACK_SIZE_CHECKS_INTERVAL: number;
        BUFFER_PADDING: {
            audio: number;
            video: number;
            other: number;
        };
        SEGMENT_PRIORITIES_STEPS: number[];
        MAX_HIGH_PRIORITY_LEVEL: number;
        MIN_CANCELABLE_PRIORITY: number;
        EME_DEFAULT_WIDEVINE_ROBUSTNESSES: string[];
        EME_KEY_SYSTEMS: Partial<Record<string, string[]>>;
        MAX_CONSECUTIVE_MANIFEST_PARSING_IN_UNSAFE_MODE: number;
        MIN_MANIFEST_PARSING_TIME_TO_ENTER_UNSAFE_MODE: number;
        MIN_DASH_S_ELEMENTS_TO_PARSE_UNSAFELY: number;
        OUT_OF_SYNC_MANIFEST_REFRESH_DELAY: number;
        FAILED_PARTIAL_UPDATE_MANIFEST_REFRESH_DELAY: number;
        DASH_FALLBACK_LIFETIME_WHEN_MINIMUM_UPDATE_PERIOD_EQUAL_0: number;
        EME_DEFAULT_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS: number;
        EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION: number;
        EME_SESSION_CLOSING_MAX_RETRY: number;
        EME_SESSION_CLOSING_INITIAL_DELAY: number;
        EME_SESSION_CLOSING_MAX_DELAY: number;
        EME_WAITING_DELAY_LOADED_SESSION_EMPTY_KEYSTATUSES: number;
        FORCED_ENDED_THRESHOLD: number;
        ADAPTATION_SWITCH_BUFFER_PADDINGS: {
            video: {
                before: number;
                after: number;
            };
            audio: {
                before: number;
                after: number;
            };
            text: {
                before: number;
                after: number;
            };
            image: {
                before: number;
                after: number;
            };
        };
        SOURCE_BUFFER_FLUSHING_INTERVAL: number;
        CONTENT_REPLACEMENT_PADDING: number;
        CACHE_LOAD_DURATION_THRESHOLDS: {
            video: number;
            audio: number;
        };
        STREAM_EVENT_EMITTER_POLL_INTERVAL: number;
        DEFAULT_MAXIMUM_TIME_ROUNDING_ERROR: number;
        BUFFERED_HISTORY_RETENTION_TIME: number;
        BUFFERED_HISTORY_MAXIMUM_ENTRIES: number;
        MIN_BUFFER_LENGTH: number;
        MIN_BUFFER_DISTANCE_BEFORE_CLEAN_UP: number;
        UPTO_CURRENT_POSITION_CLEANUP: number;
    };
    update(config: Partial<IDefaultConfig>): void;
    getCurrent(): IDefaultConfig;
}
declare const configHandler: ConfigHandler;
export default configHandler;
