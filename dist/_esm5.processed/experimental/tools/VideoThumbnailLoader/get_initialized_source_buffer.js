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
import { EMPTY, map, merge as observableMerge, mergeMap, of as observableOf, ReplaySubject, Subject, tap, } from "rxjs";
import prepareSourceBuffer from "./prepare_source_buffer";
var mediaSourceSubscription;
var sourceBufferContent;
var sourceBuffer$ = new ReplaySubject();
/**
 * Check if new content is the same from the already pushed init data
 * content
 * @param {Object} contentInfos
 * @returns {Boolean}
 */
function hasAlreadyPushedInitData(contentInfos) {
    var _a;
    if (sourceBufferContent === undefined) {
        return false;
    }
    var initSegment = contentInfos.representation.index.getInitSegment();
    var currentInitSegmentId = (_a = sourceBufferContent.representation.index.getInitSegment()) === null || _a === void 0 ? void 0 : _a.id;
    return (currentInitSegmentId === (initSegment === null || initSegment === void 0 ? void 0 : initSegment.id) &&
        contentInfos.representation.id === sourceBufferContent.representation.id &&
        contentInfos.adaptation.id === sourceBufferContent.adaptation.id &&
        contentInfos.period.id === sourceBufferContent.period.id &&
        contentInfos.manifest.id === sourceBufferContent.manifest.id);
}
/**
 * @param {Object} contentInfos
 * @param {Object} initSegment
 * @param {Object} sourceBuffer
 * @param {Function} segmentParser
 * @param {Function} segmentLoader
 * @returns {Object}
 */
function loadAndPushInitData(contentInfos, initSegment, sourceBuffer, segmentFetcher) {
    var segmentInfos = { manifest: contentInfos.manifest,
        period: contentInfos.period,
        adaptation: contentInfos.adaptation,
        representation: contentInfos.representation,
        segment: initSegment };
    return segmentFetcher(segmentInfos).pipe(mergeMap(function (evt) {
        if (evt.type !== "chunk") {
            return EMPTY;
        }
        var parsed = evt.parse();
        if (parsed.segmentType !== "init") {
            return EMPTY;
        }
        var initializationData = parsed.initializationData;
        var initSegmentData = initializationData instanceof ArrayBuffer ?
            new Uint8Array(initializationData) :
            initializationData;
        return sourceBuffer
            .pushChunk({ data: { initSegment: initSegmentData,
                chunk: null,
                appendWindow: [undefined, undefined],
                timestampOffset: 0,
                codec: contentInfos
                    .representation.getMimeTypeString() },
            inventoryInfos: null });
    }));
}
/**
 * Get video source buffer :
 * - If it is already created for the media element, then reuse it.
 * - Else, create a new one and load and append the init segment.
 * @param {Object} contentInfos
 * @param {HTMLVideoElement} element
 * @returns {Observable}
 */
export function getInitializedSourceBuffer$(contentInfos, element, segmentFetcher) {
    if (hasAlreadyPushedInitData(contentInfos)) {
        return sourceBuffer$;
    }
    var representation = contentInfos.representation;
    var mediaSourceError$ = new Subject();
    if (mediaSourceSubscription === undefined) {
        mediaSourceSubscription =
            prepareSourceBuffer(element, representation.getMimeTypeString())
                .subscribe({
                next: function (sourceBuffer) { return sourceBuffer$.next(sourceBuffer); },
                error: function (err) {
                    mediaSourceError$.next(new Error("VideoThumbnailLoaderError: Error when creating" +
                        " media source or source buffer: " + err.toString()));
                },
            });
    }
    return observableMerge(sourceBuffer$, mediaSourceError$.pipe(map(function (err) { throw err; }))).pipe(mergeMap(function (sourceBuffer) {
        var initSegment = representation.index.getInitSegment();
        if (initSegment === null) {
            return observableOf(sourceBuffer);
        }
        return loadAndPushInitData(contentInfos, initSegment, sourceBuffer, segmentFetcher)
            .pipe(map(function () { return sourceBuffer; }));
    }), tap(function () { sourceBufferContent = contentInfos; }));
}
/**
 * Reset the source buffers
 * @returns {void}
 */
export function disposeMediaSource() {
    sourceBufferContent = undefined;
    if (mediaSourceSubscription !== undefined) {
        mediaSourceSubscription.unsubscribe();
    }
    mediaSourceSubscription = undefined;
    sourceBuffer$ = new ReplaySubject();
}
