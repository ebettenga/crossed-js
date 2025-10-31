import { Slot, SplashScreen, useRouter, useSegments } from "expo-router";

import "./globals.css";
import React, { cloneElement, useEffect, useState } from "react";
import { StyleProp, StyleSheet, Text, TextInput, TextStyle } from "react-native";
import { useFonts } from "expo-font";

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

const rubikWeightMap: Record<string, string> = {
  "100": "Rubik-Light",
  "200": "Rubik-Light",
  "300": "Rubik-Light",
  "400": "Rubik-Regular",
  normal: "Rubik-Regular",
  "500": "Rubik-Medium",
  "600": "Rubik-SemiBold",
  "700": "Rubik-Bold",
  bold: "Rubik-Bold",
  "800": "Rubik-ExtraBold",
  "900": "Rubik-ExtraBold",
};

const getRubikFontFamily = (weight: TextStyle["fontWeight"]) => {
  if (!weight) {
    return rubikWeightMap["400"];
  }

  const key = `${weight}`;
  return rubikWeightMap[key] ?? rubikWeightMap["400"];
};

const mapRubikTextStyle = (style: StyleProp<TextStyle>): TextStyle => {
  const flattened = StyleSheet.flatten(style) ?? {};
  const { fontFamily, fontWeight, ...rest } = flattened;
  const normalizedFamily = fontFamily ?? "";
  const shouldOverride =
    !normalizedFamily ||
    normalizedFamily === "Rubik" ||
    normalizedFamily === "Rubik-Regular" ||
    normalizedFamily.includes("Times New Roman") ||
    normalizedFamily.includes("TimesNewRoman");

  if (shouldOverride) {
    return {
      ...rest,
      fontFamily: getRubikFontFamily(fontWeight),
    };
  }

  if (normalizedFamily.startsWith("Rubik-") && fontWeight) {
    return {
      ...rest,
      fontFamily: normalizedFamily,
    };
  }

  return {
    ...rest,
    fontFamily: normalizedFamily,
    ...(fontWeight ? { fontWeight } : {}),
  };
};

let rubikFontsConfigured = false;

const configureRubikFonts = () => {
  if (rubikFontsConfigured) {
    return;
  }

  const patchComponent = (Component: typeof Text | typeof TextInput) => {
    const componentAny = Component as unknown as {
      render?: (...args: unknown[]) => React.ReactElement | null;
      __rubikPatched?: boolean;
    };
    const originalRender = componentAny.render;
    if (!originalRender || componentAny.__rubikPatched) {
      return;
    }

    componentAny.__rubikPatched = true;
    componentAny.render = function (...args: unknown[]) {
      const element = originalRender.apply(this, args);
      if (!element) {
        return element;
      }

      const props = element.props ?? {};
      const mappedStyle = mapRubikTextStyle(props.style);

      return cloneElement(element, {
        ...props,
        style: mappedStyle,
      });
    };
  };

  patchComponent(Text);
  patchComponent(TextInput);

  rubikFontsConfigured = true;
};

function AppContent() {
  const segments = useSegments();
  const router = useRouter();
  const { data: user, isLoading } = useUser();
  const [isReady, setIsReady] = useState(false);
  const [hasCheckedHowTo, setHasCheckedHowTo] = useState(false);
  const [shouldShowHowTo, setShouldShowHowTo] = useState(false);
  const { loadColorScheme } = useColorMode();
  const [fontsLoaded, fontError] = useFonts({
    "Rubik-Light": require("../assets/fonts/Rubik-Light.ttf"),
    "Rubik-Regular": require("../assets/fonts/Rubik-Regular.ttf"),
    "Rubik-Medium": require("../assets/fonts/Rubik-Medium.ttf"),
    "Rubik-SemiBold": require("../assets/fonts/Rubik-SemiBold.ttf"),
    "Rubik-Bold": require("../assets/fonts/Rubik-Bold.ttf"),
    "Rubik-ExtraBold": require("../assets/fonts/Rubik-ExtraBold.ttf"),
  });

  useEffect(() => {
    loadColorScheme();
  }, []);

  useEffect(() => {
    if (fontError) {
      throw fontError;
    }
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded) {
      configureRubikFonts();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      setIsReady(true);
    }
  }, [isLoading, fontsLoaded]);

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
