import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from "expo-router";
import { useUser } from '~/hooks/users';


export default function AuthLayout() {
  const { data: user } = useUser();

  // If logged in, redirect to main app
  if (user) {
    return <Redirect href="/(root)/(tabs)" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417] h-full">
      <Slot />
    </SafeAreaView>
  );
}
