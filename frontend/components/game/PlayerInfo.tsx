import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Player } from '~/hooks/useRoom';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  withSequence,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';

interface PlayerInfoProps {
  players: Player[];
  scores: { [key: string]: number };
}

const ScoreChange: React.FC<{ value: number }> = ({ value }) => {
  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  useEffect(() => {
    opacity.value = 1;
    translateX.value = 0;
    
    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 1000 })
    );
    translateX.value = withTiming(30, { duration: 1100 });
  }, [value]);

  if (value === 0) return null;

  return (
    <Animated.Text 
      style={[
        styles.scoreChange,
        animatedStyle,
        { color: value > 0 ? '#34D399' : '#DC2626' }
      ]}
    >
      {value > 0 ? `+${value}` : value}
    </Animated.Text>
  );
};

export const PlayerInfo: React.FC<PlayerInfoProps> = ({ players, scores }) => {
  const prevScores = useRef<{ [key: string]: number }>({});
  const [scoreChanges, setScoreChanges] = React.useState<{ [key: string]: number }>({});

  useEffect(() => {
    // Calculate score changes
    const changes: { [key: string]: number } = {};
    players.forEach((player) => {
      const currentScore = scores[player.id] || 0;
      const previousScore = prevScores.current[player.id] || 0;
      const change = currentScore - previousScore;
      if (change !== 0) {
        changes[player.id] = change;
      }
    });

    // Update score changes if there are any
    if (Object.keys(changes).length > 0) {
      setScoreChanges(changes);
      // Clear changes after animation duration
      setTimeout(() => {
        setScoreChanges({});
      }, 1100);
    }

    // Update previous scores
    prevScores.current = scores;
  }, [scores, players]);

  return (
    <View style={styles.container}>
      {players.map((player) => (
        <View key={player.id} style={styles.playerCard}>
          <Text style={styles.username}>{player.username}</Text>
          <View style={styles.scoreContainer}>
            <Text style={styles.score}>Score: {scores[player.id] || 0}</Text>
            <ScoreChange value={scoreChanges[player.id] || 0} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    padding: 16,
    paddingBottom: 0,
    gap: 16,
  },
  playerCard: {
    padding: 12,
    backgroundColor: '#F5F5EB',
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 4,
    fontFamily: 'Times New Roman',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  score: {
    fontSize: 14,
    color: '#2B2B2B',
    fontFamily: 'Times New Roman',
  },
  scoreChange: {
    fontSize: 14,
    fontWeight: '600',
    position: 'absolute',
    left: '70%',
    marginLeft: 2,
    fontFamily: 'Times New Roman',
  },
}); 