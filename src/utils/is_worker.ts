/* eslint-disable @typescript-eslint/no-explicit-any */

declare const WorkerGlobalScope : any | undefined;

/**
 * Returns true if the current code is running in a Web Worker.
 * @returns {boolean}
 */
export default function isWorker() : boolean {
  return typeof WorkerGlobalScope !== "undefined" &&
         self instanceof WorkerGlobalScope;
}
