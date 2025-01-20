import React from 'react';
import { GameScreen } from '~/screens/GameScreen';
import { useLocalSearchParams } from 'expo-router';

export default function Game() {
  const { roomId } = useLocalSearchParams();


  return (
    <GameScreen roomId={parseInt(roomId as string)} />
  );
}
