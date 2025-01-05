import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useUserGameStats, useUser } from '~/hooks/users';

export const PageHeader = React.memo(() => {
    const { data: user } = useUser();
    if (!user) return null;

    // Get stats from the last week
    const oneWeekAgo = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date;
    }, []);

    const { data: weeklyStats } = useUserGameStats(oneWeekAgo);

    // Calculate ELO difference and games played
    const { eloChange, gamesPlayed, isEloUp, eloChangeColor } = useMemo(() => {
        const change = weeklyStats?.length ? user.eloRating - weeklyStats[0].eloAtGame : 0;
        const games = user.gamesWon + user.gamesLost;
        const up = change > 0;
        return {
            eloChange: change,
            gamesPlayed: games,
            isEloUp: up,
            eloChangeColor: up ? '#34D399' : '#EF4444'
        };
    }, [weeklyStats, user.eloRating, user.gamesWon, user.gamesLost]);

    return (
        <View style={styles.container}>
            <View style={styles.userInfo}>
                <View style={styles.leftSection}>
                    {user.photo && (
                        <Image
                            source={{ uri: user.photo }}
                            style={styles.avatar}
                        />
                    )}
                    <View style={styles.nameSection}>
                        <Text style={styles.welcomeText}>Welcome back,</Text>
                        <Text style={styles.username}>{user.username}</Text>
                    </View>
                </View>
                <View style={styles.rightSide}>
                    <View style={styles.stats}>
                        <View style={styles.statItem}>
                            <View style={styles.eloContainer}>
                                <Text style={styles.statValue}>{user.eloRating}</Text>
                                {eloChange !== 0 && (
                                    <View style={styles.eloChange}>
                                        {isEloUp ? (
                                            <TrendingUp size={12} color={eloChangeColor} />
                                        ) : (
                                            <TrendingDown size={12} color={eloChangeColor} />
                                        )}
                                        <Text style={[styles.eloChangeText, { color: eloChangeColor }]}>
                                            {isEloUp ? '+' : ''}{eloChange}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.statLabel}>ELO</Text>
                        </View>

                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{gamesPlayed}</Text>
                            <Text style={styles.statLabel}>Games</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    userInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F5F5EB',
    },
    nameSection: {
        gap: 2,
    },
    welcomeText: {
        fontSize: 12,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    username: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    rightSide: {
        alignItems: 'flex-end',
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F8F8F5',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    statItem: {
        alignItems: 'center',
        gap: 2,
    },
    eloContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    statLabel: {
        fontSize: 12,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: '#E5E5E5',
    },
    eloChange: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    eloChangeText: {
        fontSize: 12,
        fontFamily: 'Times New Roman',
    }
}); 