import React from 'react';
import { GameScreen } from '~/screens/GameScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

export default function Game() {
  const { roomId } = useLocalSearchParams();


  return (
    <>
      <SafeAreaView className="flex-1 bg-[#F5F5EB] dark:bg-[#0F1417]">
        <GameScreen roomId={parseInt(roomId as string)} />
      </SafeAreaView>
    </>
  );
}
