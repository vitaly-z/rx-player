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
import log from "../../../../log";
import { SUPPORTED_ADAPTATIONS_TYPE, } from "../../../../manifest";
import arrayFind from "../../../../utils/array_find";
import arrayFindIndex from "../../../../utils/array_find_index";
import arrayIncludes from "../../../../utils/array_includes";
import isNonEmptyString from "../../../../utils/is_non_empty_string";
import attachTrickModeTrack from "./attach_trickmode_track";
// eslint-disable-next-line max-len
import inferAdaptationType from "./infer_adaptation_type";
import parseRepresentations from "./parse_representations";
import resolveBaseURLs from "./resolve_base_urls";
/**
 * Detect if the accessibility given defines an adaptation for the visually
 * impaired.
 * Based on DVB Document A168 (DVB-DASH) and DASH-IF 4.3.
 * @param {Object} accessibility
 * @returns {Boolean}
 */
function isVisuallyImpaired(accessibility) {
    if (accessibility === undefined) {
        return false;
    }
    var isVisuallyImpairedAudioDvbDash = (accessibility.schemeIdUri === "urn:tva:metadata:cs:AudioPurposeCS:2007" &&
        accessibility.value === "1");
    var isVisuallyImpairedDashIf = (accessibility.schemeIdUri === "urn:mpeg:dash:role:2011" &&
        accessibility.value === "description");
    return isVisuallyImpairedAudioDvbDash || isVisuallyImpairedDashIf;
}
/**
 * Detect if the accessibility given defines an adaptation for the hard of
 * hearing.
 * Based on DVB Document A168 (DVB-DASH).
 * @param {Object} accessibility
 * @returns {Boolean}
 */
function isHardOfHearing(accessibility) {
    if (accessibility === undefined) {
        return false;
    }
    return (accessibility.schemeIdUri === "urn:tva:metadata:cs:AudioPurposeCS:2007" &&
        accessibility.value === "2");
}
/**
 * Detect if the accessibility given defines an AdaptationSet containing a sign
 * language interpretation.
 * Based on DASH-IF 4.3.
 * @param {Object} accessibility
 * @returns {Boolean}
 */
function hasSignLanguageInterpretation(accessibility) {
    if (accessibility === undefined) {
        return false;
    }
    return (accessibility.schemeIdUri === "urn:mpeg:dash:role:2011" &&
        accessibility.value === "sign");
}
/**
 * Contruct Adaptation ID from the information we have.
 * @param {Object} adaptation
 * @param {Array.<Object>} representations
 * @param {Array.<Object>} representations
 * @param {Object} infos
 * @returns {string}
 */
function getAdaptationID(adaptation, infos) {
    if (isNonEmptyString(adaptation.attributes.id)) {
        return adaptation.attributes.id;
    }
    var isClosedCaption = infos.isClosedCaption, isAudioDescription = infos.isAudioDescription, isSignInterpreted = infos.isSignInterpreted, isTrickModeTrack = infos.isTrickModeTrack, type = infos.type;
    var idString = type;
    if (isNonEmptyString(adaptation.attributes.language)) {
        idString += "-".concat(adaptation.attributes.language);
    }
    if (isClosedCaption === true) {
        idString += "-cc";
    }
    if (isAudioDescription === true) {
        idString += "-ad";
    }
    if (isSignInterpreted === true) {
        idString += "-si";
    }
    if (isTrickModeTrack) {
        idString += "-trickMode";
    }
    if (isNonEmptyString(adaptation.attributes.contentType)) {
        idString += "-".concat(adaptation.attributes.contentType);
    }
    if (isNonEmptyString(adaptation.attributes.codecs)) {
        idString += "-".concat(adaptation.attributes.codecs);
    }
    if (isNonEmptyString(adaptation.attributes.mimeType)) {
        idString += "-".concat(adaptation.attributes.mimeType);
    }
    if (isNonEmptyString(adaptation.attributes.frameRate)) {
        idString += "-".concat(adaptation.attributes.frameRate);
    }
    return idString;
}
/**
 * Returns a list of ID this adaptation can be seamlessly switched to
 * @param {Object} adaptation
 * @returns {Array.<string>}
 */
