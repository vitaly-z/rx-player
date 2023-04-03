import * as React from "react";
import Button from "../components/Button";
import useModuleState from "../lib/useModuleState";
import type { IPlayerModule } from "../modules/player/index";

/**
 * Play/Pause button.
 * Triggers the right callback on click.
 * @param {Object} props
 * @returns {Object}
 */
function PlayPauseButton({
  className = "",
  player,
}: {
  className?: string | undefined;
  player: IPlayerModule;
}): JSX.Element {
  const cannotLoadMetadata = useModuleState(player, "cannotLoadMetadata");
  const isPaused = useModuleState(player, "isPaused");
  const isContentLoaded = useModuleState(player, "isContentLoaded");
  const hasEnded = useModuleState(player, "hasEnded");

  const disabled = !isContentLoaded && !cannotLoadMetadata;
  const displayPause = !isPaused && isContentLoaded && !hasEnded;

  const completeClassName = "play-pause-button " +
    className +
    (disabled  ? " disabled" : "");

  const play = React.useCallback(() => {
    player.actions.play();
  }, [player]);
  const pause = React.useCallback(() => {
    player.actions.disableLiveCatchUp();
    player.actions.pause();
  }, [player]);

  /* eslint-disable max-len */
  const svg: JSX.Element = displayPause ? (
    <svg width="100%" height="100%" viewBox="0 0 20 20" x="0px" y="0px">
      <g>
        <path d="M8 3H4v14h4V3zM16 3h-4v14h4V3z"></path>
      </g>
    </svg>
  ) : (
    <svg width="100%" height="100%" viewBox="0 0 20 20" x="0px" y="0px">
      <g>
        <path d="M5 17.066V2.934a.5.5 0 01.777-.416L17 10 5.777 17.482A.5.5 0 015 17.066z"></path>
      </g>
    </svg>
  );

  return (
    <Button
      ariaLabel="Pause/Resume the content"
      className={completeClassName}
      disabled={disabled}
      onClick={displayPause ? pause : play}
    >
      {svg}
    </Button>
  );
}

export default React.memo(PlayPauseButton);
