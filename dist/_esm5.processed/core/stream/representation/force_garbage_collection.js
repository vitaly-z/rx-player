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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import config from "../../../config";
import log from "../../../log";
import { getInnerAndOuterTimeRanges } from "../../../utils/ranges";
/**
 * Run the garbage collector.
 *
 * Try to clean up buffered ranges from a low gcGap at first.
 * If it does not succeed to clean up space, use a higher gcCap.
 *
 * @param {number} currentPosition
 * @param {Object} bufferingQueue
 * @param {Object} cancellationSignal
 * @returns {Promise}
 */
export default function forceGarbageCollection(currentPosition, bufferingQueue, cancellationSignal) {
    return __awaiter(this, void 0, void 0, function () {
        var GC_GAP_CALM, GC_GAP_BEEFY, buffered, cleanedupRanges, _i, cleanedupRanges_1, range, start, end;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    GC_GAP_CALM = config.getCurrent().BUFFER_GC_GAPS.CALM;
                    GC_GAP_BEEFY = config.getCurrent().BUFFER_GC_GAPS.BEEFY;
                    log.warn("Stream: Running garbage collector");
                    buffered = bufferingQueue.getBufferedRanges();
                    cleanedupRanges = selectGCedRanges(currentPosition, buffered, GC_GAP_CALM);
                    // more aggressive GC if we could not find any range to clean
                    if (cleanedupRanges.length === 0) {
                        cleanedupRanges = selectGCedRanges(currentPosition, buffered, GC_GAP_BEEFY);
                    }
                    if (log.hasLevel("DEBUG")) {
                        log.debug("Stream: GC cleaning", cleanedupRanges.map(function (_a) {
                            var start = _a.start, end = _a.end;
                            return "start: ".concat(start, " - end ").concat(end);
                        })
                            .join(", "));
                    }
                    _i = 0, cleanedupRanges_1 = cleanedupRanges;
                    _a.label = 1;
                case 1:
                    if (!(_i < cleanedupRanges_1.length)) return [3 /*break*/, 4];
                    range = cleanedupRanges_1[_i];
                    start = range.start, end = range.end;
                    if (!(start < end)) return [3 /*break*/, 3];
                    return [4 /*yield*/, bufferingQueue.removeBuffer(start, end, cancellationSignal)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Buffer garbage collector algorithm.
 *
 * Tries to free up some part of the ranges that are distant from the current
 * playing time.
 * See: https://w3c.github.io/media-source/#sourcebuffer-prepare-append
 *
 * @param {Number} position
 * @param {TimeRanges} buffered - current buffered ranges
 * @param {Number} gcGap - delta gap from current timestamp from which we
 * should consider cleaning up.
 * @returns {Array.<Object>} - Ranges selected for clean up
 */
function selectGCedRanges(position, buffered, gcGap) {
    var _a = getInnerAndOuterTimeRanges(buffered, position), innerRange = _a.innerRange, outerRanges = _a.outerRanges;
    var cleanedupRanges = [];
    // start by trying to remove all ranges that do not contain the
    // current time and respect the gcGap
    for (var i = 0; i < outerRanges.length; i++) {
        var outerRange = outerRanges[i];
        if (position - gcGap > outerRange.end) {
            cleanedupRanges.push(outerRange);
        }
        else if (position + gcGap < outerRange.start) {
            cleanedupRanges.push(outerRange);
        }
    }
    // try to clean up some space in the current range
    if (innerRange !== null) {
        if (log.hasLevel("DEBUG")) {
            log.debug("Stream: GC removing part of inner range", cleanedupRanges.map(function (_a) {
                var start = _a.start, end = _a.end;
                return "start: ".concat(start, " - end ").concat(end);
            })
                .join(", "));
        }
        if (position - gcGap > innerRange.start) {
            cleanedupRanges.push({ start: innerRange.start,
                end: position - gcGap });
        }
        if (position + gcGap < innerRange.end) {
            cleanedupRanges.push({ start: position + gcGap,
                end: innerRange.end });
        }
    }
    return cleanedupRanges;
}
