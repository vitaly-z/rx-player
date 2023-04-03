import * as React from "react";
import Button from "./Button";

export default React.memo(function StopButton({
  className,
  disabled,
  onClick,
}: {
  className: string;
  disabled: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <Button
      ariaLabel="Stop playback"
      disabled={disabled}
      className={className}
      onClick={onClick}
    >
      <svg viewBox="0 0 20 20" x="0px" y="0px" width="20" height="20">
        <rect width="12" height="12" x="4" y="4"></rect>
      </svg>
    </Button>
  );
});
