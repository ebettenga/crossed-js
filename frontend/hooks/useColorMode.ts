import { useEffect } from "react";
import { useColorScheme } from "nativewind";
import { storage } from "./storageApi";
import { StatusBar } from "react-native";

const COLOR_SCHEME_KEY = "color-scheme";

export function useColorMode() {
  const { colorScheme, setColorScheme } = useColorScheme();


  useEffect(() => {
    // Load saved color scheme on mount
    const loadColorScheme = async () => {
      const savedScheme = await storage.getString(COLOR_SCHEME_KEY);
      if (savedScheme) {
        setColorScheme(savedScheme as "light" | "dark");
      }
    };
    loadColorScheme();
  }, []);

  const setAndPersistColorScheme = async (scheme: "light" | "dark") => {
    setColorScheme(scheme);
    StatusBar.setBackgroundColor(scheme === "dark" ? "#0F1417" : "#F6FAFE");
    StatusBar.setBarStyle(scheme === "dark" ? "light-content" : "dark-content");
    await storage.set(COLOR_SCHEME_KEY, scheme);
  };

  return {
    colorScheme,
    setColorScheme: setAndPersistColorScheme,
    isDark: colorScheme === "dark",
  };
}
