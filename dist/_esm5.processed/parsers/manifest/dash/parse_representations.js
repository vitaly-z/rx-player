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
import log from "../../../log";
import arrayFind from "../../../utils/array_find";
import objectAssign from "../../../utils/object_assign";
import parseRepresentationIndex from "./parse_representation_index";
/**
 * Combine inband event streams from representation and
 * adaptation data.
 * @param {Object} representation
 * @param {Object} adaptation
 * @returns {undefined | Array.<Object>}
 */
function combineInbandEventStreams(representation, adaptation) {
    var newSchemeId = [];
    if (representation.children.inbandEventStreams !== undefined) {
        newSchemeId.push.apply(newSchemeId, representation.children.inbandEventStreams);
    }
    if (adaptation.children.inbandEventStreams !== undefined) {
        newSchemeId.push.apply(newSchemeId, adaptation.children.inbandEventStreams);
    }
    if (newSchemeId.length === 0) {
        return undefined;
    }
    return newSchemeId;
}
/**
 * Process intermediate representations to create final parsed representations.
 * @param {Array.<Object>} representationsIR
 * @param {Object} adaptationInfos
 * @returns {Array.<Object>}
 */
export default function parseRepresentations(representationsIR, adaptation, adaptationInfos) {
    var _a, _b;
    var parsedRepresentations = [];
    var _loop_1 = function (reprIdx) {
        var representation = representationsIR[reprIdx];
        // Compute Representation ID
        var representationID = representation.attributes.id != null ?
            representation.attributes.id :
            (String(representation.attributes.bitrate) +
                (representation.attributes.height != null ?
                    ("-" + representation.attributes.height) :
                    "") +
                (representation.attributes.width != null ?
                    ("-" + representation.attributes.width) :
                    "") +
                (representation.attributes.mimeType != null ?
                    ("-" + representation.attributes.mimeType) :
                    "") +
                (representation.attributes.codecs != null ?
                    ("-" + representation.attributes.codecs) :
                    ""));
        // Avoid duplicate IDs
        while (parsedRepresentations.some(function (r) { return r.id === representationID; })) {
            representationID += "-dup";
        }
        // Retrieve previous version of the Representation, if one.
        var unsafelyBaseOnPreviousRepresentation = (_b = (_a = adaptationInfos
            .unsafelyBaseOnPreviousAdaptation) === null || _a === void 0 ? void 0 : _a.getRepresentation(representationID)) !== null && _b !== void 0 ? _b : null;
        var inbandEventStreams = combineInbandEventStreams(representation, adaptation);
        var representationInfos = objectAssign({}, adaptationInfos, { unsafelyBaseOnPreviousRepresentation: unsafelyBaseOnPreviousRepresentation,
            adaptation: adaptation,
            inbandEventStreams: inbandEventStreams });
        var representationIndex = parseRepresentationIndex(representation, representationInfos);
        // Find bitrate
        var representationBitrate = void 0;
        if (representation.attributes.bitrate == null) {
            log.warn("DASH: No usable bitrate found in the Representation.");
            representationBitrate = 0;
        }
        else {
            representationBitrate = representation.attributes.bitrate;
        }
        // Construct Representation Base
        var parsedRepresentation = { bitrate: representationBitrate,
            index: representationIndex,
            id: representationID };
        // Add optional attributes
        var codecs = void 0;
        if (representation.attributes.codecs != null) {
            codecs = representation.attributes.codecs;
        }
        else if (adaptation.attributes.codecs != null) {
            codecs = adaptation.attributes.codecs;
        }
        if (codecs != null) {
            codecs = codecs === "mp4a.40.02" ? "mp4a.40.2" : codecs;
            parsedRepresentation.codecs = codecs;
        }
        if (representation.attributes.frameRate != null) {
            parsedRepresentation.frameRate =
                representation.attributes.frameRate;
        }
        else if (adaptation.attributes.frameRate != null) {
            parsedRepresentation.frameRate =
                adaptation.attributes.frameRate;
        }
        if (representation.attributes.height != null) {
            parsedRepresentation.height =
                representation.attributes.height;
        }
        else if (adaptation.attributes.height != null) {
            parsedRepresentation.height =
                adaptation.attributes.height;
        }
        if (representation.attributes.mimeType != null) {
            parsedRepresentation.mimeType =
                representation.attributes.mimeType;
        }
        else if (adaptation.attributes.mimeType != null) {
            parsedRepresentation.mimeType =
                adaptation.attributes.mimeType;
        }
        if (representation.attributes.width != null) {
            parsedRepresentation.width =
                representation.attributes.width;
        }
        else if (adaptation.attributes.width != null) {
            parsedRepresentation.width =
                adaptation.attributes.width;
        }
        if (adaptation.children.contentProtections != null) {
            var contentProtections = adaptation.children.contentProtections
                .reduce(function (acc, cp) {
                var _a;
                var systemId;
                if (cp.attributes.schemeIdUri !== undefined &&
                    cp.attributes.schemeIdUri.substring(0, 9) === "urn:uuid:") {
                    systemId = cp.attributes.schemeIdUri.substring(9)
                        .replace(/-/g, "")
                        .toLowerCase();
                }
                if (cp.attributes.keyId !== undefined && cp.attributes.keyId.length > 0) {
                    acc.keyIds.push({ keyId: cp.attributes.keyId, systemId: systemId });
                }
                if (systemId !== undefined) {
                    var cencPssh = cp.children.cencPssh;
                    var values = [];
                    for (var i = 0; i < cencPssh.length; i++) {
                        var data = cencPssh[i];
                        values.push({ systemId: systemId, data: data });
                    }
                    if (values.length > 0) {
                        var cencInitData = arrayFind(acc.initData, function (i) { return i.type === "cenc"; });
                        if (cencInitData === undefined) {
                            acc.initData.push({ type: "cenc", values: values });
                        }
                        else {
                            (_a = cencInitData.values).push.apply(_a, values);
                        }
                    }
                }
                return acc;
            }, { keyIds: [], initData: [] });
            if (Object.keys(contentProtections.initData).length > 0 ||
                contentProtections.keyIds.length > 0) {
                parsedRepresentation.contentProtections = contentProtections;
            }
        }
        parsedRepresentations.push(parsedRepresentation);
    };
    for (var reprIdx = 0; reprIdx < representationsIR.length; reprIdx++) {
        _loop_1(reprIdx);
    }
    return parsedRepresentations;
}
