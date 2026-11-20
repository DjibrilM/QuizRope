import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

interface IconProps {
  size?: number;
}

/**
 * Chunky duotone arithmetic tile cluster for Math.
 */
export function IconMath({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Top-left blue plus tile */}
      <Rect x="3" y="3" width="10" height="10" rx="3.2" fill="#60A5FA" />
      <Path
        d="M8 5.8v4.4M5.8 8h4.4"
        stroke="#FFFFFF"
        strokeWidth="1.9"
        strokeLinecap="round"
      />

      {/* Top-right deeper indigo minus tile */}
      <Rect x="15" y="3" width="10" height="10" rx="3.2" fill="#3B82F6" />
      <Path
        d="M17.8 8h4.4"
        stroke="#DBEAFE"
        strokeWidth="1.9"
        strokeLinecap="round"
      />

      {/* Bottom-left soft sky multiply tile */}
      <Rect x="3" y="15" width="10" height="10" rx="3.2" fill="#3B82F6" />
      <Path
        d="M6.4 18.4l3.2 3.2M9.6 18.4l-3.2 3.2"
        stroke="#DBEAFE"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Bottom-right highlight equals tile */}
      <Rect x="15" y="15" width="10" height="10" rx="3.2" fill="#93C5FD" />
      <Path
        d="M17.8 18.6h4.4M17.8 21.4h4.4"
        stroke="#1E3A8A"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Chunky filled potion beaker with rising bubbles for Science.
 */
export function IconScience({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Glass flask silhouette */}
      <Path
        d="M10.5 5.2h7v4.4l4.8 8.9A3.1 3.1 0 0 1 19.6 23H8.4a3.1 3.1 0 0 1-2.7-4.5l4.8-8.9V5.2Z"
        fill="#DDD6FE"
      />
      {/* Top collar rim */}
      <Rect x="8.8" y="3.2" width="10.4" height="2.6" rx="1.3" fill="#A78BFA" />
      {/* Glowing violet liquid pool */}
      <Path
        d="M7.6 15.2h12.8l1.6 3.1A2.2 2.2 0 0 1 20 21.5H8a2.2 2.2 0 0 1-2-3.2l1.6-3.1Z"
        fill="#7C3AED"
      />
      {/* Specular shine & bubbles */}
      <Circle cx="11.5" cy="18" r="1.4" fill="#34D399" />
      <Circle cx="16.2" cy="18.7" r="1.05" fill="#A7F3D0" />
      <Circle cx="14.5" cy="12.2" r="1.1" fill="#A78BFA" />
      <Circle cx="19.5" cy="6.2" r="1.2" fill="#34D399" />
    </Svg>
  );
}

/**
 * Chunky layered storybook emblem for English.
 */
export function IconEnglish({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Amber cover back */}
      <Rect x="3.5" y="6" width="21" height="16.5" rx="3" fill="#D97706" />
      {/* Left cream page */}
      <Path
        d="M5 6.8A1.8 1.8 0 0 1 6.8 5h5.7a1.5 1.5 0 0 1 1.5 1.5v13.8a1 1 0 0 1-1 1H6.8A1.8 1.8 0 0 1 5 19.5V6.8Z"
        fill="#FEF3C7"
      />
      {/* Right gold-warm page */}
      <Path
        d="M14 6.5A1.5 1.5 0 0 1 15.5 5h5.7A1.8 1.8 0 0 1 23 6.8v12.7a1.8 1.8 0 0 1-1.8 1.8H15a1 1 0 0 1-1-1V6.5Z"
        fill="#FDE68A"
      />
      {/* Bookmark ribbon */}
      <Path d="M17.2 5h2.6v6.8l-1.3-1.1-1.3 1.1V5Z" fill="#FB7185" />
      {/* Bold text lines */}
      <Path
        d="M7.5 9.5h4M7.5 12.8h4M7.5 16h2.8"
        stroke="#D97706"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Path
        d="M16.5 14.5h4M16.5 17.5h3"
        stroke="#B45309"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Chunky temple columns emblem for History.
 */
export function IconHistory({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Roof pediment */}
      <Path
        d="M13.2 3.8a1.4 1.4 0 0 1 1.6 0l9.3 5.9c.7.45.38 1.55-.45 1.55H4.35c-.83 0-1.15-1.1-.45-1.55l9.3-5.9Z"
        fill="#F472B6"
      />
      <Circle cx="14" cy="8.1" r="1.2" fill="#FDE68A" />
      {/* Three rounded columns */}
      <Rect x="6" y="12.2" width="3.4" height="8.8" rx="1.4" fill="#FBCFE8" />
      <Rect x="12.3" y="12.2" width="3.4" height="8.8" rx="1.4" fill="#F9A8D4" />
      <Rect x="18.6" y="12.2" width="3.4" height="8.8" rx="1.4" fill="#FBCFE8" />
      {/* Stepped pedestal */}
      <Rect x="3.5" y="21.2" width="21" height="3.2" rx="1.6" fill="#DB2777" />
    </Svg>
  );
}

