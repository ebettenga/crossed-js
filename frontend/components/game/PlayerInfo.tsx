import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { Player } from '~/hooks/useRoom';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  withSequence,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { useUser } from '~/hooks/users';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH / 2) - 12; // Half screen minus padding

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
  const { data: currentUser } = useUser();

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

  // Sort players to put current user first
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.id === currentUser?.id) return -1;
    if (b.id === currentUser?.id) return 1;
    return 0;
  });

  return (
    <View style={styles.container}>
      {sortedPlayers.map((player) => (
        <View 
          key={player.id} 
          style={[
            styles.playerCard,
            player.id === currentUser?.id && styles.currentPlayerCard
          ]}
        >
          <Text style={[
            styles.username,
            player.id === currentUser?.id && styles.currentPlayerText
          ]}>
            {player.username}
          </Text>
          <View style={styles.scoreContainer}>
            <Text style={[
              styles.score,
              player.id === currentUser?.id && styles.currentPlayerText
            ]}>
              {scores[player.id] || 0}
            </Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingTop: 16,
    paddingBottom: 0,
  },
  playerCard: {
    padding: 8,
    backgroundColor: '#F5F5EB',
    borderRadius: 8,
    width: CARD_WIDTH,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currentPlayerCard: {
    backgroundColor: '#8B0000',
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B2B2B',
    fontFamily: 'Times New Roman',
  },
  currentPlayerText: {
    color: '#FFFFFF',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  score: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2B2B2B',
    fontFamily: 'Times New Roman',
  },
  scoreChange: {
    fontSize: 14,
    fontWeight: '600',
    position: 'absolute',
    left: '100%',
    marginLeft: 2,
    fontFamily: 'Times New Roman',
  },
}); 