import React, { useRef, useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { AVATARS } from "../../config/avatars";
import { hapticsService } from "../../services/haptics";
import { AvatarIcon } from "../common/AvatarIcons";
import { AvatarPicker } from "./AvatarPicker";
import { AppInput, PillButton } from "../ui";
import { UI_COLORS } from "../../constants/theme";

interface AddChildFormProps {
  onSave: (data: {
    displayName: string;
    grade: string;
    avatarUrl: string;
  }) => void;
  onCancel: () => void;
  loading?: boolean;
}

interface FormErrors {
  name?: string;
  grade?: string;
}

function getNextRandomAvatar(exclude: string): string {
  const pool = AVATARS.filter((item) => item.id !== exclude);
  if (pool.length === 0) return AVATARS[0].id;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export function AddChildForm({
  onSave,
  onCancel,
  loading = false,
}: AddChildFormProps) {
  const { t } = useTranslation(["children", "common"]);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [avatar, setAvatar] = useState("lion");
  const [errors, setErrors] = useState<FormErrors>({});
  const gradeInputRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      newErrors.name = t("validation.nameMinLength");
    } else if (trimmedName.length > 30) {
      newErrors.name = t("validation.nameMaxLength");
    }

    if (!grade.trim()) {
      newErrors.grade = t("validation.gradeRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (loading || !validate()) return;

    setErrors({});
    hapticsService.success();
    onSave({
      displayName: name.trim(),
      grade: grade.trim(),
      avatarUrl: avatar,
    });
  };

  const handleShuffleAvatar = () => {
    hapticsService.selection();
    setAvatar((prev) => getNextRandomAvatar(prev));
  };

  return (
    <View style={styles.container}>
      {/* Live Avatar Preview */}
      <View style={styles.previewWrap}>
        <View style={styles.previewRing}>
          <AvatarIcon avatarId={avatar} size={74} />
        </View>
      </View>

      {/* Avatar Grid with Shuffle */}
      <View style={styles.pickerWrap}>
        <AvatarPicker
          selected={avatar}
          onSelect={setAvatar}
          tileSize={56}
          rightAction={
            <TouchableOpacity
              onPress={handleShuffleAvatar}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Randomize avatar"
              style={styles.shuffleBtn}
            >
              <Ionicons name="shuffle" size={14} color={UI_COLORS.textPrimary} />
            </TouchableOpacity>
          }
        />
      </View>

      {/* Child Details Inputs */}
      <View style={styles.inputsStack}>
        <AppInput
          label={t("form.namePlaceholder")}
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          placeholder={t("form.namePlaceholder")}
          error={errors.name}
          leftIcon={
            <Ionicons
              name="person-outline"
              size={18}
              color={UI_COLORS.textMuted}
            />
          }
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => gradeInputRef.current?.focus()}
          editable={!loading}
          shellStyle={styles.inputShell}
        />

        <AppInput
          ref={gradeInputRef}
          label={t("form.gradePlaceholder")}
          value={grade}
          onChangeText={(value) => {
            setGrade(value);
            if (errors.grade) {
              setErrors((prev) => ({ ...prev, grade: undefined }));
            }
          }}
          placeholder={t("form.gradePlaceholder")}
          error={errors.grade}
          leftIcon={
            <Ionicons
              name="school-outline"
              size={18}
              color={UI_COLORS.textMuted}
            />
          }
          returnKeyType="done"
          onSubmitEditing={handleSave}
          editable={!loading}
          shellStyle={styles.inputShell}
        />
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <View style={styles.cancelSlot}>
          <PillButton
            label={t("common:buttons.cancel")}
            variant="secondary"
            size="lg"
            onPress={onCancel}
            disabled={loading}
          />
        </View>
        <View style={styles.saveSlot}>
          <PillButton
            label={t("form.savePlayer")}
            variant="primary"
            size="lg"
            onPress={handleSave}
            loading={loading}
            icon={<Ionicons name="checkmark" size={18} color="#FFFFFF" />}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  previewWrap: {
    alignItems: "center",
    marginBottom: 14,
  },
  previewRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: "rgba(108, 92, 231, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pickerWrap: {
    marginBottom: 18,
  },
  shuffleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: UI_COLORS.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  inputsStack: {
    gap: 14,
  },
  inputShell: {
    backgroundColor: UI_COLORS.surfaceSubtle,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  cancelSlot: {
    flex: 1,
  },
  saveSlot: {
    flex: 1.4,
  },
});
