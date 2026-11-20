import React from "react";
import { Redirect } from "expo-router";
import { useGameStore } from "../src/stores/gameStore";

/**
 * Compatibility route dispatcher: parents open `/parent-profile`,
 * while kids and guests open `/kid-profile`.
 */
export default function ProfileRedirectScreen() {
  const userRole = useGameStore((s) => s.userRole);
  const target =
    userRole === "child" || userRole === "guest"
      ? "/kid-profile"
      : "/parent-profile";

  return <Redirect href={target as any} />;
}
