import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Coins, TrendingUp, TrendingDown } from 'lucide-react-native';
import { Link } from 'expo-router';

interface HomeHeaderProps {
    username?: string;
    elo?: number;
    eloChange?: number;
    gamesPlayed?: number;
    avatarUrl?: string;
    coins?: number;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
    username = "Player",
    elo = 1200,
    eloChange = 0,
    gamesPlayed = 0,
    avatarUrl,
    coins = 0
}) => {
    const isEloUp = eloChange > 0;
    const eloChangeColor = isEloUp ? '#34D399' : '#EF4444';

    return (
        <View style={styles.container}>
            <View style={styles.userInfo}>
                <View style={styles.leftSection}>
                    {avatarUrl && (
                        <Image
                            source={{ uri: avatarUrl }}
                            style={styles.avatar}
                        />
                    )}
                    <View style={styles.nameSection}>
                        <Text style={styles.welcomeText}>Welcome back,</Text>
                        <Text style={styles.username}>{username}</Text>
                    </View>
                </View>
                <View style={styles.rightSide}>
                    <View style={styles.stats}>
                        <View style={styles.statItem}>
                            <View style={styles.eloContainer}>
                                <Text style={styles.statValue}>{elo}</Text>
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
                    <Link href="/store">
                        <View style={styles.coinsButton}>
                            <Coins size={18} color="#E6C200" />
                            <Text style={styles.coinsText}>{coins}</Text>
                        </View>
                    </Link>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 24,
        backgroundColor: 'white',
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
        flex: 1,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5EB',
    },
    nameSection: {
        flex: 1,
        marginRight: 16,
    },
    welcomeText: {
        fontSize: 14,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    username: {
        fontSize: 24,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginLeft: 'auto',
    },
    statItem: {
        alignItems: 'center',
        minWidth: 50,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    statLabel: {
        fontSize: 12,
        color: '#666666',
        marginTop: 2,
        fontFamily: 'Times New Roman',
    },
    rightSide: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
    },
    coinsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        padding: 4,
    },
    coinsText: {
        fontSize: 12,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: '#E5E5E5',
    },
    eloContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    eloChange: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    eloChangeText: {
        fontSize: 12,
        fontFamily: 'Times New Roman',
    },
}); 