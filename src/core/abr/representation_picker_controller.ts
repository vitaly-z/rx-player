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

import {
  BehaviorSubject,
  EMPTY,
  Observable,
  of as observableOf,
} from "rxjs";
import log from "../../log";
import { Representation } from "../../manifest";
import takeFirstSet from "../../utils/take_first_set";
import { IBufferType } from "../segment_buffers";
import BandwidthEstimator from "./bandwidth_estimator";
import createFilters from "./create_filters";
import startRepresentationPicker, {
  IABREstimate,
  IABRStreamEvents,
  IRepresentationPickerClockTick,
} from "./representation_picker";

/** Options given to the RepresentationPickerController. */
export interface IRepresentationPickerControllerOptions {
  /**
   * Initial bitrate calculation, for each type of buffer.
   */
  initialBitrates: Partial<Record<IBufferType, number>>;
  /**
   * If `true` the current content run in "lowLatencyMode", i.e. it's a special
   * content played very close to the live edge.
   * Some settings or adaptative logic depend on that status.
   */
  lowLatencyMode: boolean;
  /**
   * Observables allowing to limit the choice of Representations that can be
   * automatically switched to.
   */
  throttlers: IABRThrottlers;
  /**
   * Initial value for the `minAudioBitrate`, that is the minimum audio bitrate
   * the adaptative logic can automatically switch to, unless there's no other
   * choice.
   */
  minAudioBitrate? : number;
  /**
   * Initial value for the `minVideoBitrate`, that is the minimum video bitrate
   * the adaptative logic can automatically switch to, unless there's no other
   * choice.
   */
  minVideoBitrate? : number;
  /**
   * Initial value for the `maxAudioBitrate`, that is the maximum audio bitrate
   * the adaptative logic can automatically switch to, unless there's no other
   * choice.
   */
  maxAudioBitrate? : number;
  /**
   * Initial value for the `maxVideoBitrate`, that is the maximum video bitrate
   * the adaptative logic can automatically switch to, unless there's no other
   * choice.
   */
  maxVideoBitrate? : number;
  /**
   * If set to a value of `-1`, the adaptative logic will only switch to an
   * audio Representation with a bitrate immediately lower or equal to that
   * value, or to the lowest bitrate if the former is impossible.
   */
  lockedAudioBitrate? : number;
  /**
   * If set to a value of `-1`, the adaptative logic will only switch to a
   * video Representation with a bitrate immediately lower or equal to that
   * value, or to the lowest bitrate if the former is impossible.
   */
  lockedVideoBitrate? : number;
}

/** Collection of Observables allowing to reduce the choice of Representations. */
export interface IABRThrottlers {
  /**
   * Emit the maximum width the application seems to be able to show for now.
   * If multiple Representations have a width higher than this value, only the
   * one immediately higher (can still be multiple ones in cases of width
   * equality) might be automatically switched to.
   */
  limitVideoWidth? : Observable<number>;
  /**
   * This option is deprecated, but is roughly synonymous to
   * `throttleVideoBitrate`.
   */
  throttleVideo? : Observable<number>;
  /**
   * Emit the maximum bitrate for video tracks the adaptative logic can switch
   * to.
   * This might be used for example when the video element is detected to be
   * offscreen.
   */
  throttleVideoBitrate? : Observable<number>;
}

/**
 * Class helping to select a Representation (a.k.a. profile or quality) from
 * sets of multiple Representations.
 *
 * This choice is made from multiple inputs.
 * Most notably:
 *   - the current network conditions
 *   - the current buffer health
 *   - the user preferences
 *
 * @class RepresentationPickerController
 */
export default class RepresentationPickerController {
  private _bandwidthEstimators : Partial<Record<IBufferType, BandwidthEstimator>>;
  private _lockedAudioBitrate$ : BehaviorSubject<number>;
  private _lockedVideoBitrate$ : BehaviorSubject<number>;
  private _minAudioBitrate$ : BehaviorSubject<number>;
  private _maxAudioBitrate$ : BehaviorSubject<number>;
  private _minVideoBitrate$ : BehaviorSubject<number>;
  private _maxVideoBitrate$ : BehaviorSubject<number>;
  private _initialBitrates : Partial<Record<IBufferType, number>>;
  private _throttlers : IABRThrottlers;
  private _lowLatencyMode : boolean;

