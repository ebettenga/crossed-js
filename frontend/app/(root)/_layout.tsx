import React from 'react';
import { Slot, usePathname } from 'expo-router';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
  const pathname = usePathname();
  const onGameScreen = pathname === '/game';

  const edges: Edge[] = ['left', 'right'];

  if (onGameScreen || __DEV__) {
    edges.push('bottom');
  }
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417] h-full">
      <Slot />
    </SafeAreaView>
  );
}
