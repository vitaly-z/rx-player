import { EMPTY, } from "rxjs";
import { catchError, filter, take, } from "rxjs/operators";
import getCompleteSegmentId from "./get_complete_segment_id";
var requests = new Map();
/**
 * Create a request that is cancallable and which does not depends
 * on a specific task.
 * @param {Function} segmentLoader
 * @param {Object} contentInfos
 * @param {Object} segment
 * @returns {Object}
 */
export function createRequest(segmentLoader, contentInfos, segment) {
    var completeSegmentId = getCompleteSegmentId(contentInfos, segment);
    var lastRequest = requests.get(completeSegmentId);
    if (lastRequest !== undefined) {
        return lastRequest;
    }
    var subscription = segmentLoader({ manifest: contentInfos.manifest,
        period: contentInfos.period,
        adaptation: contentInfos.adaptation,
        representation: contentInfos.representation,
        segment: segment }).pipe(filter(function (evt) {
        return evt.type === "data";
    }), take(1), catchError(function (err) {
        _request.error = err;
        if (_request.onError !== undefined) {
            _request.onError(err);
        }
        return EMPTY;
    })).subscribe(function (evt) {
        _request.data = evt.value.responseData;
        if (_request.onData !== undefined) {
            _request.onData(evt.value.responseData);
        }
    });
    var _request = {
        cancel: function () { return subscription.unsubscribe(); },
    };
    requests.set(completeSegmentId, _request);
    return _request;
}
/**
 * Free requests :
 * - Cancel the subscription to the observable
 * - Delete the request from the requests Map.
 * @param {string} segmentId
 */
export function freeRequest(segmentId) {
    var request = requests.get(segmentId);
    if (request !== undefined) {
        request.cancel();
        requests.delete(segmentId);
    }
}
