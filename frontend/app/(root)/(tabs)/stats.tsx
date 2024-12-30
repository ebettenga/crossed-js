import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { 
    TrendingUp, 
    Trophy, 
    Timer, 
    BarChart, 
    Target,
    Brain,
    Zap
} from 'lucide-react-native';
import { HomeHeader } from '~/components/home/HomeHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, subtitle }) => (
    <View style={styles.card}>
        <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{title}</Text>
            <View style={styles.iconContainer}>
                {icon}
            </View>
        </View>
        <Text style={styles.value}>{value}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
);

export default function Stats() {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <HomeHeader 
                username="John Doe"
                elo={1250}
                eloChange={25}
                gamesPlayed={42}
                avatarUrl="https://i.pravatar.cc/300"
                coins={100}
            />
            <ScrollView 
                style={styles.content}
                contentContainerStyle={[
                    styles.contentContainer,
                    { paddingBottom: insets.bottom + 90 }
                ]}
            >
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Performance</Text>
                    <View style={styles.row}>
                        <StatCard
                            title="Win Rate"
                            value="68%"
                            icon={<Trophy size={20} color="#8B0000" />}
                            subtitle="Last 20 games"
                        />
                        <StatCard
                            title="Avg. Score"
                            value="2,450"
                            icon={<Target size={20} color="#8B0000" />}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Game Stats</Text>
                    <View style={styles.row}>
                        <StatCard
                            title="Games Won"
                            value="156"
                            icon={<TrendingUp size={20} color="#8B0000" />}
                        />
                        <StatCard
                            title="Avg. Time"
                            value="2:30"
                            icon={<Timer size={20} color="#8B0000" />}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Word Stats</Text>
                    <View style={styles.row}>
                        <StatCard
                            title="Longest Word"
                            value="QUIXOTIC"
                            icon={<Brain size={20} color="#8B0000" />}
                        />
                        <StatCard
                            title="Words/Game"
                            value="12.5"
                            icon={<Zap size={20} color="#8B0000" />}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Rankings</Text>
                    <View style={styles.rankCard}>
                        <View style={styles.rankRow}>
                            <BarChart size={20} color="#8B0000" />
                            <Text style={styles.rankText}>Global Rank: #1,234</Text>
                        </View>
                        <View style={styles.rankRow}>
                            <Trophy size={20} color="#8B0000" />
                            <Text style={styles.rankText}>Top 5% of Players</Text>
                        </View>
                    </View>
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
        padding: 16,
    },
    contentContainer: {
        paddingBottom: 90,
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
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    card: {
        flex: 1,
        backgroundColor: '#F8F8F5',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 14,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    value: {
        fontSize: 24,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    subtitle: {
        fontSize: 12,
        color: '#666666',
        marginTop: 4,
        fontFamily: 'Times New Roman',
    },
    rankCard: {
        backgroundColor: '#F8F8F5',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        gap: 12,
    },
    rankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rankText: {
        fontSize: 16,
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
});
