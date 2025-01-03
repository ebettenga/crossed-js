import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, Gamepad2, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface GameBannerProps {
    gameId: string;
    gameType: string;
    createdAt: string;
    status?: 'pending' | 'playing' | 'finished' | 'cancelled';
}

export const GameBanner: React.FC<GameBannerProps> = ({
    gameId,
    gameType,
    createdAt,
    status = 'playing'
}) => {
    const router = useRouter();
    const isPending = status === 'pending';

    // Format game type to be more readable
    const formattedGameType = {
        '1v1': '1 vs 1',
        '2v2': '2 vs 2',
        'free4all': 'Free for All'
    }[gameType] || gameType;
 
    return (
        <View
            style={[
                styles.container,
                isPending && styles.pendingContainer
            ]}
        >
            <View style={styles.content}>
                <View style={[styles.iconContainer, isPending && styles.pendingIconContainer]}>
                    {isPending ? (
                        <Clock size={20} color="#666666" />
                    ) : (
                        <Gamepad2 size={20} color="#8B0000" />
                    )}
                </View>
                <View style={styles.textContainer}>
                    <Text style={[styles.title, isPending && styles.pendingTitle]}>
                        {isPending ? `Waiting for Players • ${formattedGameType}` : formattedGameType}
                    </Text>
                    <Text style={styles.details}>Started {(() => {
                        const localDate = new Date(createdAt);
                        const minutes = Math.floor((Date.now() - localDate.getTime()) / 60000);
                        if (minutes >= 60) {
                            const hours = Math.floor(minutes / 60);
                            return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
                        }
                        return `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
                    })()} ago</Text>
                </View>
            </View>
            {!isPending && <ChevronRight size={20} color="#666666" />}
        </View>
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
    pendingContainer: {
        backgroundColor: '#F5F5F5',
        borderColor: '#E5E5E5',
    },
    pendingIconContainer: {
        backgroundColor: '#EBEBEB',
    },
    pendingTitle: {
        color: '#666666',
    },
}); 