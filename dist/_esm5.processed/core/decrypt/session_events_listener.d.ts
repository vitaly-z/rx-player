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
import { Observable } from "rxjs";
import { ICustomMediaKeySession } from "../../compat";
import { ICustomError } from "../../errors";
import { IEMEWarningEvent, IKeySystemOption } from "./types";
/**
 * Error thrown when the MediaKeySession is blacklisted.
 * Such MediaKeySession should not be re-used but other MediaKeySession for the
 * same content can still be used.
 * @class BlacklistedSessionError
 * @extends Error
 */
export declare class BlacklistedSessionError extends Error {
    sessionError: ICustomError;
    constructor(sessionError: ICustomError);
}
/**
 * listen to various events from a MediaKeySession and react accordingly
 * depending on the configuration given.
 * @param {MediaKeySession} session - The MediaKeySession concerned.
 * @param {Object} keySystemOptions - The key system options.
 * @param {String} keySystem - The configuration keySystem used for deciphering
 * @returns {Observable}
 */
export default function SessionEventsListener(session: MediaKeySession | ICustomMediaKeySession, keySystemOptions: IKeySystemOption, keySystem: string): Observable<IEMEWarningEvent | IKeysUpdateEvent>;
/**
 * Some key ids have updated their status.
 *
 * We put them in two different list:
 *
 *   - `blacklistedKeyIDs`: Those key ids won't be used for decryption and the
 *     corresponding media it decrypts should not be pushed to the buffer
 *     Note that a blacklisted key id can become whitelisted in the future.
 *
 *   - `whitelistedKeyIds`: Those key ids were found and their corresponding
 *     keys are now being considered for decryption.
 *     Note that a whitelisted key id can become blacklisted in the future.
 *
 * Note that each `IKeysUpdateEvent` is independent of any other.
 *
 * A new `IKeysUpdateEvent` does not completely replace a previously emitted
 * one, as it can for example be linked to a whole other decryption session.
 *
 * However, if a key id is encountered in both an older and a newer
 * `IKeysUpdateEvent`, only the older status should be considered.
 */
export interface IKeysUpdateEvent {
    type: "keys-update";
    value: IKeyUpdateValue;
}
/** Information on key ids linked to a MediaKeySession. */
export interface IKeyUpdateValue {
    /**
     * The list of key ids that are blacklisted.
     * As such, their corresponding keys won't be used by that session, despite
     * the fact that they were part of the pushed license.
     *
     * Reasons for blacklisting a keys depend on options, but mainly involve unmet
     * output restrictions and CDM internal errors linked to that key id.
     */
    blacklistedKeyIDs: Uint8Array[];
    whitelistedKeyIds: Uint8Array[];
}
