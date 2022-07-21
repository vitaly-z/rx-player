import React, {
  useCallback,
  useMemo,
} from "react";
import withModulesState from "../lib/withModulesState.jsx";
import Button from "../components/Button.jsx";
import PositionInfos from "../components/PositionInfos.jsx";
import LivePosition from "../components/LivePosition.jsx";
import StickToLiveEdgeButton from "../components/StickToLiveEdgeButton.jsx";
import PlayPauseButton from "./PlayPauseButton.jsx";
import FullscreenButton from "./FullScreenButton.jsx";
import ProgressBar from "./ProgressBar.jsx";
import VolumeButton from "./VolumeButton.jsx";
import VolumeBar from "./VolumeBar.jsx";

let interval;
let isReversing = false;
let blockedSince = null;

function ControlBar({
  currentTime,
  duration,
  isCatchUpEnabled,
  isCatchingUp,
  isContentLoaded,
  isLive,
  isPaused,
  isStopped,
  liveGap,
  lowLatencyMode,
  enableVideoThumbnails,
  maximumPosition,
  playbackRate,
  player,
  stopVideo,
  toggleSettings,
  videoElement,
}) {
  const changeStickToLiveEdge = useCallback((shouldStick) => {
    if (shouldStick) {
      player.dispatch("ENABLE_LIVE_CATCH_UP");
    } else {
      player.dispatch("DISABLE_LIVE_CATCH_UP");
    }
  }, [player]);

  let isCloseToLive = undefined;
  if (isLive && lowLatencyMode != null && liveGap != null) {
    isCloseToLive = lowLatencyMode ? liveGap < 7 : liveGap < 18;
  }

  const positionElement = useMemo(() => {
    if (!isContentLoaded) {
      return null;
    } else if (isLive) {
      return <LivePosition />;
    } else {
      return <PositionInfos
        position={currentTime}
        duration={duration}
      />;
    }
  }, [isContentLoaded, isLive, currentTime, duration]);

  function reversePlayback() {
    if (interval !== undefined) {
      blockedSince = null;
      clearInterval(interval);
      interval = undefined;
    }
    if (isReversing) {
      isReversing = false;
      if (["PAUSED", "BUFFERING", "SEEKING"].includes(rxPlayer.getPlayerState())) {
        rxPlayer.play();
      }
      return;
    }
    isReversing = true;
    const representations = rxPlayer.getCurrentRepresentations();
    if (representations === undefined || representations.video === undefined) {
    }
    const frameRate = representations.video.frameRate ?? "";
    let realFrameRate;
    const indexOfSlash = frameRate.indexOf("/");
    if (indexOfSlash === -1) {
      realFrameRate = parseInt(frameRate);
      if (isNaN(realFrameRate)) {
        console.error("FRAME RATE NOT FOUND, FALLBACKING TO 25");
        realFrameRate = 25;
      }
    } else {
      const frameRate1 = parseInt(frameRate.substring(0, indexOfSlash));
      const frameRate2 = parseInt(frameRate.substring(indexOfSlash));
      realFrameRate = frameRate1 / frameRate2;
      if (isNaN(realFrameRate)) {
        console.error("FRAME RATE NOT FOUND, FALLBACKING TO 25");
        realFrameRate = 25;
      }
    }
    rxPlayer.pause();
    interval = setInterval(() => {
      if (rxPlayer.getPlayerState() === "PAUSED") {
        blockedSince = null;
        rxPlayer.seekTo({ relative: -1 / realFrameRate });
      } else if (["BUFFERING", "SEEKING"].includes(rxPlayer.getPlayerState())) {
        const videoElement = rxPlayer.getVideoElement();
        const buffered = videoElement.buffered;
        const currentTime = videoElement.currentTime;
        for (let i = 0; i < buffered.length; i++) {
          if (buffered.end(i) > currentTime) {
            if (buffered.start(i) < currentTime) {
              if (blockedSince === null) {
                blockedSince = performance.now();
              } else if (performance.now() - blockedSince < 2000) {
                return ;
              } else {
                console.error("FAKE REBUFFERING", currentTime, buffered.start(i), buffered.end(i));
                blockedSince = null;
                rxPlayer.seekTo({ relative: -1 / realFrameRate });
              }
              return;
            } else if (i > 0 && buffered.start(i) - buffered.end(i - 1) < 0.8) {
              if (blockedSince === null) {
                blockedSince = performance.now();
              } else if (performance.now() - blockedSince < 2000) {
                return ;
              } else {
                console.error("REAL DISCONTINUITY");
                blockedSince = null;
                rxPlayer.seekTo({ relative: -1 / realFrameRate });
              }
              return;
            }
          }
        }
      }
    }, 1 / realFrameRate);
  }

  const isAtLiveEdge = isLive && isCloseToLive && !isCatchingUp;

  return (
    <div className="controls-bar-container">
      <ProgressBar
        player={player}
        enableVideoThumbnails={enableVideoThumbnails}
        onSeek={() => changeStickToLiveEdge(false)}
      />
      <div className="controls-bar">
        <PlayPauseButton
          className={"control-button"}
          player={player}
        />
        <Button
          className={"control-button"}
          ariaLabel="Reverse Playback"
          onClick={reversePlayback}
          value={String.fromCharCode(0xf053)}
          disabled={isStopped}
        />
        <Button
          className={"control-button"}
          ariaLabel="Stop playback"
          onClick={stopVideo}
          value={String.fromCharCode(0xf04d)}
          disabled={isStopped}
        />
        {
          (isContentLoaded && isLive && lowLatencyMode) ?
            <StickToLiveEdgeButton
              isStickingToTheLiveEdge={isCatchUpEnabled}
              changeStickToLiveEdge={() =>
                changeStickToLiveEdge(!isCatchUpEnabled)
              }
            /> : null
        }
        {positionElement}
        {isLive && isContentLoaded ?
          <Button
            ariaLabel={ isAtLiveEdge ? undefined : "Go back to live"}
            className={"dot" + (isAtLiveEdge ? " live" : "")}
            onClick={() => {
              if (!isAtLiveEdge) {
                player.dispatch("SEEK", maximumPosition - (lowLatencyMode ? 4 : 10));
              }
            }}
          /> : null}
        <div className="controls-right-side">
          {!isPaused && isCatchingUp && playbackRate > 1 ?
            <div className="catch-up">
              {"Catch-up playback rate: " + playbackRate}
            </div> : null
          }
          <Button
            ariaLabel="Display/Hide controls"
            disabled={!isContentLoaded}
            className='control-button'
            onClick={toggleSettings}
            value={String.fromCharCode(0xf013)}
          />
          <div className="volume">
            <VolumeButton
              className="control-button"
              player={player}
            />
            <VolumeBar
              className="control-button"
              player={player}
            />
          </div>
          <FullscreenButton
            className={"control-button"}
            player={player}
            videoElement={videoElement}
          />
        </div>
      </div>
    </div>
  );
}

export default React.memo(withModulesState({
  player: {
    currentTime: "currentTime",
    duration: "duration",
    isCatchUpEnabled: "isCatchUpEnabled",
    isCatchingUp: "isCatchingUp",
    isContentLoaded: "isContentLoaded",
    isLive: "isLive",
    isPaused: "isPaused",
    isStopped: "isStopped",
    liveGap: "liveGap",
    lowLatencyMode: "lowLatencyMode",
    maximumPosition: "maximumPosition",
    playbackRate: "playbackRate",
  },
})(ControlBar));
