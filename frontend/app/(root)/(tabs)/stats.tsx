import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { HomeHeader } from '~/components/home/HomeHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '~/hooks/users';
import { useRecentGames, RecentGame } from '~/hooks/useRecentGames';
import { Trophy, Target, TrendingUp, Crown, X } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';

interface StatCardProps {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    suffix?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, suffix }) => (
    <View style={styles.statCard}>
        <View style={styles.statHeader}>
            <Text style={styles.statTitle}>{title}</Text>
            {icon}
        </View>
        <Text style={styles.statValue}>
            {value}{suffix}
        </Text>
    </View>
);

interface GameRowProps {
    game: RecentGame;
    userId: number;
}

const GameRow: React.FC<GameRowProps> = ({ game, userId }) => {
    const userScore = game.room.scores[userId] || 0;
    const otherScores = Object.entries(game.room.scores)
        .filter(([id]) => id !== userId.toString())
        .map(([_, score]) => score);
    const highestOtherScore = Math.max(0, ...otherScores);

    return (
        <View style={styles.gameRow}>
            <View style={styles.gameInfo}>
                <View style={styles.gameHeader}>
                    <Text style={styles.gameType}>
                        {game.room.type.toUpperCase()} • {game.room.difficulty}
                    </Text>
                    <Text style={styles.gameTime}>
                        {formatDistanceToNow(new Date(game.room.created_at), { addSuffix: true })}
                    </Text>
                </View>
                <View style={styles.scoreRow}>
                    <Text style={styles.score}>
                        {userScore} pts
                    </Text>
                    {game.stats.isWinner ? (
                        <Crown size={20} color="#FFD700" />
                    ) : (
                        <X size={20} color="#EF4444" />
                    )}
                </View>
                <View style={styles.statsRow}>
                    <Text style={styles.statText}>
                        {game.stats.correctGuesses} correct • {game.stats.incorrectGuesses} incorrect
                    </Text>
                    <Text style={styles.eloText}>
                        {game.stats.eloAtGame} ELO
                    </Text>
                </View>
            </View>
        </View>
    );
};

export default function Stats() {
    const insets = useSafeAreaInsets();
    const { data: user } = useUser();
    const { data: recentGames, isLoading: gamesLoading } = useRecentGames();

    if (!user) return null;

    return (
        <View style={styles.container}>
            <HomeHeader 
                username={user.username}
                elo={user.eloRating}
                eloChange={0}
                gamesPlayed={user.gamesWon + user.gamesLost}
                avatarUrl={"https://i.pravatar.cc/150"}
                coins={42}
            />
            <ScrollView 
                style={styles.content}
                contentContainerStyle={[
                    styles.contentContainer,
                    { paddingBottom: insets.bottom + 90 }
                ]}
            >
                <View style={styles.statsGrid}>
                    <StatCard
                        title="Games Won"
                        value={user.gamesWon}
                        icon={<Trophy size={24} color="#FFD700" />}
                    />
                    <StatCard
                        title="Games Lost"
                        value={user.gamesLost}
                        icon={<Trophy size={24} color="#C0C0C0" />}
                    />
                    <StatCard
                        title="Win Rate"
                        value={user.winRate}
                        suffix="%"
                        icon={<TrendingUp size={24} color="#34D399" />}
                    />
                    <StatCard
                        title="Guess Accuracy"
                        value={user.guessAccuracy}
                        suffix="%"
                        icon={<Target size={24} color="#8B0000" />}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent Games</Text>
                    {gamesLoading ? (
                        <ActivityIndicator size="large" color="#8B0000" />
                    ) : recentGames?.length === 0 ? (
                        <Text style={styles.emptyText}>No games played yet</Text>
                    ) : (
                        <View style={styles.gamesList}>
                            {recentGames?.map(game => (
                                <GameRow 
                                    key={game.room.id} 
                                    game={game}
                                    userId={user.id}
                                />
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#F8F8F5',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statTitle: {
        fontSize: 14,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2B2B2B',
        marginBottom: 12,
        fontFamily: 'Times New Roman',
    },
    gamesList: {
        gap: 12,
    },
    gameRow: {
        backgroundColor: '#F8F8F5',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    gameInfo: {
        gap: 8,
    },
    gameHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    gameType: {
        fontSize: 14,
        color: '#666666',
        fontFamily: 'Times New Roman',
        fontWeight: '600',
    },
    gameTime: {
        fontSize: 12,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    score: {
        fontSize: 20,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statText: {
        fontSize: 14,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    eloText: {
        fontSize: 14,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    emptyText: {
        textAlign: 'center',
        color: '#666666',
        fontFamily: 'Times New Roman',
        fontSize: 16,
        paddingVertical: 24,
    },
});
