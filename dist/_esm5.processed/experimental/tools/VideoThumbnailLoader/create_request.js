import { catchError, EMPTY, filter, take, } from "rxjs";
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
export function createRequest(segmentFetcher, contentInfos, segment) {
    var completeSegmentId = getCompleteSegmentId(contentInfos, segment);
    var lastRequest = requests.get(completeSegmentId);
    if (lastRequest !== undefined) {
        return lastRequest;
    }
    var _request = {
        cancel: function () {
            subscription.unsubscribe();
            this.isComplete = true;
        },
        isComplete: false,
    };
    var subscription = segmentFetcher({ manifest: contentInfos.manifest,
        period: contentInfos.period,
        adaptation: contentInfos.adaptation,
        representation: contentInfos.representation, segment: segment }).pipe(filter(function (evt) {
        return evt.type === "chunk" ||
            evt.type === "chunk-complete";
    }), take(1), catchError(function (err) {
        _request.error = err;
        if (_request.onError !== undefined) {
            _request.onError(err);
        }
        _request.isComplete = true;
        return EMPTY;
    })).subscribe(function (evt) {
        if (evt.type === "chunk-complete") {
            if (_request.onComplete !== undefined) {
                _request.onComplete();
                _request.isComplete = true;
            }
        }
        else {
            var parsed = evt.parse();
            _request.data = parsed;
            if (_request.onData !== undefined) {
                _request.onData(parsed);
            }
        }
    });
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
