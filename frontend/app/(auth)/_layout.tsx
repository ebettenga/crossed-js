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
    <SafeAreaView className="bg-white h-full">
      <Slot />
    </SafeAreaView>
  );
}
