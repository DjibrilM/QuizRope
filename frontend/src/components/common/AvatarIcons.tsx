import React, { useEffect, useState } from "react";
import { Image } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { isRemoteAvatarUrl } from "../../config/avatars";

interface IconProps {
  size?: number;
}

const AVATAR_IMAGE_MAP: Record<string, number> = {
  lion: require("../../../assets/avatars/lion.jpg"),
  fox: require("../../../assets/avatars/fox.jpg"),
  panda: require("../../../assets/avatars/panda.jpg"),
  unicorn: require("../../../assets/avatars/unicorn.jpg"),
  dragon: require("../../../assets/avatars/dragon.jpg"),
  owl: require("../../../assets/avatars/owl.jpg"),
  dolphin: require("../../../assets/avatars/dolphin.jpg"),
  rocket: require("../../../assets/avatars/rocket.jpg"),
  star: require("../../../assets/avatars/star.jpg"),
  dino: require("../../../assets/avatars/dino.jpg"),
  cat: require("../../../assets/avatars/cat.jpg"),
  dog: require("../../../assets/avatars/dog.jpg"),
};

export function getAvatarSource(avatarId?: string): number | undefined {
  return avatarId ? AVATAR_IMAGE_MAP[avatarId] : undefined;
}

function ChildIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx="16" cy="13" r="11" fill="#5D3A1A" />
      <Circle cx="16" cy="16" r="10" fill="#F4C28F" />
      <Path d="M6 13c2-5 6-8 10-8s8 3 10 8" fill="#5D3A1A" />
      <Ellipse cx="12" cy="16" rx="1.8" ry="2" fill="#1a1a2e" />
      <Ellipse cx="20" cy="16" rx="1.8" ry="2" fill="#1a1a2e" />
      <Circle cx="12.5" cy="15.3" r="0.6" fill="white" />
      <Circle cx="20.5" cy="15.3" r="0.6" fill="white" />
      <Ellipse cx="9" cy="19" rx="2" ry="1" fill="#FFB5B5" opacity="0.4" />
      <Ellipse cx="23" cy="19" rx="2" ry="1" fill="#FFB5B5" opacity="0.4" />
      <Path
        d="M13 21q3 3 6 0"
        stroke="#C0392B"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Renders the circular avatar for either a local bundled character portrait
 * or a remote HTTPS profile URL (e.g., Google photo), falling back gracefully.
 */
export function AvatarIcon({
  avatarId,
  fallbackAvatarId = "owl",
  size = 32,
}: {
  avatarId?: string;
  fallbackAvatarId?: string;
  size?: number;
}) {
  const [remoteFailed, setRemoteFailed] = useState(false);

  useEffect(() => {
    setRemoteFailed(false);
  }, [avatarId]);

  const trimmed = avatarId?.trim();
  const isRemote = isRemoteAvatarUrl(trimmed) && !remoteFailed;

  if (isRemote && trimmed) {
    return (
      <Image
        source={{ uri: trimmed }}
        resizeMode="cover"
        fadeDuration={0}
        onError={() => setRemoteFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#181326",
        }}
      />
    );
  }

  const localSource =
    (trimmed ? AVATAR_IMAGE_MAP[trimmed] : undefined) ??
    (remoteFailed || trimmed ? AVATAR_IMAGE_MAP[fallbackAvatarId] : undefined);

  if (localSource) {
    return (
      <Image
        source={localSource}
        resizeMode="cover"
        fadeDuration={0}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#181326",
        }}
      />
    );
  }

  return <ChildIcon size={size} />;
}
