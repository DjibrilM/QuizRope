import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

interface IconProps {
  size?: number;
  selected?: boolean;
}

/**
 * Duotone guardian + young learner emblem designed for dark and primary surfaces.
 */
function ParentIcon({ size = 28, selected = false }: IconProps) {
  const primaryTone = selected ? "#FFFFFF" : "#FB7185";
  const secondaryTone = selected ? "rgba(255, 255, 255, 0.78)" : "#FDBA74";
  const accentTone = selected ? "#FDE68A" : "#FDA4AF";

  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Parent head & rounded torso */}
      <Circle cx="10.5" cy="8.5" r="3.7" fill={primaryTone} />
      <Path
        d="M4 21.3a6.5 6.5 0 0 1 13 0c0 .66-.54 1.2-1.2 1.2H5.2c-.66 0-1.2-.54-1.2-1.2Z"
        fill={primaryTone}
      />

      {/* Young learner beside parent */}
      <Circle cx="19.5" cy="12.6" r="2.8" fill={secondaryTone} />
      <Path
        d="M15 21.4a4.5 4.5 0 0 1 9 0c0 .6-.5 1.1-1.1 1.1h-6.8c-.6 0-1.1-.5-1.1-1.1Z"
        fill={secondaryTone}
      />

      {/* Warm guiding heart */}
      <Path
        d="M19.5 8.5l-.28-.25C17.98 7.12 17.1 6.32 17.1 5.38c0-.76.6-1.35 1.35-1.35.43 0 .85.2 1.05.52.2-.32.62-.52 1.05-.52.75 0 1.35.59 1.35 1.35 0 .94-.88 1.74-2.12 2.87l-.28.25Z"
        fill={accentTone}
      />
    </Svg>
  );
}

export default ParentIcon;
