import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { AvatarIcon } from "../common";

interface GuestIconProps {
  avatarId?: string;
  size?: number;
  selected?: boolean;
}

/**
 * Playful discovery sparkles for instant guest play, or the guest's chosen avatar.
 */
function GuestIcon({ avatarId, size = 24, selected = false }: GuestIconProps) {
  if (avatarId) return <AvatarIcon avatarId={avatarId} size={size} />;

  const primaryStar = selected ? "#FFFFFF" : "#FBBF24";
  const miniStar = selected ? "rgba(255, 255, 255, 0.85)" : "#FDE68A";

  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Main smooth 4-point discovery star */}
      <Path
        d="M12 6.5C12.8 11.9 14.1 13.2 20.5 15C14.1 16.8 12.8 18.1 12 23.5C11.2 18.1 9.9 16.8 3.5 15C9.9 13.2 11.2 11.9 12 6.5Z"
        fill={primaryStar}
      />
      {/* Orbiting mini sparkle */}
      <Path
        d="M21.5 4C21.85 6.2 22.3 6.65 24.5 7.5C22.3 8.35 21.85 8.8 21.5 11C21.15 8.8 20.7 8.35 18.5 7.5C20.7 6.65 21.15 6.2 21.5 4Z"
        fill={miniStar}
      />
      {/* Subtle accent dot */}
      <Circle cx="21.5" cy="21" r="1.4" fill={miniStar} />
    </Svg>
  );
}

export default GuestIcon;
