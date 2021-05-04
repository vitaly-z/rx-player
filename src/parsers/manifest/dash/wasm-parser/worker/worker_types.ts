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
export const enum CustomEventType {
  /**
   * Variant that can be used to log various information on the RxPlayer's
   * logger.
   *
   * Useful for debugging, for example.
   */
  Log = 0,

    /** Variant used to report parsing errors to the RxPlayer. */
  Error = 1,
}

/**
 * Identify the name of a node encountered by the wasm-parser.
 *
 * This enum can simply be copy-pasted from the corresponding Rust file as both
 * the TypeScript syntax and the rust syntax for them are really close.
 */
export const enum TagName {
  /// Indicate an <MPD> node
  /// These nodes are usually contained at the root of an MPD.
  MPD = 1,

  // -- Inside an <MPD> --

  /// Indicate a <Period> node
  Period = 2,

  /// Indicate a <UTCTiming> node
  UtcTiming = 3,

  // -- Inside a <Period> --

  /// Indicate an <AdaptationSet> node
  AdaptationSet = 4,

  /// Indicate an <EventStream> node
  EventStream = 5,

  /// Indicate an <Event> node.
  /// These nodes are usually contained in <EventStream> elements.
  EventStreamElt = 6,

  // -- Inside an <AdaptationSet> --

  /// Indicate a <Representation> node
  Representation = 7,

  /// Indicate an <Accessibility> node
  Accessibility = 8,

  /// Indicate a <ContentComponent> node
  ContentComponent = 9,

  /// Indicate a <ContentProtection> node
  ContentProtection = 10,

  /// Indicate an <EssentialProperty> node
  EssentialProperty = 11,

  /// Indicate a <Role> node
  Role = 12,

  /// Indicate a <SupplementalProperty> node
  SupplementalProperty = 13,

  // -- Inside various elements --

  /// Indicate a <BaseURL> node
  BaseURL = 15,

  /// Indicate a <SegmentTemplate> node
  SegmentTemplate = 16,

  /// Indicate a <SegmentBase> node
  SegmentBase = 17,

  /// Indicate a <SegmentList> node
  SegmentList = 18,

  /// Indicate an <InbandEventStream> node
  InbandEventStream = 19,

  // -- Inside a <SegmentList> --

  /// Indicate a <SegmentURL> node
  SegmentUrl = 20,
}

/**
 * Identify the name of an attribute encountered by the wasm-parser.
 *
 * This enum can simply be copy-pasted from the corresponding Rust file as both
 * the TypeScript syntax and the rust syntax for them are really close.
 */
export const enum AttributeName {
  Id = 0,
  Duration = 1,
  Profiles = 2,

  // AdaptationSet + Representation
  AudioSamplingRate = 3,
  Codecs = 4, // String
  CodingDependency = 5,
  FrameRate = 6,
  Height = 7, // f64
  Width = 8, // f64
  MaxPlayoutRate = 9,
  MaxSAPPeriod = 10,
  MimeType = 11, // f64
  SegmentProfiles = 12,

  // ContentProtection
  ContentProtectionValue = 13, // String
  ContentProtectionKeyId = 14, // ArrayBuffer
  ContentProtectionCencPSSH = 15, // ArrayBuffer

  // Various schemes (Accessibility) + EventStream + ContentProtection
  SchemeIdUri = 16, // String

  // Various schemes (Accessibility)
  SchemeValue = 17, // String

  // SegmentURL
  MediaRange = 18, // [f64, f64]

  // SegmentTimeline
  SegmentTimeline = 19, // Vec<SElement>

  // SegmentTemplate
  StartNumber = 20, // f64

  // SegmentBase
  SegmentBaseSegment = 21, // SegmentBaseSegment

  // SegmentTemplate + SegmentBase
  AvailabilityTimeComplete = 22, // u8 (bool)
  IndexRangeExact = 23, // u8 (bool)
  PresentationTimeOffset = 24, // f64

  // EventStream
  EventPresentationTime = 25, // f64

  // EventStreamElt
  Element = 26, // String (XML)

  // SegmentTemplate + SegmentBase + EventStream + EventStreamElt
  TimeScale = 27, // f64

  // SegmentURL + SegmentTemplate
  Index = 28, // String

  // Initialization
  InitializationRange = 29, // [f64, f64]

  // SegmentURL + SegmentTemplate + SegmentBase + Initialization
  Media = 30, // String
  IndexRange = 31, // [f64, f64]

  // Period + AdaptationSet + SegmentTemplate
  BitstreamSwitching = 32, // u8 (bool)


  // MPD
  Type = 33, // String
  AvailabilityStartTime = 34, // f64
  AvailabilityEndTime = 35, // f64
  PublishTime = 36, // f64
  MinimumUpdatePeriod = 37, // f64
  MinBufferTime = 38, // f64
  TimeShiftBufferDepth = 39, // f64
  SuggestedPresentationDelay = 40, // f64
  MaxSegmentDuration = 41, // f64
  MaxSubsegmentDuration = 42, // f64

  // BaseURL + SegmentTemplate
  AvailabilityTimeOffset = 43, // f64

  // BaseURL
  BaseUrlValue = 44, // String

  // Period
  Start = 45, // f64
  XLinkHref = 46, // String
  XLinkActuate = 47, // String

  // AdaptationSet
  Group = 48,
  MaxBandwidth = 49, // f64
  MaxFrameRate = 50, // f64
  MaxHeight = 51, // f64
  MaxWidth = 52, // f64
  MinBandwidth = 53, // f64
  MinFrameRate = 54, // f64
  MinHeight = 55, // f64
  MinWidth = 56, // f64
  SelectionPriority = 57,
  SegmentAlignment = 58,
  SubsegmentAlignment = 59,

  // AdaptationSet + ContentComponent
  Language = 60, // String
  ContentType = 61, // String
  Par = 62,

  // Representation
  Bitrate = 63, // f64

  Text = 64,
  QualityRanking = 65,
  Location = 66,

  InitializationMedia = 67,

  /// Describes an encountered "mediaPresentationDuration" attribute, as found
  /// in `<MPD>` elements.
  ///
  /// This value has been converted into seconds, as an f64.
  MediaPresentationDuration = 68,

  /// Describes the byte range (end not included) of an encountered `<Event>`
  /// element in the whole MPD.
  ///
  /// This can be useful to re-construct the whole element on the JS-sid.
  ///
  /// It is reported as an array of two f64 values.
  /// The first number indicating the starting range (included).
  /// The second indicating the ending range (non-included).
  EventStreamEltRange = 69,
}

