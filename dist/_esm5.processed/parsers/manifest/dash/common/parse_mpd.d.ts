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
import Manifest from "../../../../manifest";
import { IParsedManifest } from "../../types";
import { IMPDIntermediateRepresentation, IPeriodIntermediateRepresentation } from "../node_parser_types";
import { IResponseData } from "../parsers_types";
import { IXLinkInfos } from "./parse_periods";
/** Possible options for `parseMPD`.  */
export interface IMPDParserArguments {
    /** Whether we should request new segments even if they are not yet finished. */
    aggressiveMode: boolean;
    /**
     * If set, offset to add to `performance.now()` to obtain the current server's
     * time.
     */
    externalClockOffset?: number;
    /** Time, in terms of `performance.now` at which this MPD was received. */
    manifestReceivedTime?: number;
    /** Default base time, in seconds. */
    referenceDateTime?: number;
    /**
     * The parser should take this Manifest - which is a previously parsed
     * Manifest for the same dynamic content - as a base to speed-up the parsing
     * process.
     * /!\ If unexpected differences exist between the two, there is a risk of
     * de-synchronization with what is actually on the server,
     * Use with moderation.
     */
    unsafelyBaseOnPreviousManifest: Manifest | null;
    /** URL of the manifest (post-redirection if one). */
    url?: string;
}
export interface ILoadedXlinkData {
    url?: string;
    sendingTime?: number;
    receivedTime?: number;
    parsed: IPeriodIntermediateRepresentation[];
    warnings: Error[];
}
/**
 * Return value returned from `parseMpdIr` when a "clock" needs to be fetched
 * before the true parsing can start.
 */
export interface IIrParserResponseNeedsClock {
    /** Identify this particular response. */
    type: "needs-clock";
    value: {
        /** URL allowing to fetch the clock data. */
        url: string;
        /**
         * Callback to call with the fetched clock data in argument to continue
         * parsing the MPD.
         */
        continue: (clockValue: IResponseData<string>) => IIrParserResponse;
    };
}
/**
 * Return value returned from `parseMpdIr` when XLinks needs to be loaded and
 * pre-parsed before the true parsing can start.
 */
export interface IIrParserResponseNeedsXlinks {
    type: "needs-xlinks";
    value: {
        xlinksUrls: string[];
        continue: (periods: ILoadedXlinkData[]) => IIrParserResponse;
    };
}
export interface IIrParserResponseDone {
    type: "done";
    value: {
        parsed: IParsedManifest;
        warnings: Error[];
    };
}
export declare type IIrParserResponse = IIrParserResponseNeedsClock | IIrParserResponseNeedsXlinks | IIrParserResponseDone;
/**
 * Checks if xlinks needs to be loaded before actually parsing the manifest.
 * @param {Object} mpdIR
 * @param {Object} args
 * @param {boolean} hasLoadedClock
 * @param {Array.<Object>} warnings
 * @returns {Object}
 */
export default function parseMpdIr(mpdIR: IMPDIntermediateRepresentation, args: IMPDParserArguments, warnings: Error[], hasLoadedClock?: boolean, xlinkInfos?: IXLinkInfos): IIrParserResponse;
