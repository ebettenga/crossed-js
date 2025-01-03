import React from 'react';
import { GameScreen } from '~/screens/GameScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

export default function Game() {
  const { roomId } = useLocalSearchParams();
  return (
    <SafeAreaView className="flex-1 bg-white">
      <GameScreen roomId={parseInt(roomId as string)} />
    </SafeAreaView>
  );
} 