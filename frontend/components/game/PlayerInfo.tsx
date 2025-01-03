import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Player } from '~/hooks/socket';

interface PlayerInfoProps {
  players: Player[];
  scores: { [key: string]: number };
}

export const PlayerInfo: React.FC<PlayerInfoProps> = ({ players, scores }) => {
  return (
    <View style={styles.container}>
      {players.map((player) => (
        <View key={player.id} style={styles.playerCard}>
          <Text style={styles.username}>{player.username}</Text>
          <Text style={styles.score}>Score: {scores[player.id] || 0}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
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
  },
  score: {
    fontSize: 14,
    color: '#2B2B2B',
  },
}); 