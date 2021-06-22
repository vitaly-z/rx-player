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

/** Options provided to every `startRepresentationPicker` */
export interface IABRThrottlers {
  limitVideoWidth? : Observable<number>;
  throttleVideo? : Observable<number>;
  throttleVideoBitrate? : Observable<number>;
}

export interface IRepresentationPickerControllerOptions {
  initialBitrates: Partial<Record<IBufferType, // Initial bitrate chosen, per
                                  number>>;    // type (minimum if not set)
  lowLatencyMode: boolean; // Some settings can depend on wether you're playing a
                           // low-latency content. Set it to `true` if you're playing
                           // such content.
  throttlers: IABRThrottlers; // Throttle from external events
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
    this._initialBitrates = options.initialBitrates;
    this._throttlers = options.throttlers;
    this._bandwidthEstimators = {};
    this._lowLatencyMode = options.lowLatencyMode;

    this._lockedAudioBitrate$ = new BehaviorSubject(-1);
    this._lockedVideoBitrate$ = new BehaviorSubject(-1);

    this._minAudioBitrate$ = new BehaviorSubject(0);
    this._maxAudioBitrate$ = new BehaviorSubject(Infinity);

    this._minVideoBitrate$ = new BehaviorSubject(0);
    this._maxVideoBitrate$ = new BehaviorSubject(Infinity);
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
