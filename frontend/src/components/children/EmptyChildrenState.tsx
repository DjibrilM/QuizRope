import React from "react";
import { useTranslation } from "react-i18next";
import { StateCard } from "../ui";

export function EmptyChildrenState() {
  const { t } = useTranslation("children");

  return (
    <StateCard
      icon="people-outline"
      title={t("emptyTitle")}
      subtitle={t("emptySubtitle")}
    />
  );
}
