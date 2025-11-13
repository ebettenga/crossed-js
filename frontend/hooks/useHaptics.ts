import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useHapticsPreference } from "./useHapticsPreference";

export function useHaptics() {
  const { isHapticsEnabled, setHapticsEnabled } = useHapticsPreference();

  const selection = useCallback(() => {
    if (!isHapticsEnabled) return;
    Haptics.selectionAsync().catch(() => {});
  }, [isHapticsEnabled]);

  const previewSelection = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const impact = useCallback(
    (
      style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
    ) => {
      if (!isHapticsEnabled) return;
      Haptics.impactAsync(style).catch(() => {});
    },
    [isHapticsEnabled],
  );

  const notification = useCallback(
    (
      type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType
        .Success,
    ) => {
      if (!isHapticsEnabled) return;
      Haptics.notificationAsync(type).catch(() => {});
    },
    [isHapticsEnabled],
  );

  return {
    isHapticsEnabled,
    setHapticsEnabled,
    selection,
    previewSelection,
    impact,
    notification,
  };
}
