import { useCallback, useEffect, useState } from "react";
import { apiService, type LinkInfo } from "../services/api";
import * as guestDb from "../services/guestDb";
import { NotificationService } from "../services/NotificationService";
import { useGameStore } from "../stores/gameStore";

/** Normalizes manual text input for 6- or 8-character parent link codes. */
export function sanitizeLinkCodeInput(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

/** Extracts a 6- or 8-character uppercase alphanumeric token from QR payloads or raw input. */
export function extractCodeFromScan(data: string): string {
  if (!data) return "";
  const trimmed = data.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.token && typeof parsed.token === "string") {
      return parsed.token.trim().toUpperCase();
    }
    if (parsed.code && typeof parsed.code === "string") {
      return parsed.code.trim().toUpperCase();
    }
    if (parsed.sessionToken && typeof parsed.sessionToken === "string") {
      return parsed.sessionToken.trim().toUpperCase();
    }
  } catch {
    // Plain string or URL payload
  }

  const paramMatch = trimmed.match(/[?&](?:code|token)=([A-Za-z0-9]+)/i);
  if (paramMatch) return paramMatch[1].toUpperCase();

  const eightMatch = trimmed.match(/\b([A-Za-z0-9]{8})\b/);
  if (eightMatch) return eightMatch[1].toUpperCase();

  const sixMatch = trimmed.match(/\b([A-Za-z0-9]{6})\b/);
  if (sixMatch) return sixMatch[1].toUpperCase();

  return sanitizeLinkCodeInput(trimmed);
}

export function isCompleteLinkCode(code: string): boolean {
  return code.length === 6 || code.length === 8;
}

/**
 * Debounced child profile lookup for complete 6- or 8-char codes,
 * with stale-response cancellation so fast typing never flashes outdated profiles.
 */
export function useLinkInfoPreview(rawCode: string, debounceMs = 220) {
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const clearLinkInfo = useCallback(() => {
    setLinkInfo(null);
    setIsLookingUp(false);
  }, []);

  useEffect(() => {
    const cleanCode = sanitizeLinkCodeInput(rawCode);
    if (!isCompleteLinkCode(cleanCode)) {
      setLinkInfo(null);
      setIsLookingUp(false);
      return;
    }

    let cancelled = false;
    setIsLookingUp(true);

    const timer = setTimeout(async () => {
      try {
        const info = await apiService.getLinkInfo(cleanCode);
        if (!cancelled) {
          setLinkInfo(info);
        }
      } catch {
        if (!cancelled) {
          setLinkInfo(null);
        }
      } finally {
        if (!cancelled) {
          setIsLookingUp(false);
        }
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rawCode, debounceMs]);

  return { linkInfo, isLookingUp, clearLinkInfo };
}

/**
 * Redeems a 6-character guest link code or 8-character device session token,
 * migrates any local guest progress to the linked child profile, refreshes the
 * profile and local cache, and notifies backend activity.
 */
export async function redeemAccountLinkCode(rawCode: string): Promise<string> {
  const cleanCode = extractCodeFromScan(rawCode);
  if (!isCompleteLinkCode(cleanCode)) {
    throw new Error("INVALID_CODE_LENGTH");
  }

  const store = useGameStore.getState();
  const guestProfile = store.guestProfile;

  const result =
    cleanCode.length === 6
      ? await apiService.redeemGuestCode(
          cleanCode,
          guestProfile
            ? {
                displayName: guestProfile.displayName,
                avatarUrl: guestProfile.avatarId,
              }
            : undefined,
        )
      : await apiService.getChildToken(cleanCode);

  apiService.setToken(result.token);
  useGameStore.setState({ parentUser: null, children: [] });

  useGameStore.getState().setChildSession({
    sessionToken: cleanCode,
    parentId: result.parentId,
    childId: result.childId || null,
    jwtToken: result.token,
  });

  // Migrate local guest data first so it is not lost, then clear local guest state
  let migratedOrEmpty = false;
  try {
    const payload = await guestDb.getAllDataForMigration();
    if (payload.matches.length > 0 || payload.homeworkSessions.length > 0) {
      await apiService.migrateLocalGuestData(payload, result.token);
    }
    migratedOrEmpty = true;
  } catch (err) {
    console.warn("Guest data migration skipped:", err);
  }

  if (migratedOrEmpty) {
    await guestDb.clearAllGuestData().catch(() => {});
    useGameStore.getState().clearGuestProfile();
  }

  // Hydrate child profile from backend (with direct token payload fallback)
  try {
    const me = (await apiService.getMe()) as any;
    const guestResult = result as {
      displayName?: string;
      avatarUrl?: string;
      grade?: string;
    };
    if (me || guestResult.displayName) {
      useGameStore.getState().setChildProfile({
        displayName: me?.displayName ?? guestResult.displayName ?? "",
        avatarUrl: me?.avatarUrl ?? guestResult.avatarUrl ?? "",
        grade: me?.grade ?? guestResult.grade ?? "",
      });
    }
  } catch (err) {
    console.warn("Failed to fetch linked child profile immediately:", err);
  }

  await apiService.syncBackendDataToLocal().catch(() => {});
  if (result.childId) {
    apiService.reportChildActive(result.childId).catch(() => {});
  }
  NotificationService.sendSignInNotification();

  return cleanCode;
}
