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
import { IncomingChallengeModal } from '~/components/IncomingChallengeModal';
import { secureStorage } from '~/hooks/storageApi';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AppContent() {
  const segments = useSegments();
  const router = useRouter();
  const { data: user, isLoading } = useUser();
  const [isReady, setIsReady] = useState(false);
  const [hasCheckedHowTo, setHasCheckedHowTo] = useState(false);
  const [shouldShowHowTo, setShouldShowHowTo] = useState(false);
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
      if (!hasCheckedHowTo) {
        return;
      }

      if (shouldShowHowTo) {
        router.replace('/(root)/how-to-play?source=login');
      } else {
        router.replace('/(root)/(tabs)');
      }
    } else if (!user && !inAuthGroup) {
      // Redirect to sign in if user is not signed in and not in auth group
      router.replace('/(auth)/signin');
    }
  }, [user, segments, isReady, hasCheckedHowTo, shouldShowHowTo]);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  useEffect(() => {
    if (!isReady || !user || hasCheckedHowTo) {
      return;
    }

    let isMounted = true;

    const checkHowTo = async () => {
      try {
        const seen = await secureStorage.get(`how_to_play_seen_${user.id}`);
        if (!isMounted) {
          return;
        }

        const shouldShow = !seen;
        setShouldShowHowTo(shouldShow);

        if (shouldShow) {
          router.replace('/(root)/how-to-play?source=login');
        }
      } catch (error) {
        if (isMounted) {
          setShouldShowHowTo(false);
        }
      } finally {
        if (isMounted) {
          setHasCheckedHowTo(true);
        }
      }
    };

    checkHowTo();

    return () => {
      isMounted = false;
    };
  }, [isReady, user, hasCheckedHowTo, router]);

  useEffect(() => {
    if (!user) {
      setHasCheckedHowTo(false);
      setShouldShowHowTo(false);
    }
  }, [user]);

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
