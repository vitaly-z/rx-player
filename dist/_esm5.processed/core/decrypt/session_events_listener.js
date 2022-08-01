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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { catchError, concat as observableConcat, concatMap, defer as observableDefer, EMPTY, identity, ignoreElements, map, merge as observableMerge, mergeMap, of as observableOf, Subject, tap, takeUntil, timeout, TimeoutError, } from "rxjs";
import { events, } from "../../compat";
import { EncryptedMediaError } from "../../errors";
import log from "../../log";
import castToObservable from "../../utils/cast_to_observable";
import isNonEmptyString from "../../utils/is_non_empty_string";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import retryObsWithBackoff from "../../utils/rx-retry_with_backoff";
import tryCatch from "../../utils/rx-try_catch";
import checkKeyStatuses from "./utils/check_key_statuses";
var onKeyError$ = events.onKeyError$, onKeyMessage$ = events.onKeyMessage$, onKeyStatusesChange$ = events.onKeyStatusesChange$;
/**
 * Error thrown when the MediaKeySession is blacklisted.
 * Such MediaKeySession should not be re-used but other MediaKeySession for the
 * same content can still be used.
 * @class BlacklistedSessionError
 * @extends Error
 */
var BlacklistedSessionError = /** @class */ (function (_super) {
    __extends(BlacklistedSessionError, _super);
    function BlacklistedSessionError(sessionError) {
        var _this = _super.call(this) || this;
        // @see https://stackoverflow.com/questions/41102060/typescript-extending-error-class
        Object.setPrototypeOf(_this, BlacklistedSessionError.prototype);
        _this.sessionError = sessionError;
        return _this;
    }
    return BlacklistedSessionError;
}(Error));
export { BlacklistedSessionError };
/**
 * listen to various events from a MediaKeySession and react accordingly
 * depending on the configuration given.
 * @param {MediaKeySession} session - The MediaKeySession concerned.
 * @param {Object} keySystemOptions - The key system options.
 * @param {String} keySystem - The configuration keySystem used for deciphering
 * @returns {Observable}
 */
export default function SessionEventsListener(session, keySystemOptions, keySystem) {
    log.info("DRM: Binding session events", session.sessionId);
    var sessionWarningSubject$ = new Subject();
    var _a = keySystemOptions.getLicenseConfig, getLicenseConfig = _a === void 0 ? {} : _a;
    var keyErrors = onKeyError$(session).pipe(map(function (error) {
        throw new EncryptedMediaError("KEY_ERROR", error.type);
    }));
    var keyStatusesChange$ = onKeyStatusesChange$(session)
        .pipe(mergeMap(function (keyStatusesEvent) {
        return handleKeyStatusesChangeEvent(session, keySystemOptions, keySystem, keyStatusesEvent);
    }));
    var keyMessages$ = onKeyMessage$(session).pipe(mergeMap(function (messageEvent) {
        var message = new Uint8Array(messageEvent.message);
        var messageType = isNonEmptyString(messageEvent.messageType) ?
            messageEvent.messageType :
            "license-request";
        log.info("DRM: Received message event, type ".concat(messageType), session.sessionId);
        var getLicense$ = observableDefer(function () {
            var getLicense = keySystemOptions.getLicense(message, messageType);
            var getLicenseTimeout = isNullOrUndefined(getLicenseConfig.timeout) ?
                10 * 1000 :
                getLicenseConfig.timeout;
            return castToObservable(getLicense)
                .pipe(getLicenseTimeout >= 0 ? timeout(getLicenseTimeout) :
                identity /* noop */);
        });
        var backoffOptions = getLicenseBackoffOptions(sessionWarningSubject$, getLicenseConfig.retry);
        return retryObsWithBackoff(getLicense$, backoffOptions).pipe(map(function (licenseObject) { return ({
            type: "key-message-handled",
            value: { session: session, license: licenseObject },
        }); }), catchError(function (err) {
            var formattedError = formatGetLicenseError(err);
            if (!isNullOrUndefined(err)) {
                var fallbackOnLastTry = err.fallbackOnLastTry;
                if (fallbackOnLastTry === true) {
                    log.warn("DRM: Last `getLicense` attempt failed. " +
                        "Blacklisting the current session.");
                    throw new BlacklistedSessionError(formattedError);
                }
            }
            throw formattedError;
        }));
    }));
    var sessionUpdates = observableMerge(keyMessages$, keyStatusesChange$)
        .pipe(concatMap(function (evt) {
        switch (evt.type) {
            case "key-message-handled":
            case "key-status-change-handled":
                if (isNullOrUndefined(evt.value.license)) {
                    log.info("DRM: No message given, skipping session.update");
                    return EMPTY;
                }
                return updateSessionWithMessage(session, evt.value.license);
            default:
                return observableOf(evt);
        }
    }));
    var sessionEvents = observableMerge(getKeyStatusesEvents(session, keySystemOptions, keySystem), sessionUpdates, keyErrors, sessionWarningSubject$);
    return !isNullOrUndefined(session.closed) ?
        sessionEvents
            // TODO There is a subtle TypeScript issue there that made casting
            // to a type-compatible type mandatory. If a more elegant solution
            // can be found, it should be preffered.
            .pipe(takeUntil(castToObservable(session.closed))) :
        sessionEvents;
}
/**
 * Check current MediaKeyStatus for each key in the given MediaKeySession and
 * return an Observable which either:
 *    - throw if at least one status is a non-recoverable error
 *    - emit warning events for recoverable errors
 *    - emit blacklist-keys events for key IDs that are not decipherable
 * @param {MediaKeySession} session - The MediaKeySession concerned.
 * @param {Object} options - Options related to key statuses checks.
 * @param {String} keySystem - The name of the key system used for deciphering
 * @returns {Observable}
 */
