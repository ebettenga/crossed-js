import { Slot, SplashScreen, useRouter, useSegments } from "expo-router";

import "./globals.css";
import { useEffect, useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PortalHost } from '@rn-primitives/portal';
import { RoomProvider, SocketProvider } from '~/hooks/socket';
import { ChallengeProvider } from '~/hooks/useChallenge';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useUser } from "~/hooks/users";
import Toast from "react-native-toast-message";
import { useColorMode } from "~/hooks/useColorMode";
import { SafeAreaView } from "react-native";
import { IncomingChallengeModal } from '~/components/IncomingChallengeModal';

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
      <Slot screenOptions={{ headerShown: false }} />
      <PortalHost />
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <RoomProvider>
          <ChallengeProvider>
            <AppContent />
            <IncomingChallengeModal />
            <Toast />
          </ChallengeProvider>
        </RoomProvider>
      </SocketProvider>
    </QueryClientProvider>
  );
}
