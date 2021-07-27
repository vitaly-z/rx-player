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
import { IChunkContext } from "./types";
export declare type IBufferedHistoryElement = IBufferedHistoryInitialBufferedStartElement | IBufferedHistoryInitialBufferedEndElement;
export interface IBufferedHistoryInitialBufferedStartElement {
    type: BufferedHistoryElementType.InitialBufferedStart;
    date: number;
    bufferedStart: number;
    expectedStart: number;
    context: IChunkContext;
}
export interface IBufferedHistoryInitialBufferedEndElement {
    type: BufferedHistoryElementType.InitialBufferedEnd;
    date: number;
    bufferedEnd: number;
    expectedEnd: number;
    context: IChunkContext;
}
export declare const enum BufferedHistoryElementType {
    InitialBufferedStart = 0,
    InitialBufferedEnd = 1
}
/**
 * Register a short-lived history of initial buffered information found linked
 * to a segment.
 *
 * @class BufferedInfoHistory
 */
export default class BufferedInfoHistory {
    private _history;
    private _lifetime;
    private _maxHistoryLength;
    constructor(lifetime: number, maxHistoryLength: number);
    setBufferedStart(context: IChunkContext, expectedStart: number, bufferedStart: number): void;
    setBufferedEnd(context: IChunkContext, expectedEnd: number, bufferedEnd: number): void;
    getHistoryFor(context: IChunkContext): IBufferedHistoryElement[];
    private _cleanHistory;
}
