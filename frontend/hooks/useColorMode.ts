import { useEffect } from "react";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { useColorScheme as useSystemColorScheme } from "react-native";

export type ColorScheme = "light" | "dark" | "system";

export function useColorMode() {
  const { colorScheme, setColorScheme: setNativeWindColorScheme } =
    useNativeWindColorScheme();
  const systemColorScheme = useSystemColorScheme();

  // Update theme when system theme changes if using system theme
  useEffect(() => {
    loadColorScheme();
  }, []);

  const loadColorScheme = async () => {
    if (systemColorScheme) {
      setNativeWindColorScheme(systemColorScheme as "light" | "dark");
    }
  };

  return {
    loadColorScheme,
    colorScheme,
    isDark: colorScheme === "dark",
  };
}
