import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { HomeHeader } from '~/components/home/HomeHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '~/hooks/users';
import { Trophy, Target, Percent, TrendingUp } from 'lucide-react-native';

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

export default function Stats() {
    const insets = useSafeAreaInsets();
    const { data: user } = useUser();

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
                    {/* Add recent games list here */}
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
});
