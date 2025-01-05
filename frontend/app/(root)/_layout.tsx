import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaView className="bg-white h-full">
      <Slot />
    </SafeAreaView>
  );
}