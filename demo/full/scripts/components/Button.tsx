import * as React from "react";

/**
 * Generic Button React component.
 * @param {Object} props
 * @returns {Object}
 */
function Button({
  ariaLabel,
  children,
  className = "",
  onClick,
  value,
  disabled,
  title,
}: {
  ariaLabel: string;
  children?: JSX.Element[] | JSX.Element | string;
  className?: string;
  onClick: () => void;
  value?: string;
  disabled: boolean;
  title?: string;
}): JSX.Element {
  if (disabled) {
    return (
      <button
        aria-label={ariaLabel}
        disabled
        className={className + " disabled"}
        title={title}
      >
        {value}
      </button>
    );
  }

  const inner = children ?? value;
  return (
    <button
      aria-label={ariaLabel}
      className={className}
      onClick={onClick}
      title={title}
    >
      {inner}
    </button>
  );
}

export default React.memo(Button);