/** Messages that can be sent to this worker. */
export type IIngoingMessage = IInitializeIngoingMessage |
                              IParseMpdIngoingMessage |
                              IParseXlinkIngoingMessage;

/**
 * Discriminants indentifying ingoing messages (messages that are sent to the
 * worker.
 */
export const enum IngoingMessageType {
  Initialize = 0,
  ParseMpd = 1,
  ParseXlink = 2,
}

/**
 * Message telling the worker that it should initialize (fetch and compile) the
 * WebAssembly file.
 *
 * The sender will know when this task finished once either:
 *
 *   - a `IInitializedEvent` message has been received back from the worker
 *     (meaning the initialization succeeded).
 *
 *   - a `IInitializationErrorEvent` message has been received back from the
 *     worker (meaning the initialization failed).
 *
 * During initialization, `IInitializationWarningEvent` messages can be sent by
 * the worker, indicating some minor errors.
 */
export interface IInitializeIngoingMessage {
  /** Identify a `IInitializeIngoingMessage`. */
  type : IngoingMessageType.Initialize;

  /** The URL of the WebAssembly file the worker needs to fetch. */
  wasmUrl : string;
}

/**
 * Message telling the worker that it should parse the given MPD file.
 *
 * The sender will know when this task finished once either:
 *
 *   - a `IMPDParsingFinishedEvent` message has been received back from the
 *     worker (meaning the parsing operation succeeded).
 *
 *   - a `IMPDParsingErrorEvent` message has been received back from the
 *     worker (meaning the parsing operation failed).
 *
 * While parsing is pending, a lot of different message types can be sent.
 * // XXX TODO continue comment
 */
export interface IParseMpdIngoingMessage {
  /** Identify a `IParseMpdIngoingMessage`. */
  type : IngoingMessageType.ParseMpd;

  /** The MPD file, encoded in UTF-8 */
  mpd : ArrayBuffer;
}

export interface IParseXlinkIngoingMessage {
  type : IngoingMessageType.ParseXlink;
  xlink : ArrayBuffer;
}

export const enum OutgoingMessageType {
  // 0-10 === Urgent === sent right away
  Initialized = 0,
  InitializationWarning = 1,
  InitializationError = 2,
  MPDParsingError = 3,
  MPDParsingFinished = 4,
  XLinkParsingError = 5,
  XLinkParsingFinished = 6,

  // 11+ === buffered === sent in groups
  TagOpen = 11,
  TagClose = 12,

  // 21+ === buffered + ArrayBuffer `payload`
  ParserWarning = 21,
  Attribute = 22,
}

export type IInitializedEvent = [OutgoingMessageType.Initialized];

export type IInitializationWarningEvent = [
  OutgoingMessageType.InitializationWarning,
  string,
];

export type IInitializationErrorEvent = [
  OutgoingMessageType.InitializationError,
  string,
];

export type IMPDParsingErrorEvent = [
  OutgoingMessageType.MPDParsingError,
  string,
];

export type IMPDParsingFinishedEvent = [ OutgoingMessageType.MPDParsingFinished ];

export type IXLinkParsingErrorEvent = [
  OutgoingMessageType.XLinkParsingError,
  string,
];

export type IXLinkParsingFinishedEvent = [
  OutgoingMessageType.XLinkParsingFinished,
];

export type IParsedTagEvent = [
  OutgoingMessageType.TagOpen | OutgoingMessageType.TagClose,
  TagName,
];

export type IParserWarningEvent = [
  OutgoingMessageType.ParserWarning,
  ArrayBuffer,
];

export type IParsedAttributeEvent = [
  OutgoingMessageType.Attribute,
  ArrayBuffer,
  AttributeName,
];

export type IWorkerOutgoingMessage = IInitializedEvent |
                                     IInitializationWarningEvent |
                                     IInitializationErrorEvent |
                                     IMPDParsingErrorEvent |
                                     IMPDParsingFinishedEvent |
                                     IXLinkParsingErrorEvent |
                                     IXLinkParsingFinishedEvent |
                                     IParsedTagEvent |
                                     IParserWarningEvent |
                                     IParsedAttributeEvent;
