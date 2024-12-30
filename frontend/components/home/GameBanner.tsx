import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, Gamepad2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface GameBannerProps {
    gameId: string;
    opponent?: string;
    timeLeft?: string;
}

export const GameBanner: React.FC<GameBannerProps> = ({
    gameId,
    opponent = "Opponent",
    timeLeft
}) => {
    const router = useRouter();

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => router.push(`/game`)}
        >
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Gamepad2 size={20} color="#8B0000" />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>Active Game</Text>
                    <Text style={styles.details}>vs {opponent}</Text>
                </View>
            </View>
            <ChevronRight size={20} color="#666666" />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFF5F5',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 8,
        padding: 12,
        marginHorizontal: 16,
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        gap: 2,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#8B0000',
        fontFamily: 'Times New Roman',
    },
    details: {
        fontSize: 14,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
}); 