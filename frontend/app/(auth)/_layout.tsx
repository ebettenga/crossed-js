import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalContext } from "@/lib/global-provider";
import { Redirect } from "expo-router";

export default function AuthLayout() {
  const { isLoggedIn, user } = useGlobalContext();

  // If logged in, redirect to main app
  if (isLoggedIn && user) {
    return <Redirect href="/(root)" />;
  }

  return (
    <SafeAreaView className="bg-white h-full">
      <Slot />
    </SafeAreaView>
  );
} 