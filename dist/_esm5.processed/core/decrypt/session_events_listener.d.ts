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
import { IKeySystemOption, IPlayerError } from "../../public_types";
import { IEMEWarningEvent } from "./types";
/**
 * Error thrown when the MediaKeySession is blacklisted.
 * Such MediaKeySession should not be re-used but other MediaKeySession for the
 * same content can still be used.
 * @class BlacklistedSessionError
 * @extends Error
 */
export declare class BlacklistedSessionError extends Error {
    sessionError: IPlayerError;
    constructor(sessionError: IPlayerError);
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
 * Some key ids related to the current MediaKeySession have updated their
 * statuses.
 *
 * Note that each `IKeysUpdateEvent` is independent of any other.
 *
 * A new `IKeysUpdateEvent` does not completely replace a previously emitted
 * one, as it can for example be linked to a whole other decryption session.
 *
 * However, if a key id is encountered in both an older and a newer
 * `IKeysUpdateEvent`, only the newer, updated, status should be considered.
 */
export interface IKeysUpdateEvent {
    type: "keys-update";
    value: IKeyUpdateValue;
}
/** Information on key ids linked to a MediaKeySession. */
export interface IKeyUpdateValue {
    /**
     * The list of key ids linked to the corresponding MediaKeySession that are
     * now "blacklisted", i.e. the decryption keys they are linked to are blocked
     * from ever being used anymore.
     *
     * Blacklisted key ids correspond to keys linked to a MediaKeySession that
     * cannot and should not be used, due to various reasons, which mainly involve
     * unmet output restrictions and CDM internal errors linked to that key.
     *
     * Content linked to key ids in `blacklistedKeyIds` should be refrained from
     * being used.
     *
     * Note that a key id may only be blacklisted temporarily.
     */
    blacklistedKeyIds: Uint8Array[];
    whitelistedKeyIds: Uint8Array[];
}