  /**
   * @param {Object} options
   */
  constructor(options : IRepresentationPickerControllerOptions) {
    const { initialBitrates,
            lowLatencyMode,
            throttlers,
            minAudioBitrate,
            minVideoBitrate,
            maxAudioBitrate,
            maxVideoBitrate,
            lockedAudioBitrate,
            lockedVideoBitrate } = options;
    this._initialBitrates = initialBitrates;
    this._throttlers = throttlers;
    this._bandwidthEstimators = {};
    this._lowLatencyMode = lowLatencyMode;

    this._lockedAudioBitrate$ = new BehaviorSubject(lockedAudioBitrate ?? -1);
    this._lockedVideoBitrate$ = new BehaviorSubject(lockedVideoBitrate ?? -1);

    this._minAudioBitrate$ = new BehaviorSubject(minAudioBitrate ?? 0);
    this._maxAudioBitrate$ = new BehaviorSubject(maxAudioBitrate ?? Infinity);

    this._minVideoBitrate$ = new BehaviorSubject(minVideoBitrate ?? 0);
    this._maxVideoBitrate$ = new BehaviorSubject(maxVideoBitrate ?? Infinity);
  }

  /**
   * Take type and an array of the available representations, spit out an
   * observable emitting the best representation (given the network/buffer
   * state).
   * @param {string} bufferType
   * @param {Array.<Representation>} representations
   * @param {Observable<Object>} clock$
   * @param {Observable<Object>} streamEvents$
   * @returns {Observable}
   */
  public startPicker(
    bufferType : IBufferType,
    representations : Representation[],
    clock$ : Observable<IRepresentationPickerClockTick>,
    streamEvents$ : Observable<IABRStreamEvents>
  ) : Observable<IABREstimate> {
    const bandwidthEstimator = this._getBandwidthEstimator(bufferType);
    const initialBitrate = takeFirstSet<number>(this._initialBitrates[bufferType], 0);
    const filters$ = bufferType === "video" ?
       createFilters(this._throttlers.limitVideoWidth,
                     this._throttlers.throttleVideoBitrate,
                     this._throttlers.throttleVideo) :
       EMPTY;

    let manualBitrate$;
    let minAutoBitrate$;
    let maxAutoBitrate$;
    switch (bufferType) {
      case "audio":
        manualBitrate$ = this._lockedAudioBitrate$;
        minAutoBitrate$ = this._minAudioBitrate$;
        maxAutoBitrate$ = this._maxAudioBitrate$;
        break;
      case "video":
        manualBitrate$ = this._lockedVideoBitrate$;
        minAutoBitrate$ = this._minVideoBitrate$;
        maxAutoBitrate$ = this._maxVideoBitrate$;
        break;
      default:
        manualBitrate$ = observableOf(-1);
        minAutoBitrate$ = observableOf(0);
        maxAutoBitrate$ = observableOf(Infinity);
        break;
    }

    return startRepresentationPicker({ bandwidthEstimator,
                                       streamEvents$,
                                       clock$,
                                       filters$,
                                       initialBitrate,
                                       manualBitrate$,
                                       minAutoBitrate$,
                                       maxAutoBitrate$,
                                       representations,
                                       lowLatencyMode: this._lowLatencyMode });
  }

  public lockAudioBitrate(bitrate : number) : void {
    this._lockedAudioBitrate$.next(bitrate);
  }

  public lockVideoBitrate(bitrate : number) : void {
    this._lockedVideoBitrate$.next(bitrate);
  }

  public getLockedAudioBitrate() : number {
    return this._lockedAudioBitrate$.getValue();
  }

  public getLockedVideoBitrate() : number {
    return this._lockedVideoBitrate$.getValue();
  }

  public setMinAudioBitrate(bitrate : number) : void {
    this._minAudioBitrate$.next(bitrate);
  }

  public setMaxAudioBitrate(bitrate : number) : void {
    this._maxAudioBitrate$.next(bitrate);
  }

  public getMinAudioBitrate() : number {
    return this._minAudioBitrate$.getValue();
  }

  public getMaxAudioBitrate() : number {
    return this._maxAudioBitrate$.getValue();
  }

  public setMinVideoBitrate(bitrate : number) : void {
    this._minVideoBitrate$.next(bitrate);
  }

  public setMaxVideoBitrate(bitrate : number) : void {
    this._maxVideoBitrate$.next(bitrate);
  }

  public getMinVideoBitrate() : number {
    return this._minVideoBitrate$.getValue();
  }

  public getMaxVideoBitrate() : number {
    return this._maxVideoBitrate$.getValue();
  }

  /**
   * @param {string} bufferType
   * @returns {Object}
   */
  private _getBandwidthEstimator(bufferType : IBufferType) : BandwidthEstimator {
    const originalBandwidthEstimator = this._bandwidthEstimators[bufferType];
    if (originalBandwidthEstimator == null) {
      log.debug("ABR: Creating new BandwidthEstimator for ", bufferType);
      const bandwidthEstimator = new BandwidthEstimator();
      this._bandwidthEstimators[bufferType] = bandwidthEstimator;
      return bandwidthEstimator;
    }
    return originalBandwidthEstimator;
  }
}
