import { Slot, SplashScreen, useRouter, useSegments, Stack } from "expo-router";

import "./globals.css";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PortalHost } from '@rn-primitives/portal';
import { RoomProvider, SocketProvider } from '~/hooks/socket';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useUser } from "~/hooks/users";
import { useColorMode } from "~/hooks/useColorMode";
import { useColorScheme } from 'react-native';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AppContent() {
  const segments = useSegments();
  const router = useRouter();
  const { data: user, isLoading } = useUser();
  const [isReady, setIsReady] = useState(false);
  const { loadColorScheme } = useColorMode();

  useEffect(() => {
    loadColorScheme();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setIsReady(true);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (user && inAuthGroup) {
      // Redirect to home if user is signed in and in auth group
      router.replace('/(root)/(tabs)');
    } else if (!user && !inAuthGroup) {
      // Redirect to sign in if user is not signed in and not in auth group
      router.replace('/(auth)/signin');
    }
  }, [user, segments, isReady]);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Slot />
      </Stack>
      <PortalHost />
    </GestureHandlerRootView>
  );
}

const RootLayout = () => {
  const colorScheme = useColorScheme();

  return (
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <RoomProvider>
              <AppContent />
          </RoomProvider>
        </SocketProvider>
      </QueryClientProvider>
  );
};

export default RootLayout;