function getAdaptationSetSwitchingIDs(adaptation) {
    if (adaptation.children.supplementalProperties != null) {
        var supplementalProperties = adaptation.children.supplementalProperties;
        for (var _i = 0, supplementalProperties_1 = supplementalProperties; _i < supplementalProperties_1.length; _i++) {
            var supplementalProperty = supplementalProperties_1[_i];
            if (supplementalProperty.schemeIdUri ===
                "urn:mpeg:dash:adaptation-set-switching:2016" &&
                supplementalProperty.value != null) {
                return supplementalProperty.value.split(",")
                    .map(function (id) { return id.trim(); })
                    .filter(function (id) { return id; });
            }
        }
    }
    return [];
}
/**
 * Process AdaptationSets intermediate representations to return under its final
 * form.
 * Note that the AdaptationSets returned are sorted by priority (from the most
 * priority to the least one).
 * @param {Array.<Object>} adaptationsIR
 * @param {Object} context
 * @returns {Array.<Object>}
 */
export default function parseAdaptationSets(adaptationsIR, context) {
    var _a;
    var _b, _c, _d, _e, _f, _g, _h, _j;
    var parsedAdaptations = { video: [],
        audio: [],
        text: [],
        image: [] };
    var trickModeAdaptations = [];
    var adaptationSwitchingInfos = {};
    var parsedAdaptationsIDs = [];
    /**
     * Index of the last parsed Video AdaptationSet with a Role set as "main" in
     * `parsedAdaptations.video`.
     * `-1` if not yet encountered.
     * Used as we merge all main video AdaptationSet due to a comprehension of the
     * DASH-IF IOP.
     */
    var lastMainVideoAdapIdx = -1;
    for (var adaptationIdx = 0; adaptationIdx < adaptationsIR.length; adaptationIdx++) {
        var adaptation = adaptationsIR[adaptationIdx];
        var adaptationChildren = adaptation.children;
        var essentialProperties = adaptationChildren.essentialProperties, roles = adaptationChildren.roles;
        var isMainAdaptation = Array.isArray(roles) &&
            roles.some(function (role) { return role.value === "main"; }) &&
            roles.some(function (role) { return role.schemeIdUri === "urn:mpeg:dash:role:2011"; });
        var representationsIR = adaptation.children.representations;
        var availabilityTimeComplete = (_b = adaptation.attributes.availabilityTimeComplete) !== null && _b !== void 0 ? _b : context.availabilityTimeComplete;
        var availabilityTimeOffset = ((_c = adaptation.attributes.availabilityTimeOffset) !== null && _c !== void 0 ? _c : 0) +
            context.availabilityTimeOffset;
        var adaptationMimeType = adaptation.attributes.mimeType;
        var adaptationCodecs = adaptation.attributes.codecs;
        var type = inferAdaptationType(representationsIR, isNonEmptyString(adaptationMimeType) ?
            adaptationMimeType :
            null, isNonEmptyString(adaptationCodecs) ?
            adaptationCodecs :
            null, adaptationChildren.roles != null ?
            adaptationChildren.roles :
            null);
        if (type === undefined) {
            continue;
        }
        var priority = (_d = adaptation.attributes.selectionPriority) !== null && _d !== void 0 ? _d : 1;
        var originalID = adaptation.attributes.id;
        var newID = void 0;
        var adaptationSetSwitchingIDs = getAdaptationSetSwitchingIDs(adaptation);
        var parentSegmentTemplates = [];
        if (context.segmentTemplate !== undefined) {
            parentSegmentTemplates.push(context.segmentTemplate);
        }
        if (adaptation.children.segmentTemplate !== undefined) {
            parentSegmentTemplates.push(adaptation.children.segmentTemplate);
        }
        var reprCtxt = {
            aggressiveMode: context.aggressiveMode,
            availabilityTimeComplete: availabilityTimeComplete,
            availabilityTimeOffset: availabilityTimeOffset,
            baseURLs: resolveBaseURLs(context.baseURLs, adaptationChildren.baseURLs),
            manifestBoundsCalculator: context.manifestBoundsCalculator,
            end: context.end,
            isDynamic: context.isDynamic,
            isLastPeriod: context.isLastPeriod,
            manifestProfiles: context.manifestProfiles,
            parentSegmentTemplates: parentSegmentTemplates,
            receivedTime: context.receivedTime,
            start: context.start,
            timeShiftBufferDepth: context.timeShiftBufferDepth,
            unsafelyBaseOnPreviousAdaptation: null,
        };
        var trickModeProperty = Array.isArray(essentialProperties) ?
            arrayFind(essentialProperties, function (scheme) {
                return scheme.schemeIdUri === "http://dashif.org/guidelines/trickmode";
            }) : undefined;
        var trickModeAttachedAdaptationIds = (_e = trickModeProperty === null || trickModeProperty === void 0 ? void 0 : trickModeProperty.value) === null || _e === void 0 ? void 0 : _e.split(" ");
        var isTrickModeTrack = trickModeAttachedAdaptationIds !== undefined;
        if (type === "video" &&
            isMainAdaptation &&
            lastMainVideoAdapIdx >= 0 &&
            parsedAdaptations.video.length > lastMainVideoAdapIdx &&
            !isTrickModeTrack) {
            var videoMainAdaptation = parsedAdaptations.video[lastMainVideoAdapIdx][0];
            reprCtxt.unsafelyBaseOnPreviousAdaptation = (_g = (_f = context
                .unsafelyBaseOnPreviousPeriod) === null || _f === void 0 ? void 0 : _f.getAdaptation(videoMainAdaptation.id)) !== null && _g !== void 0 ? _g : null;
            var representations = parseRepresentations(representationsIR, adaptation, reprCtxt);
            (_a = videoMainAdaptation.representations).push.apply(_a, representations);
            newID = videoMainAdaptation.id;
        }
        else {
            var accessibilities = adaptationChildren.accessibilities;
            var isDub = void 0;
            if (roles !== undefined &&
                roles.some(function (role) { return role.value === "dub"; })) {
                isDub = true;
            }
            var isClosedCaption = void 0;
            if (type !== "text") {
                isClosedCaption = false;
            }
            else if (accessibilities !== undefined) {
                isClosedCaption = accessibilities.some(isHardOfHearing);
            }
            var isAudioDescription = void 0;
            if (type !== "audio") {
                isAudioDescription = false;
            }
            else if (accessibilities !== undefined) {
                isAudioDescription = accessibilities.some(isVisuallyImpaired);
            }
            var isSignInterpreted = void 0;
            if (type !== "video") {
                isSignInterpreted = false;
            }
            else if (accessibilities !== undefined) {
                isSignInterpreted = accessibilities.some(hasSignLanguageInterpretation);
            }
            var adaptationID = getAdaptationID(adaptation, { isAudioDescription: isAudioDescription, isClosedCaption: isClosedCaption, isSignInterpreted: isSignInterpreted, isTrickModeTrack: isTrickModeTrack, type: type });
            // Avoid duplicate IDs
            while (arrayIncludes(parsedAdaptationsIDs, adaptationID)) {
                adaptationID += "-dup";
            }
            newID = adaptationID;
            parsedAdaptationsIDs.push(adaptationID);
            reprCtxt.unsafelyBaseOnPreviousAdaptation = (_j = (_h = context
                .unsafelyBaseOnPreviousPeriod) === null || _h === void 0 ? void 0 : _h.getAdaptation(adaptationID)) !== null && _j !== void 0 ? _j : null;
            var representations = parseRepresentations(representationsIR, adaptation, reprCtxt);
            var parsedAdaptationSet = { id: adaptationID, representations: representations, type: type, isTrickModeTrack: isTrickModeTrack };
            if (adaptation.attributes.language != null) {
                parsedAdaptationSet.language = adaptation.attributes.language;
            }
            if (isClosedCaption != null) {
                parsedAdaptationSet.closedCaption = isClosedCaption;
            }
            if (isAudioDescription != null) {
                parsedAdaptationSet.audioDescription = isAudioDescription;
            }
            if (isDub === true) {
                parsedAdaptationSet.isDub = true;
            }
            if (isSignInterpreted === true) {
                parsedAdaptationSet.isSignInterpreted = true;
            }
            if (trickModeAttachedAdaptationIds !== undefined) {
                trickModeAdaptations.push({ adaptation: parsedAdaptationSet, trickModeAttachedAdaptationIds: trickModeAttachedAdaptationIds });
            }
            else {
                // look if we have to merge this into another Adaptation
                var mergedIntoIdx = -1;
                var _loop_1 = function (id) {
                    var _k;
                    var switchingInfos = adaptationSwitchingInfos[id];
                    if (switchingInfos !== undefined &&
                        switchingInfos.newID !== newID &&
                        arrayIncludes(switchingInfos.adaptationSetSwitchingIDs, originalID)) {
                        mergedIntoIdx = arrayFindIndex(parsedAdaptations[type], function (a) { return a[0].id === id; });
                        var mergedInto = parsedAdaptations[type][mergedIntoIdx];
                        if (mergedInto !== undefined &&
                            mergedInto[0].audioDescription ===
                                parsedAdaptationSet.audioDescription &&
                            mergedInto[0].closedCaption ===
                                parsedAdaptationSet.closedCaption &&
                            mergedInto[0].language === parsedAdaptationSet.language) {
                            log.info("DASH Parser: merging \"switchable\" AdaptationSets", originalID, id);
                            (_k = mergedInto[0].representations).push.apply(_k, parsedAdaptationSet.representations);
                            if (type === "video" &&
                                isMainAdaptation &&
                                !mergedInto[1].isMainAdaptation) {
                                lastMainVideoAdapIdx = Math.max(lastMainVideoAdapIdx, mergedIntoIdx);
                            }
                            mergedInto[1] = {
                                priority: Math.max(priority, mergedInto[1].priority),
                                isMainAdaptation: isMainAdaptation ||
                                    mergedInto[1].isMainAdaptation,
                                indexInMpd: Math.min(adaptationIdx, mergedInto[1].indexInMpd),
                            };
                        }
                    }
                };
                for (var _i = 0, adaptationSetSwitchingIDs_1 = adaptationSetSwitchingIDs; _i < adaptationSetSwitchingIDs_1.length; _i++) {
                    var id = adaptationSetSwitchingIDs_1[_i];
                    _loop_1(id);
                }
                if (mergedIntoIdx < 0) {
                    parsedAdaptations[type].push([parsedAdaptationSet,
                        { priority: priority, isMainAdaptation: isMainAdaptation, indexInMpd: adaptationIdx }]);
                    if (type === "video" && isMainAdaptation) {
                        lastMainVideoAdapIdx = parsedAdaptations.video.length - 1;
                    }
                }
            }
        }
        if (originalID != null && adaptationSwitchingInfos[originalID] == null) {
            adaptationSwitchingInfos[originalID] = { newID: newID, adaptationSetSwitchingIDs: adaptationSetSwitchingIDs };
        }
    }
    var adaptationsPerType = SUPPORTED_ADAPTATIONS_TYPE
        .reduce(function (acc, adaptationType) {
        var adaptationsParsedForType = parsedAdaptations[adaptationType];
        if (adaptationsParsedForType.length > 0) {
            adaptationsParsedForType.sort(compareAdaptations);
            acc[adaptationType] = adaptationsParsedForType
                .map(function (_a) {
                var parsedAdaptation = _a[0];
                return parsedAdaptation;
            });
        }
        return acc;
    }, {});
    parsedAdaptations.video.sort(compareAdaptations);
    attachTrickModeTrack(adaptationsPerType, trickModeAdaptations);
    return adaptationsPerType;
}
/**
 * Compare groups of parsed AdaptationSet, alongside some ordering metadata,
 * allowing to easily sort them through JavaScript's `Array.prototype.sort`
 * method.
 * @param {Array.<Object>} a
 * @param {Array.<Object>} b
 * @returns {number}
 */
function compareAdaptations(a, b) {
    var priorityDiff = b[1].priority - a[1].priority;
    if (priorityDiff !== 0) {
        return priorityDiff;
    }
    if (a[1].isMainAdaptation !== b[1].isMainAdaptation) {
        return a[1].isMainAdaptation ? -1 :
            1;
    }
    return a[1].indexInMpd - b[1].indexInMpd;
}
