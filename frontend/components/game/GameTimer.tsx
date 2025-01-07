import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';

interface GameTimerProps {
  startTime: string;
}

export const GameTimer: React.FC<GameTimerProps> = ({ startTime }) => {
  const [elapsedTime, setElapsedTime] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const diff = now - start;

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setElapsedTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <View style={styles.container}>
      <Clock size={16} color="#666666" />
      <Text style={styles.timerText}>{elapsedTime}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  timerText: {
    fontSize: 14,
    fontFamily: 'Times New Roman',
    color: '#666666',
  },
}); 