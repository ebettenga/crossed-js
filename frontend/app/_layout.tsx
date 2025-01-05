import { Slot, SplashScreen } from "expo-router";
import { useReactQueryDevTools } from '@dev-plugins/react-query';

import "./globals.css";
import { useEffect, useState } from "react";
import GlobalProvider from "@/lib/global-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useColorScheme } from "@/lib/useColorScheme";
import { NAV_THEME } from "@/lib/constants";
import { Theme } from "@react-navigation/native";
import { Platform } from "react-native";
import { storage } from "@/hooks/storageApi";
import { PortalHost } from '@rn-primitives/portal';
import { RoomProvider, SocketProvider } from '~/hooks/socket';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useUser } from "~/hooks/users";

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

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AppContent() {

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Slot screenOptions={{ headerShown: false }} />
      <PortalHost />
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  useReactQueryDevTools(queryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalProvider>
        <SocketProvider>
          <RoomProvider>
            <AppContent />
          </RoomProvider>
        </SocketProvider>
      </GlobalProvider>
    </QueryClientProvider>
  );
}
