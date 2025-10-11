import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SOUND_ENABLED_KEY = "@crossed_js:sound_enabled";

export function useSoundPreference() {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
        if (!cancelled && saved !== null) {
          setIsSoundEnabled(JSON.parse(saved));
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSoundEnabled = useCallback((value: boolean) => {
    setIsSoundEnabled(value);
    AsyncStorage.setItem(SOUND_ENABLED_KEY, JSON.stringify(value)).catch(
      () => {},
    );
  }, []);

  return { isSoundEnabled, setSoundEnabled };
}
