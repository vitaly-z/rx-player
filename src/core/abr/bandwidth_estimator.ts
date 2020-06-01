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

import config from "../../config";
import EWMA from "./ewma";

const { ABR_MINIMUM_TOTAL_BYTES,
        ABR_MINIMUM_CHUNK_SIZE,
        ABR_FAST_EMA,
        ABR_SLOW_EMA } = config;

/**
 * Calculate a mean bandwidth based on the bytes downloaded and the amount
 * of time needed to do so.
 *
 * Heavily "inspired" from the Shaka-Player's "ewma bandwidth estimator".
 * @class BandwidthEstimator
 */
export default class BandwidthEstimator {
  private _fastEWMA : EWMA;
  private _slowEWMA : EWMA;
  private _bytesSampled : number;
  private _lowLatencyMode : boolean;
  private _lowLatencyBandwidthBuffer: number[];

  constructor(lowLatencyMode: boolean) {
    /**
     * A fast-moving average.
     * @private
     */
    this._fastEWMA = new EWMA(ABR_FAST_EMA);

    /**
     * A slow-moving average.
     * @private
     */
    this._slowEWMA = new EWMA(ABR_SLOW_EMA);

    /**
     * Number of bytes sampled.
     * @private
     */
    this._bytesSampled = 0;

    /**
     * If in low latency mode, maintain an estimation that takes into account
     * that the bandwidth may be limited by server.
     */
    this._lowLatencyMode = lowLatencyMode;

    /**
     * Array that contains the last three bandwidth estimations made with low latency
     * chunks.
     */
    this._lowLatencyBandwidthBuffer = [];
  }

  /**
   * Takes a bandwidth sample.
   * @param {number} durationMs - The amount of time, in milliseconds, for a
   *   particular request.
   * @param {number} numBytes - The total number of bytes transferred in that
   *   request.
   * @param {Boolean} isChunk - Tells if the sample is a chunk from media segment
   */
  public addSample(durationInMs : number,
                   numberOfBytes : number,
                   isChunk: boolean) : void {
    const bandwidth = numberOfBytes * 8000 / durationInMs;
    if (isChunk &&
        this._lowLatencyMode &&
        !this._shouldConsiderLowLatencySample(bandwidth)) {
      return;
    }

    if (numberOfBytes < ABR_MINIMUM_CHUNK_SIZE) {
      return;
    }
    const weight = durationInMs / 1000;
    this._bytesSampled += numberOfBytes;

    this._fastEWMA.addSample(weight, bandwidth);
    this._slowEWMA.addSample(weight, bandwidth);
  }

  /**
   * Get estimate of the bandwidth, in bits per seconds.
   * @param {Boolean} bandwidthMayBeServerLimited
   * @returns {Number|undefined}
   */
  public getEstimate() : number|undefined {
    if (this._bytesSampled < ABR_MINIMUM_TOTAL_BYTES) {
      return undefined;
    }

    // Take the minimum of these two estimates.  This should have the effect of
    // adapting down quickly, but up more slowly.
    return Math.min(this._fastEWMA.getEstimate(),
                    this._slowEWMA.getEstimate());
  }

  /**
   * Reset the bandwidth estimation.
   */
  public reset() : void {
    this._fastEWMA = new EWMA(ABR_FAST_EMA);
    this._slowEWMA = new EWMA(ABR_SLOW_EMA);
    this._lowLatencyBandwidthBuffer = [];
    this._bytesSampled = 0;
  }

  /**
   * Add a sample to the low latency bandwidth buffer.
   * @param {Number} bandwidth
   */
  private _shouldConsiderLowLatencySample(bandwidth: number): boolean {
    const lastEstimatedBandwidth = this._getMeanOfLastLowLatencyBandwidth();
    if (lastEstimatedBandwidth !== undefined &&
        bandwidth > (lastEstimatedBandwidth * 0.8) &&
        bandwidth <= lastEstimatedBandwidth) {
      return false;
    }
    this._lowLatencyBandwidthBuffer.push(bandwidth);
    if (this._lowLatencyBandwidthBuffer.length > 3) {
      this._lowLatencyBandwidthBuffer.shift();
    }
    return true;
  }

  /**
   * Get bandwidth estimate from low latency chunks
   * @returns {Number|undefined}
   */
  private _getMeanOfLastLowLatencyBandwidth(): number|undefined {
    if (this._lowLatencyBandwidthBuffer.length < 3) {
      return undefined;
    }
    return this._lowLatencyBandwidthBuffer.reduce((acc: number, val) => acc + val, 0) /
           this._lowLatencyBandwidthBuffer.length;
  }
}
