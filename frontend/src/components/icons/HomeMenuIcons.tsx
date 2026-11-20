import React from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

interface IconProps {
  size?: number;
}

/**
 * Chunky duotone game controller emblem for Solo Play and Start New Game.
 */
export function HomeControllerIcon({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Top trigger shoulders */}
      <Rect x="6" y="7.2" width="4.8" height="2.4" rx="1.2" fill="#C4B5FD" />
      <Rect x="17.2" y="7.2" width="4.8" height="2.4" rx="1.2" fill="#C4B5FD" />

      {/* Gamepad body silhouette */}
      <Path
        d="M7.8 8.8h12.4c2.8 0 4.6 2.1 5.1 5.4l.6 4.2c.3 1.9-1 3.4-2.7 3.4-1.1 0-1.9-.6-2.7-1.6l-1.4-1.8H8.9l-1.4 1.8c-.8 1-1.6 1.6-2.7 1.6-1.7 0-3-1.5-2.7-3.4l.6-4.2C3.2 10.9 5 8.8 7.8 8.8Z"
        fill="#FFFFFF"
      />

      {/* D-pad cross */}
      <Rect x="7.8" y="11.6" width="2.2" height="5.2" rx="1.1" fill="#4C3BB8" />
      <Rect x="6.3" y="13.1" width="5.2" height="2.2" rx="1.1" fill="#4C3BB8" />

      {/* Action buttons */}
      <Circle cx="19.3" cy="12.2" r="1.25" fill="#FBBF24" />
      <Circle cx="21.2" cy="14.2" r="1.25" fill="#34D399" />
      <Circle cx="17.4" cy="14.2" r="1.25" fill="#A78BFA" />
      <Circle cx="19.3" cy="16.2" r="1.25" fill="#F472B6" />

      {/* Center micro bar */}
      <Rect x="12.6" y="13.5" width="2.8" height="1.4" rx="0.7" fill="#DDD6FE" />
    </Svg>
  );
}

/**
 * Chunky duotone play emblem for developer Quick Play.
 */
export function HomeQuickPlayIcon({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx="14" cy="14" r="10.5" fill="#FBBF24" />
      <Path
        d="M11.6 9.6c0-.8.9-1.3 1.6-.9l6.8 4.4c.7.4.7 1.4 0 1.8l-6.8 4.4c-.7.4-1.6-.1-1.6-.9V9.6Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

/**
 * Chunky duotone open notebook emblem for Homework.
 */
export function HomeHomeworkIcon({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Subtle violet cover */}
      <Rect x="3" y="6.2" width="22" height="16.4" rx="3.2" fill="#6C5CE7" />
      {/* Left crisp off-white page */}
      <Path
        d="M4.6 6.6A1.8 1.8 0 0 1 6.4 4.8h5.9A1.7 1.7 0 0 1 14 6.5v13.8a1 1 0 0 1-1 1H6.4a1.8 1.8 0 0 1-1.8-1.8V6.6Z"
        fill="#F3F0FF"
      />
      {/* Right pure white page */}
      <Path
        d="M23.4 6.6a1.8 1.8 0 0 0-1.8-1.8h-5.9A1.7 1.7 0 0 0 14 6.5v13.8a1 1 0 0 0 1 1h6.6a1.8 1.8 0 0 0 1.8-1.8V6.6Z"
        fill="#FFFFFF"
      />
      {/* Spine divider */}
      <Rect x="13.5" y="5.2" width="1" height="16" fill="#DDD6FE" />
      {/* Minimal lavender text lines */}
      <Path
        d="M7.2 9.8h4M7.2 13h4M16.8 9.8h4M16.8 13h3.2"
        stroke="#A78BFA"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Chunky duotone two-kid family silhouette for My Children.
 */
export function HomeChildrenIcon({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Background smaller buddy */}
      <Circle cx="18.6" cy="10.2" r="3.4" fill="#A78BFA" />
      <Path
        d="M14.2 21.4c.3-3.2 2.1-5 4.4-5 2.5 0 4.3 1.8 4.6 5H14.2Z"
        fill="#C4B5FD"
      />
      {/* Foreground primary kid */}
      <Circle cx="11" cy="9.4" r="4" fill="#FFFFFF" />
      <Path
        d="M4.8 22.2c.5-3.8 2.8-6 6.2-6s5.7 2.2 6.2 6H4.8Z"
        fill="#DDD6FE"
      />
    </Svg>
  );
}

/**
 * Chunky duotone ascending chart bars for Match History.
 */
export function HomeHistoryIcon({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Baseline pill */}
      <Rect
        x="4"
        y="21.5"
        width="20"
        height="2.2"
        rx="1.1"
        fill="rgba(255, 255, 255, 0.22)"
      />
      {/* Ascending rounded bars */}
      <Rect x="5.2" y="13.5" width="4.6" height="7.2" rx="2" fill="#FDA4AF" />
      <Rect x="11.7" y="9.2" width="4.6" height="11.5" rx="2" fill="#FB7185" />
      <Rect x="18.2" y="5.2" width="4.6" height="15.5" rx="2" fill="#F43F5E" />
      {/* Highlight dot on peak bar */}
      <Circle cx="20.5" cy="7.5" r="1.1" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * Chunky duotone golden trophy emblem for Leaderboard.
 */
export function HomeLeaderboardIcon({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Side handles */}
      <Path
        d="M7.5 6.8H5.4a1.6 1.6 0 0 0-1.6 1.6c0 2.6 1.4 4.4 3.8 4.8"
        stroke="#FDE68A"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <Path
        d="M20.5 6.8h2.1a1.6 1.6 0 0 1 1.6 1.6c0 2.6-1.4 4.4-3.8 4.8"
        stroke="#FDE68A"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* Stem & pedestal */}
      <Rect x="12.3" y="16" width="3.4" height="4.2" rx="1" fill="#F59E0B" />
      <Rect x="9" y="20" width="10" height="3.2" rx="1.6" fill="#D97706" />
      {/* Cup bowl */}
      <Path
        d="M7.2 5.2h13.6v5.2a6.8 6.8 0 0 1-13.6 0V5.2Z"
        fill="#FBBF24"
      />
      {/* Top rim shine */}
      <Rect x="6.4" y="4.2" width="15.2" height="2.4" rx="1.2" fill="#FDE68A" />
      {/* Center badge dot */}
      <Circle cx="14" cy="10.8" r="1.8" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * Chunky duotone interlocking links for guest account linking.
 */
export function HomeLinkIcon({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <G rotation={-45} origin="14, 14">
        <Rect
          x="4.5"
          y="10.2"
          width="11.2"
          height="7.6"
          rx="3.8"
          stroke="#A78BFA"
          strokeWidth="2.8"
        />
        <Rect
          x="12.3"
          y="10.2"
          width="11.2"
          height="7.6"
          rx="3.8"
          stroke="#FFFFFF"
          strokeWidth="2.8"
        />
      </G>
    </Svg>
  );
}
