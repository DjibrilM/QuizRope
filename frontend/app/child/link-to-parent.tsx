import React from "react";
import { useTranslation } from "react-i18next";
import { LinkAccountFlow } from "../../src/components/device";

export default function LinkToParentScreen() {
  const { t } = useTranslation(["auth", "common", "device"]);

  return (
    <LinkAccountFlow
      heading={t("auth:guest.linkTitle")}
      subtitle={t("auth:guest.linkSubtitle")}
      ctaLabel={t("auth:guest.linkButton")}
      hintText={t("auth:guest.linkHint")}
      invalidCodeError={t("auth:guest.linkCodeInvalidError")}
      lengthError={t("auth:guest.linkCodeLengthError")}
    />
  );
}