/**
 * Chunky globe with sculpted continents & polar shine for Geography.
 */
export function IconGeography({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Deep teal-blue ocean sphere */}
      <Circle cx="14" cy="14" r="10.2" fill="#0D9488" />
      {/* Soft top-left highlight dome */}
      <Circle cx="12" cy="11.5" r="7.5" fill="#14B8A6" opacity="0.55" />
      {/* Rounded emerald continents */}
      <Path
        d="M8.5 7.6c2.1-.9 4.5-.2 5 1.5.4 1.4-1.2 2.4-.7 3.7.5 1.1 2.2 1.1 2.1 2.6-.1 1.8-2.2 3.9-3.9 3.6-1.8-.3-1.4-2.5-2.6-3.9-1.2-1.4-2.6-2-2.2-4 .3-1.7 1.1-2.9 2.3-3.5Z"
        fill="#6EE7B7"
      />
      <Path
        d="M17.8 9.2c1.4-.4 3.4.7 4 2.4.7 2-.2 4.6-1.8 5.2-1.5.6-2.5-.8-2.8-2.1-.3-1.5-.8-5.1.6-5.5Z"
        fill="#34D399"
      />
      {/* Stand/pin spark */}
      <Circle cx="19" cy="12" r="1.4" fill="#FDE68A" />
    </Svg>
  );
}

/**
 * Chunky difficulty badge icons.
 */
export function IconEasy({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx="14" cy="14" r="10.5" fill="#10B981" />
      <Path
        d="M9.6 14.4l2.9 2.9 5.9-6.2"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconMedium({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx="14" cy="14" r="10.5" fill="#F59E0B" />
      <Rect x="8.5" y="12.6" width="11" height="2.8" rx="1.4" fill="#FFFFFF" />
      <Rect x="10.5" y="8.4" width="7" height="2.4" rx="1.2" fill="#FEF3C7" />
      <Rect x="10.5" y="17.2" width="7" height="2.4" rx="1.2" fill="#FEF3C7" />
    </Svg>
  );
}

export function IconHard({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx="14" cy="14" r="10.5" fill="#EF4444" />
      <Path
        d="M15.2 6.8L9.6 15h4.2l-1 6.2 5.6-8.2h-4.2l1-6.2Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

/**
 * Chunky duotone age-group badge icons for split-screen battles.
 */
export function IconKids({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx="14" cy="14" r="10.5" fill="#10B981" />
      <Circle cx="14" cy="10.8" r="3.4" fill="#FFFFFF" />
      <Path
        d="M8.5 21.2c.6-2.9 2.7-4.5 5.5-4.5s4.9 1.6 5.5 4.5"
        fill="#D1FAE5"
      />
    </Svg>
  );
}

export function IconTeens({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx="14" cy="14" r="10.5" fill="#F59E0B" />
      <Path
        d="M9.6 11.4a4.4 4.4 0 0 1 8.8 0"
        stroke="#FEF3C7"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Circle cx="14" cy="11.6" r="3.1" fill="#FFFFFF" />
      <Path
        d="M8.5 21.2c.6-2.8 2.7-4.3 5.5-4.3s4.9 1.5 5.5 4.3"
        fill="#FEF3C7"
      />
    </Svg>
  );
}

export function IconYoungAdults({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx="14" cy="14" r="10.5" fill="#8B5CF6" />
      {/* Graduation cap crown */}
      <Path d="M14 6.5l6.2 2.9L14 12.3 7.8 9.4 14 6.5Z" fill="#FFFFFF" />
      <Path
        d="M10.2 10.9v2.9c0 1.4 1.7 2.4 3.8 2.4s3.8-1 3.8-2.4v-2.9L14 12.7l-3.8-1.8Z"
        fill="#DDD6FE"
      />
      <Path
        d="M19.5 10.1v4.1"
        stroke="#FDE68A"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const SUBJECT_ICONS: Record<string, React.FC<IconProps>> = {
  MATH: IconMath,
  SCIENCE: IconScience,
  ENGLISH: IconEnglish,
  HISTORY: IconHistory,
  GEOGRAPHY: IconGeography,
};

export function SubjectIcon({
  subject,
  size = 28,
}: {
  subject: string;
  size?: number;
}) {
  const Icon = SUBJECT_ICONS[subject];
  if (!Icon) return null;
  return <Icon size={size} />;
}
