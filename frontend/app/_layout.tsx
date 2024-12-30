import { SplashScreen, Stack } from "expo-router";
import { useReactQueryDevTools } from '@dev-plugins/react-query';

import "./globals.css";
import { useEffect, useState } from "react";
import GlobalProvider from "@/lib/global-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useColorScheme } from "@/lib/useColorScheme";
import { NAV_THEME } from "@/lib/constants";
import { Theme, ThemeProvider } from "@react-navigation/native";
import { Platform, StatusBar } from "react-native";
import { storage } from "@/hooks/storageApi";
import { PortalHost } from '@rn-primitives/portal';
import { SocketProvider } from "~/hooks/socket";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// @ts-ignore
const LIGHT_THEME: Theme = {
  dark: false,
  colors: NAV_THEME.light,
};
// @ts-ignore
const DARK_THEME: Theme = {
  dark: true,
  colors: NAV_THEME.dark,
};


// Prevent the splash screen from auto-hiding before getting the color scheme.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  useReactQueryDevTools(queryClient);
  const { colorScheme, setColorScheme, isDarkColorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const theme = await storage.getString('theme') as 'light' | 'dark' | 'system';
      if (Platform.OS === 'web') {
        // Adds the background color to the html element to prevent white background on overscroll.
        document.documentElement.classList.add('bg-background');
      }
      if (!theme) {
        storage.set('theme', colorScheme);
        setIsColorSchemeLoaded(true);
        return;
      }
      const colorTheme = theme || "light";
      if (colorTheme !== colorScheme) {
        setColorScheme(colorTheme);

        setIsColorSchemeLoaded(true);
        return;
      }
      setIsColorSchemeLoaded(true);
    })().finally(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalProvider>
        <SocketProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />
            <PortalHost />
          </GestureHandlerRootView>
        </SocketProvider>
      </GlobalProvider>
    </QueryClientProvider>
  );
}
