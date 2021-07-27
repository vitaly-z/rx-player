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

import { areSameContent } from "../../../manifest";
import { IChunkContext } from "./types";

export type IBufferedHistoryElement = IBufferedHistoryInitialBufferedStartElement |
                                      IBufferedHistoryInitialBufferedEndElement;

export interface IBufferedHistoryInitialBufferedStartElement {
  type : BufferedHistoryElementType.InitialBufferedStart;
  date : number;
  bufferedStart : number;
  expectedStart : number;
  context : IChunkContext;
}

export interface IBufferedHistoryInitialBufferedEndElement {
  type : BufferedHistoryElementType.InitialBufferedEnd;
  date : number;
  bufferedEnd : number;
  expectedEnd : number;
  context : IChunkContext;
}

export const enum BufferedHistoryElementType {
  InitialBufferedStart = 0,
  InitialBufferedEnd = 1,
}

/**
 * Register a short-lived history of initial buffered information found linked
 * to a segment.
 *
 * @class BufferedInfoHistory
 */
export default class BufferedInfoHistory {
  private _history : IBufferedHistoryElement[];
  private _lifetime : number;
  private _maxHistoryLength : number;
  constructor(lifetime : number, maxHistoryLength : number) {
    this._history = [];
    this._lifetime = lifetime;
    this._maxHistoryLength = maxHistoryLength;
  }

  public setBufferedStart(
    context : IChunkContext,
    expectedStart : number,
    bufferedStart : number
  ) : void {
    const now = performance.now();
    this._history.push({ type: BufferedHistoryElementType.InitialBufferedStart,
                         date: now,
                         bufferedStart,
                         expectedStart,
                         context });
    this._cleanHistory(now);
  }

  public setBufferedEnd(
    context : IChunkContext,
    expectedEnd : number,
    bufferedEnd : number
  ) : void {
    const now = performance.now();
    this._history.push({ type: BufferedHistoryElementType.InitialBufferedEnd,
                         date: now,
                         bufferedEnd,
                         expectedEnd,
                         context });
    this._cleanHistory(now);
  }

  public getHistoryFor(
    context : IChunkContext
  ) : IBufferedHistoryElement[] {
    return this._history.filter(el => areSameContent(el.context, context));
  }

  private _cleanHistory(now : number) {
    const historyEarliestLimit = now - this._lifetime;
    let firstKeptIndex = 0;
    for (const element of this._history) {
      if (element.date < historyEarliestLimit) {
        firstKeptIndex++;
      } else {
        break;
      }
    }
    if (firstKeptIndex > 0) {
      this._history.splice(firstKeptIndex);
    }

    if (this._history.length > this._maxHistoryLength) {
      const toRemove = this._history.length - this._maxHistoryLength;
      this._history.splice(toRemove);
    }
  }
}
