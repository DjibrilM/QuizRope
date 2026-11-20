import React, { useRef } from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "../../src/components/common";
import { LinkAccountFlow } from "../../src/components/device";
import {
  LanguagePill,
  type FloatingBottomSheetRef,
} from "../../src/components/ui";

export { extractCodeFromScan } from "../../src/utils/accountLinking";

export default function ChildJoinScreen() {
  const { t } = useTranslation(["device", "common", "auth"]);
  const langSheetRef = useRef<FloatingBottomSheetRef>(null);

  return (
    <LinkAccountFlow
      heading={t("device:childJoin.connectAccount")}
      subtitle={t("device:childJoin.instruction")}
      ctaLabel={t("common:buttons.link")}
      invalidCodeError={t("device:childJoin.invalidCode")}
      lengthError={t("auth:guest.linkCodeLengthError")}
      headerRight={
        <LanguagePill
          transparent={Platform.OS === "ios"}
          onPress={() => langSheetRef.current?.present()}
        />
      }
      footerExtra={<LanguageSelector ref={langSheetRef} />}
    />
  );
}
