import { memo, useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { FONTS, UI_COLORS } from "../../constants/theme";

export const ScorePop = memo(function ScorePop({
  side,
}: {
  side: "left" | "right";
}) {
  void side;
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = 0;
    opacity.value = 1;
    translateY.value = withTiming(-28, {
      duration: 550,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withSequence(
      withTiming(1, { duration: 50 }),
      withTiming(0, { duration: 480 }),
    );
  }, [opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
    position: "absolute" as const,
    bottom: "100%",
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none" as any,
  }));

  return (
    <Animated.View style={style}>
      <Text
        style={{
          color: UI_COLORS.mint,
          fontSize: 14,
          fontFamily: FONTS.bodyExtraBold,
        }}
      >
        +10
      </Text>
    </Animated.View>
  );
});
