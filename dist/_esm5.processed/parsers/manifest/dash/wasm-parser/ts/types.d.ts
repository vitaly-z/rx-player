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
 * Identify a "custom event" provoked by the parser.
 *
 * This enum can simply be copy-pasted from the corresponding Rust file as both
 * the TypeScript syntax and the rust syntax for them are really close.
 */
export declare const enum CustomEventType {
    /**
     * Variant that can be used to log various information on the RxPlayer's
     * logger.
     *
     * Useful for debugging, for example.
     */
    Log = 0,
    /** Variant used to report parsing errors to the RxPlayer. */
    Error = 1
}
/**
 * Identify the name of a node encountered by the wasm-parser.
 *
 * This enum can simply be copy-pasted from the corresponding Rust file as both
 * the TypeScript syntax and the rust syntax for them are really close.
 */
export declare const enum TagName {
    MPD = 1,
    Period = 2,
    UtcTiming = 3,
    AdaptationSet = 4,
    EventStream = 5,
    EventStreamElt = 6,
    Representation = 7,
    Accessibility = 8,
    ContentComponent = 9,
    ContentProtection = 10,
    EssentialProperty = 11,
    Role = 12,
    SupplementalProperty = 13,
    BaseURL = 15,
    SegmentTemplate = 16,
    SegmentBase = 17,
    SegmentList = 18,
    InbandEventStream = 19,
    SegmentUrl = 20
}
/**
 * Identify the name of an attribute encountered by the wasm-parser.
 *
 * This enum can simply be copy-pasted from the corresponding Rust file as both
 * the TypeScript syntax and the rust syntax for them are really close.
 */
export declare const enum AttributeName {
    Id = 0,
    Duration = 1,
    Profiles = 2,
    AudioSamplingRate = 3,
    Codecs = 4,
    CodingDependency = 5,
    FrameRate = 6,
    Height = 7,
    Width = 8,
    MaxPlayoutRate = 9,
    MaxSAPPeriod = 10,
    MimeType = 11,
    SegmentProfiles = 12,
    ContentProtectionValue = 13,
    ContentProtectionKeyId = 14,
    ContentProtectionCencPSSH = 15,
    SchemeIdUri = 16,
    SchemeValue = 17,
    MediaRange = 18,
    SegmentTimeline = 19,
    StartNumber = 20,
    SegmentBaseSegment = 21,
    AvailabilityTimeComplete = 22,
    IndexRangeExact = 23,
    PresentationTimeOffset = 24,
    EventPresentationTime = 25,
    Element = 26,
    TimeScale = 27,
    Index = 28,
    InitializationRange = 29,
    Media = 30,
    IndexRange = 31,
    BitstreamSwitching = 32,
    Type = 33,
    AvailabilityStartTime = 34,
    AvailabilityEndTime = 35,
    PublishTime = 36,
    MinimumUpdatePeriod = 37,
    MinBufferTime = 38,
    TimeShiftBufferDepth = 39,
    SuggestedPresentationDelay = 40,
    MaxSegmentDuration = 41,
    MaxSubsegmentDuration = 42,
    AvailabilityTimeOffset = 43,
    BaseUrlValue = 44,
    Start = 45,
    XLinkHref = 46,
    XLinkActuate = 47,
    Group = 48,
    MaxBandwidth = 49,
    MaxFrameRate = 50,
    MaxHeight = 51,
    MaxWidth = 52,
    MinBandwidth = 53,
    MinFrameRate = 54,
    MinHeight = 55,
    MinWidth = 56,
    SelectionPriority = 57,
    SegmentAlignment = 58,
    SubsegmentAlignment = 59,
    Language = 60,
    ContentType = 61,
    Par = 62,
    Bitrate = 63,
    Text = 64,
    QualityRanking = 65,
    Location = 66,
    InitializationMedia = 67,
    MediaPresentationDuration = 68,
    EventStreamEltRange = 69
}
