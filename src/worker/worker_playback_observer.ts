// XXX TODO better import
import { IReadOnlyPlaybackObserver } from "../core/api";
import { generateReadOnlyObserver } from "../core/api/playback_observer";
import log from "../log";
import { IWorkerPlaybackObservation } from "../main";
import { IReadOnlySharedReference } from "../utils/reference";
import { CancellationSignal } from "../utils/task_canceller";

export default class WorkerPlaybackObserver implements IReadOnlyPlaybackObserver<
  IWorkerPlaybackObservation
> {
  private _src : IReadOnlySharedReference<IWorkerPlaybackObservation>;
  private _cancelSignal : CancellationSignal;

  constructor(
    src : IReadOnlySharedReference<IWorkerPlaybackObservation>,
    cancellationSignal : CancellationSignal
  ) {
    this._src = src;
    this._cancelSignal = cancellationSignal;
  }

  public getCurrentTime() : number {
    // XXX TODO probably should be async or removed
    return this._src.getValue().position.last;
  }

  public getReadyState() : number {
    // XXX TODO probably should be async or removed
    return this._src.getValue().readyState;
  }

  public getIsPaused() : boolean {
    // XXX TODO probably should be async or removed
    return this._src.getValue().paused.last;
  }

  public getReference() : IReadOnlySharedReference<IWorkerPlaybackObservation> {
    return this._src;
  }

  public setPlaybackRate(playbackRate : number) : void {
    log.warn("XXX TODO", playbackRate);
  }

  public getPlaybackRate() : number {
    return 1;
  }

  public listen(
    cb : (
      observation : IWorkerPlaybackObservation,
      stopListening : () => void
    ) => void,
    options? : { includeLastObservation? : boolean | undefined;
                 clearSignal? : CancellationSignal | undefined; }
  ) : void {
    if (this._cancelSignal.isCancelled || options?.clearSignal?.isCancelled === true) {
      return ;
    }
    this._src.onUpdate(cb, {
      clearSignal: options?.clearSignal,
      emitCurrentValue: options?.includeLastObservation,
    });
  }

  public deriveReadOnlyObserver<TDest>(
    transform : (
      observationRef : IReadOnlySharedReference<IWorkerPlaybackObservation>,
      cancellationSignal : CancellationSignal
    ) => IReadOnlySharedReference<TDest>
  ) : IReadOnlyPlaybackObserver<TDest> {
    return generateReadOnlyObserver(this, transform, this._cancelSignal);
  }
}
