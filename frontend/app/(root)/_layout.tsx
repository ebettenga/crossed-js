import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaView className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417] h-full">
      <Slot />
    </SafeAreaView>
  );
}
