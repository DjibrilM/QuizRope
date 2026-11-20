import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

interface IconProps {
  size?: number;
  selected?: boolean;
}

/**
 * Rounded duotone scholar cap with golden tassel for young learners.
 */
function StudentIcon({ size = 28, selected = false }: IconProps) {
  const capTop = selected ? "#FFFFFF" : "#6EE7B7";
  const capBase = selected ? "rgba(255, 255, 255, 0.78)" : "#10B981";
  const tasselGold = "#FCD34D";

  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Lower rounded cap crown */}
      <Path
        d="M7.5 14.8v4.1c0 1.9 2.9 3.5 6.5 3.5s6.5-1.6 6.5-3.5v-4.1l-5.7 2.75a1.85 1.85 0 0 1-1.6 0L7.5 14.8Z"
        fill={capBase}
      />

      {/* Rounded mortarboard */}
      <Path
        d="M13.22 5.45c.49-.24 1.07-.24 1.56 0l9.32 4.48c.68.33.68 1.31 0 1.64l-9.32 4.48c-.49.24-1.07.24-1.56 0L3.9 11.57c-.68-.33-.68-1.31 0-1.64l9.32-4.48Z"
        fill={capTop}
      />

      {/* Tassel cord & bobble */}
      <Path
        d="M22.2 11.6v4.6"
        stroke={tasselGold}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Circle cx="22.2" cy="17.6" r="1.5" fill={tasselGold} />
      <Circle cx="14" cy="10.75" r="1.25" fill={tasselGold} />
    </Svg>
  );
}

export default StudentIcon;
