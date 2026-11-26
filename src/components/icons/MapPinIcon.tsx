import { MAP_PIN_BODY_PATH, MAP_PIN_ICON_VIEW_BOX } from "./MapPinIconWithoutCircle";

export function MapPinIcon({
  size = 24,
  color = "currentColor",
  stroke,
  strokeWidth,
}: {
  size?: number;
  color?: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={MAP_PIN_ICON_VIEW_BOX}
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={MAP_PIN_BODY_PATH} fill={color} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <circle cx="50" cy="35" r="15" stroke="white" strokeWidth="4" fill="none" />
    </svg>
  );
}
