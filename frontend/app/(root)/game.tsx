import React, { useEffect } from 'react';
import { GameScreen } from '~/screens/GameScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'react-native';

export default function Game() {
  const { roomId } = useLocalSearchParams();

  useEffect(() => {
    StatusBar.setBackgroundColor('#F5F5EB');
    StatusBar.setBarStyle('dark-content');
}, []);


  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5EB" />
      <SafeAreaView className="flex-1 bg-[#F5F5EB]">
        <GameScreen roomId={parseInt(roomId as string)} />
      </SafeAreaView>
    </>
  );
} 