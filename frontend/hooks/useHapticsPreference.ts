import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const HAPTICS_ENABLED_KEY = "@crossed_js:haptics_enabled";

export function useHapticsPreference() {
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const saved = await AsyncStorage.getItem(HAPTICS_ENABLED_KEY);
        if (!cancelled && saved !== null) {
          setIsHapticsEnabled(JSON.parse(saved));
        }
      } catch {
        // Ignore storage read errors; fallback to default
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setHapticsEnabled = useCallback((value: boolean) => {
    setIsHapticsEnabled(value);
    AsyncStorage.setItem(HAPTICS_ENABLED_KEY, JSON.stringify(value)).catch(
      () => {},
    );
  }, []);

  return { isHapticsEnabled, setHapticsEnabled };
}
