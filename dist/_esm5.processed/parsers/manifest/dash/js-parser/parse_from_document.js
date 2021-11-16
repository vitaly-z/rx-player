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
import assertUnreachable from "../../../../utils/assert_unreachable";
import isNullOrUndefined from "../../../../utils/is_null_or_undefined";
import parseMpdIr from "../common";
import { createMPDIntermediateRepresentation, } from "./node_parsers/MPD";
import { createPeriodIntermediateRepresentation, } from "./node_parsers/Period";
/**
 * Parse MPD through the JS parser, on a `Document` instance.
 * @param {Document} manifest - Original manifest as returned by the server
 * @param {Object} args - Various parsing options and information.
 * @returns {Object} - Response returned by the DASH-JS parser.
 */
export default function parseFromDocument(document, args) {
    var root = document.documentElement;
    if (isNullOrUndefined(root) || root.nodeName !== "MPD") {
        throw new Error("DASH Parser: document root should be MPD");
    }
    var _a = createMPDIntermediateRepresentation(root), mpdIR = _a[0], warnings = _a[1];
    var ret = parseMpdIr(mpdIR, args, warnings);
    return processReturn(ret);
    /**
     * Handle `parseMpdIr` return values, asking for resources if they are needed
     * and pre-processing them before continuing parsing.
     *
     * @param {Object} initialRes
     * @returns {Object}
     */
    function processReturn(initialRes) {
        if (initialRes.type === "done") {
            return initialRes;
        }
        else if (initialRes.type === "needs-clock") {
            return {
                type: "needs-resources",
                value: {
                    urls: [initialRes.value.url],
                    format: "string",
                    continue: function (loadedClock) {
                        if (loadedClock.length !== 1) {
                            throw new Error("DASH parser: wrong number of loaded ressources.");
                        }
                        var newRet = initialRes.value.continue(loadedClock[0].responseData);
                        return processReturn(newRet);
                    },
                },
            };
        }
        else if (initialRes.type === "needs-xlinks") {
            return {
                type: "needs-resources",
                value: {
                    urls: initialRes.value.xlinksUrls,
                    format: "string",
                    continue: function (loadedXlinks) {
                        var resourceInfos = [];
                        for (var i = 0; i < loadedXlinks.length; i++) {
                            var _a = loadedXlinks[i], xlinkData = _a.responseData, receivedTime = _a.receivedTime, sendingTime = _a.sendingTime, url = _a.url;
                            var wrappedData = "<root>" + xlinkData + "</root>";
                            var dataAsXML = new DOMParser().parseFromString(wrappedData, "text/xml");
                            if (dataAsXML == null || dataAsXML.children.length === 0) {
                                throw new Error("DASH parser: Invalid external ressources");
                            }
                            var periods = dataAsXML.children[0].children;
                            var periodsIR = [];
                            var periodsIRWarnings = [];
                            for (var j = 0; j < periods.length; j++) {
                                if (periods[j].nodeType === Node.ELEMENT_NODE) {
                                    var _b = createPeriodIntermediateRepresentation(periods[j]), periodIR = _b[0], periodWarnings = _b[1];
                                    periodsIRWarnings.push.apply(periodsIRWarnings, periodWarnings);
                                    periodsIR.push(periodIR);
                                }
                            }
                            resourceInfos.push({ url: url, receivedTime: receivedTime, sendingTime: sendingTime, parsed: periodsIR,
                                warnings: periodsIRWarnings });
                        }
                        var newRet = initialRes.value.continue(resourceInfos);
                        return processReturn(newRet);
                    },
                },
            };
        }
        else {
            assertUnreachable(initialRes);
        }
    }
}
