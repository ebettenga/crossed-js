import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { PageHeader } from '~/components/Header';
import { EloChart } from '~/components/stats/EloChart';
import { AccuracyChart } from '~/components/stats/AccuracyChart';
import { useUser } from '~/hooks/users';    
import { useSuperwall } from "@/lib/superwall";


export default function StatsScreen() {
  const { data: user } = useUser();
  const { register } = useSuperwall();
  const [showingDetailedStats, setShowingDetailedStats] = useState(false);

  const handleViewDetailedStats = async () => {
    await register('example-paywall-acfa-2025-01-05');
    
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.container}>
      <PageHeader />
      
      {/* Basic Stats - Free for all users */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Games Played</Text>
            <Text style={styles.statValue}>{user.gamesWon + user.gamesLost}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Win Rate</Text>
            <Text style={styles.statValue}>{user.winRate}%</Text>
          </View>
        </View>
      </View>

      {/* Detailed Stats - Premium Only */}
      {( showingDetailedStats) ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detailed Stats</Text>
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>ELO Rating History</Text>
            <EloChart />
          </View>
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Guess Accuracy Over Time</Text>
            <AccuracyChart />
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.detailedStatBox}>
              <Text style={styles.statLabel}>Average Guess Time</Text>
              <Text style={styles.statValue}>2.3s</Text>
            </View>
            <View style={styles.detailedStatBox}>
              <Text style={styles.statLabel}>Best Win Streak</Text>
              <Text style={styles.statValue}>5</Text>
            </View>
            <View style={styles.detailedStatBox}>
              <Text style={styles.statLabel}>Accuracy</Text>
              <Text style={styles.statValue}>{user.guessAccuracy}%</Text>
            </View>
            <View style={styles.detailedStatBox}>
              <Text style={styles.statLabel}>ELO Rating</Text>
              <Text style={styles.statValue}>{user.eloRating}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.premiumPrompt}>
          <Text style={styles.premiumTitle}>Unlock Detailed Stats</Text>
          <Text style={styles.premiumDescription}>
            Get access to detailed statistics including ELO rating history, 
            accuracy trends, and more advanced metrics.
          </Text>
          <TouchableOpacity onPress={() => handleViewDetailedStats()}>
            <Text style={styles.upgradeButton}>
              Upgrade to Premium
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  section: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#2B2B2B',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  chartContainer: {
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2B2B2B',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailedStatBox: {
    width: '48%',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  premiumPrompt: {
    margin: 16,
    padding: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    alignItems: 'center',
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8B0000',
    marginBottom: 8,
  },
  premiumDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  upgradeButton: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    backgroundColor: '#8B0000',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
