import * as React from "react";

function StickToLiveEdgeButton({
  isStickingToTheLiveEdge,
  changeStickToLiveEdge,
}: {
  isStickingToTheLiveEdge: boolean;
  changeStickToLiveEdge: (newVal: boolean) => void;
}): JSX.Element {
  const onClick = React.useCallback(() => {
    changeStickToLiveEdge(!isStickingToTheLiveEdge);
  }, [changeStickToLiveEdge, isStickingToTheLiveEdge]);
  return (<button
    className={"running" + (isStickingToTheLiveEdge ? " clicked" : "")}
    aria-label="Stay close to the live edge"
    title="Stick to the live edge"
    onClick={onClick}
  >
    <svg version="1.1" viewBox="0 0 21.803 21.803">
      <path d="m18.374 16.605l-4.076-2.101-1.107-1.773-0.757-4.503 2.219 1.092-0.375 1.494c-0.13 0.519 0.185 1.041 0.699 1.17 0.077 0.021 0.157 0.03 0.235 0.03 0.432-2e-3 0.823-0.293 0.935-0.729l0.565-2.25c0.11-0.439-0.103-0.897-0.511-1.101 0 0-5.303-2.603-5.328-2.612-0.406-0.188-0.868-0.267-1.342-0.198-0.625 0.088-1.158 0.407-1.528 0.86-0.029 0.027-2.565 3.15-2.565 3.15l-1.95 0.525c-0.514 0.141-0.818 0.668-0.679 1.184 0.116 0.43 0.505 0.713 0.93 0.713 0.083 0 0.168-0.011 0.252-0.033l2.252-0.606c0.196-0.055 0.37-0.167 0.498-0.324l1.009-1.247 0.725 4.026-1.27 1.01c-0.379 0.304-0.541 0.802-0.411 1.269l1.469 5.271c0.148 0.532 0.633 0.881 1.16 0.881 0.107 0 0.216-0.015 0.324-0.045 0.641-0.178 1.016-0.842 0.837-1.482l-1.254-4.502 1.948-1.498 1.151 1.791c0.115 0.186 0.277 0.334 0.471 0.436l4.371 2.25c0.177 0.092 0.363 0.135 0.552 0.135 0.438 0 0.856-0.238 1.072-0.653 0.303-0.6 0.07-1.325-0.521-1.63z"/>
      <circle cx="8.602" cy="2.568" r="2.568"/>
    </svg>
  </button>);
}

export default React.memo(StickToLiveEdgeButton);
