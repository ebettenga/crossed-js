import React from 'react';
import { GameScreen } from '~/screens/GameScreen';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Game() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <GameScreen />
    </SafeAreaView>
  );
} 