function getKeyStatusesEvents(session, options, keySystem) {
    return observableDefer(function () {
        if (session.keyStatuses.size === 0) {
            return EMPTY;
        }
        var _a = checkKeyStatuses(session, options, keySystem), warnings = _a.warnings, blacklistedKeyIDs = _a.blacklistedKeyIDs, whitelistedKeyIds = _a.whitelistedKeyIds;
        var warnings$ = warnings.length > 0 ? observableOf.apply(void 0, warnings) :
            EMPTY;
        var keysUpdate$ = observableOf({ type: "keys-update",
            value: { whitelistedKeyIds: whitelistedKeyIds, blacklistedKeyIDs: blacklistedKeyIDs } });
        return observableConcat(warnings$, keysUpdate$);
    });
}
/**
 * Format an error returned by a `getLicense` call to a proper form as defined
 * by the RxPlayer's API.
 * @param {*} error
 * @returns {Error}
 */
function formatGetLicenseError(error) {
    if (error instanceof TimeoutError) {
        return new EncryptedMediaError("KEY_LOAD_TIMEOUT", "The license server took too much time to " +
            "respond.");
    }
    var err = new EncryptedMediaError("KEY_LOAD_ERROR", "An error occured when calling `getLicense`.");
    if (!isNullOrUndefined(error) &&
        isNonEmptyString(error.message)) {
        err.message = error.message;
    }
    return err;
}
/**
 * Call MediaKeySession.update with the given `message`, if defined.
 * Returns the right event depending on the action taken.
 * @param {MediaKeySession} session
 * @param {ArrayBuffer|TypedArray|null} message
 * @returns {Observable}
 */
function updateSessionWithMessage(session, message) {
    log.info("DRM: Updating MediaKeySession with message");
    return castToObservable(session.update(message)).pipe(catchError(function (error) {
        var reason = error instanceof Error ? error.toString() :
            "`session.update` failed";
        throw new EncryptedMediaError("KEY_UPDATE_ERROR", reason);
    }), tap(function () { log.info("DRM: MediaKeySession update succeeded."); }), 
    // NOTE As of now (RxJS 7.4.0), RxJS defines `ignoreElements` default
    // first type parameter as `any` instead of the perfectly fine `unknown`,
    // leading to linter issues, as it forbids the usage of `any`.
    // This is why we're disabling the eslint rule.
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-argument */
    ignoreElements());
}
/**
 * @param {MediaKeySession}
 * @param {Object} keySystem
 * @param {Event} keyStatusesEvent
 * @returns {Observable}
 */
function handleKeyStatusesChangeEvent(session, keySystemOptions, keySystem, keyStatusesEvent) {
    log.info("DRM: keystatuseschange event received", session.sessionId);
    var callback$ = observableDefer(function () {
        return tryCatch(function () {
            if (typeof keySystemOptions.onKeyStatusesChange !== "function") {
                return EMPTY;
            }
            return castToObservable(keySystemOptions.onKeyStatusesChange(keyStatusesEvent, session));
        }, undefined);
    }).pipe(map(function (licenseObject) { return ({ type: "key-status-change-handled",
        value: { session: session, license: licenseObject } }); }), catchError(function (error) {
        var err = new EncryptedMediaError("KEY_STATUS_CHANGE_ERROR", "Unknown `onKeyStatusesChange` error");
        if (!isNullOrUndefined(error) &&
            isNonEmptyString(error.message)) {
            err.message = error.message;
        }
        throw err;
    }));
    return observableMerge(getKeyStatusesEvents(session, keySystemOptions, keySystem), callback$);
}
/**
 * Construct backoff options for the getLicense call.
 * @param {Subject} sessionWarningSubject$ - Subject through which retry
 * warnings will be sent.
 * @param {number|undefined} numberOfRetry - Maximum of amount retried.
 * Equal to `2` if not defined.
 * @returns {Object}
 */
function getLicenseBackoffOptions(sessionWarningSubject$, numberOfRetry) {
    return {
        totalRetry: numberOfRetry !== null && numberOfRetry !== void 0 ? numberOfRetry : 2,
        baseDelay: 200,
        maxDelay: 3000,
        shouldRetry: function (error) { return error instanceof TimeoutError ||
            isNullOrUndefined(error) ||
            error.noRetry !== true; },
        onRetry: function (error) {
            return sessionWarningSubject$.next({ type: "warning",
                value: formatGetLicenseError(error) });
        },
    };
}
