import * as React from "react";
import Button from "../components/Button";
import {
  addFullscreenListener,
  exitFullscreen,
  isFullscreen,
  removeFullscreenListener,
  requestFullscreen,
} from "../lib/fullscreen";
import useModuleState from "../lib/useModuleState";
import type { IPlayerModule } from "../modules/player/index";

const {
  useCallback,
  useEffect,
  useMemo,
  useState,
} = React;

/**
 * Simple fullscreen button.
 * Triggers the right callback on click.
 *
 * @param {Object} props
 * @returns {Object}
 */
function FullscreenButton({
  playerWrapperElementRef,
  player,
  className,
}: {
  playerWrapperElementRef:  { current: HTMLElement | null };
  player: IPlayerModule;
  className: string;
}): JSX.Element {
  const hasCurrentContent = useModuleState(player, "hasCurrentContent");
  const isInitiallyFullscreen = useMemo(() => isFullscreen(), []);
  const [
    isCurrentlyFullScreen,
    setIsCurrentlyFullScreen,
  ] = useState(isInitiallyFullscreen);

  useEffect(() => {
    const fullscreenListener = () => {
      const isInFullscreen = isFullscreen();
      if (!isInFullscreen && playerWrapperElementRef.current !== null) {
        playerWrapperElementRef.current.classList.remove("fullscreen");
      }
      setIsCurrentlyFullScreen(isInFullscreen);
    };

    addFullscreenListener(fullscreenListener);

    return () => {
      removeFullscreenListener(fullscreenListener);
    };
  }, [playerWrapperElementRef]);

  const setFullscreen = useCallback(() => {
    if (playerWrapperElementRef.current === null) {
      return;
    }
    requestFullscreen(playerWrapperElementRef.current);
    playerWrapperElementRef.current.classList.add("fullscreen");
  }, [playerWrapperElementRef]);

  // Shamefully copied from some other website
  /* eslint-disable max-len */
  const svg = isCurrentlyFullScreen ? (
    <svg width="100%" height="100%" viewBox="0 0 20 20" x="0px" y="0px">
      <g>
        <path d="M8 8V3H6v3H2v2h6zM12 8h6V6h-4V3h-2v5zM12 17v-5h6v2h-4v3h-2zM8 12H2v2h4v3h2v-5z"></path>
      </g>
    </svg>
  ) : (
    <svg width="100%" height="100%" viewBox="0 0 20 20" x="0px" y="0px">
      <g>
        <path d="M7 3H2v5h2V5h3V3zM18 8V3h-5v2h3v3h2zM13 17v-2h3v-3h2v5h-5zM4 12H2v5h5v-2H4v-3z"></path>
      </g>
    </svg>
  );
  /* eslint-enable max-len */

  return (
    <Button
      ariaLabel="Go/Quit fullscreen"
      className={"fullscreen-button " + className}
      onClick={isCurrentlyFullScreen ? exitFullscreen : setFullscreen }
      disabled={!hasCurrentContent}
    >
      {svg}
    </Button>
  );
}

export default React.memo(FullscreenButton);
