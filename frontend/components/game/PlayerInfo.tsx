import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';

interface Player {
  name: string;
  elo: number;
  score: number;
  avatarUrl?: string;
  isCurrentPlayer?: boolean;
}

interface PlayerInfoProps {
  players: Player[];
  gameTitle?: string;
}

export const PlayerInfo: React.FC<PlayerInfoProps> = ({ 
  players,
  gameTitle = "1v1 Classic" // Default title
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>{gameTitle}</Text>
      </View>
      <ScrollView 
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {players.map((player, index) => (
          <View 
            key={index} 
            style={[
              styles.playerSection,
              player.isCurrentPlayer && styles.currentPlayer,
              index !== players.length - 1 && styles.playerSectionMargin
            ]}
          >
            <View style={styles.avatarContainer}>
              {player.avatarUrl ? (
                <Image 
                  source={{ uri: player.avatarUrl }} 
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.placeholderAvatar]}>
                  <Text style={styles.avatarText}>
                    {player.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.infoContainer}>
              <Text 
                style={styles.name}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {player.name}
              </Text>
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>ELO</Text>
                  <Text style={styles.statValue}>{player.elo}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Score</Text>
                  <Text style={styles.statValue}>{player.score}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#333',
    textAlign: 'left',
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  playerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    minWidth: 160, // Ensure minimum width for readability
    backgroundColor: 'white',
  },
  playerSectionMargin: {
    marginRight: 8,
  },
  currentPlayer: {
    backgroundColor: '#F5F5F5',
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  placeholderAvatar: {
    backgroundColor: '#0061ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
    minWidth: 80, // Ensure stats have room
  },
  name: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#333',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: 'bold',
  },
}); 