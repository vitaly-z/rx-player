import { combineLatest, Observable } from "rxjs";
import { createRequest, freeRequest } from "./create_request";
import getCompleteSegmentId from "./get_complete_segment_id";
/**
 * Load needed segments, from already running requests or by running new ones.
 * @param {Array.<Object>} segments
 * @param {Map} currentRequests
 * @param {Function} segmentLoader
 * @param {Object} contentInfos
 * @returns {Object}
 */
export default function loadSegments(segments, segmentLoader, contentInfos) {
    return combineLatest(segments.map(function (segment) {
        return new Observable(function (obs) {
            var completeSegmentId = getCompleteSegmentId(contentInfos, segment);
            var request = createRequest(segmentLoader, contentInfos, segment);
            if (request.error !== undefined) {
                freeRequest(completeSegmentId);
                obs.error(request.error);
                return;
            }
            request.onError = function (err) {
                freeRequest(completeSegmentId);
                obs.error(err);
            };
            if (request.data !== undefined) {
                obs.next({ data: request.data, segment: segment });
                obs.complete();
                return;
            }
            request.onData = function (data) {
                obs.next({ data: data, segment: segment });
                obs.complete();
            };
        });
    }));
}
