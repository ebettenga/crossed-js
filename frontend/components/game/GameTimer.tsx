import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Clock } from 'lucide-react-native';

interface GameTimerProps {
  startTime: string;
  completedAt?: string;
}

export const GameTimer: React.FC<GameTimerProps> = ({ startTime, completedAt }) => {
  const [elapsedTime, setElapsedTime] = useState('');

  useEffect(() => {
    if (completedAt) {
      const start = new Date(startTime).getTime();
      const end = new Date(completedAt).getTime();
      const diff = end - start;

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setElapsedTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      return;
    }

    const updateTimer = () => {
      const start = new Date(startTime).getTime();
      const end = Date.now();
      const diff = end - start;

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setElapsedTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    // Update immediately
    updateTimer();

    // Update every second for ongoing games
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime, completedAt]);

  return (
    <View className="flex-row items-center gap-1 bg-white dark:bg-neutral-800 px-2.5 py-1 rounded-xl border border-neutral-200 dark:border-neutral-700">
      <Clock size={16} className="text-[#666666] dark:text-neutral-400" />
      <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
        {elapsedTime}
      </Text>
    </View>
  );
};
