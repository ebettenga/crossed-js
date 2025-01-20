import { useEffect } from "react";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { storage } from "./storageApi";
import { useColorScheme as useSystemColorScheme } from "react-native";

const COLOR_SCHEME_KEY = "color-scheme";

export type ColorScheme = "light" | "dark" | "system";

export function useColorMode() {
  const { colorScheme, setColorScheme: setNativeWindColorScheme } =
    useNativeWindColorScheme();
  const systemColorScheme = useSystemColorScheme();

  useEffect(() => {
    // Load saved color scheme on mount
    const loadColorScheme = async () => {
      const savedScheme = await storage.getString(COLOR_SCHEME_KEY);
      if (savedScheme) {
        if (savedScheme === "system") {
          setNativeWindColorScheme(systemColorScheme as "light" | "dark");
        } else {
          setNativeWindColorScheme(savedScheme as "light" | "dark");
        }
      }
    };
    loadColorScheme();
  }, []);

  // Update theme when system theme changes if using system theme
  useEffect(() => {
    const checkSystemTheme = async () => {
      const savedScheme = await storage.getString(COLOR_SCHEME_KEY);
      if (savedScheme === "system") {
        setNativeWindColorScheme(systemColorScheme as "light" | "dark");
      }
    };
    checkSystemTheme();
  }, [systemColorScheme]);

  const setAndPersistColorScheme = async (scheme: ColorScheme) => {
    console.log("setAndPersistColorScheme", scheme);
    if (scheme === "system") {
      setNativeWindColorScheme(systemColorScheme as "light" | "dark");
      await storage.set(COLOR_SCHEME_KEY, "system");
    } else {
      setNativeWindColorScheme(scheme);
      await storage.set(COLOR_SCHEME_KEY, scheme);
    }
  };

  return {
    colorScheme,
    setColorScheme: setAndPersistColorScheme,
    isDark: colorScheme === "dark",
  };
}
