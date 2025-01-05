import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Swords, X } from 'lucide-react-native';
import { Player, Room } from '~/hooks/useRoom';
import { User } from '~/types/user';

type ChallengeRowProps = {
    room: Room;
    user: User;
    challenger?: Player;
    onAccept: (roomId: number) => void;
    onReject: (roomId: number) => void;
    isAccepting?: boolean;
    isRejecting?: boolean;
};

export const ChallengeRow = ({ 
    room,
    user,
    challenger,
    onAccept,
    onReject,
    isAccepting = false,
    isRejecting = false
}: ChallengeRowProps) => {
    if (!challenger) return null;

    return (
        <View style={styles.friendRow}>
            <View style={styles.leftSection}>
                <View style={styles.avatarContainer}>
                    <Image 
                        source={{ uri: 'https://i.pravatar.cc/150' }} 
                        style={styles.avatar}
                    />
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.name}>{challenger.username}</Text>
                    <Text style={styles.challengeText}>
                        wants to play a {room.difficulty} game!
                    </Text>
                </View>
            </View>
            
            <View style={styles.challengeActions}>
                <TouchableOpacity 
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => onAccept(room.id)}
                    disabled={isAccepting || isRejecting}
                >
                    {isAccepting ? (
                        <ActivityIndicator size="small" color="#34D399" />
                    ) : (
                        <>
                            <Swords size={16} color="#34D399" />
                            <Text style={[styles.buttonText, styles.acceptText]}>Accept</Text>
                        </>
                    )}
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => onReject(room.id)}
                    disabled={isAccepting || isRejecting}
                >
                    {isRejecting ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                        <>
                            <X size={16} color="#EF4444" />
                            <Text style={[styles.buttonText, styles.rejectText]}>Decline</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F8F5',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    leftSection: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5EB',
    },
    userInfo: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    challengeText: {
        fontSize: 12,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    challengeActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginLeft: 'auto',
        paddingLeft: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 6,
        borderWidth: 1,
        gap: 4,
    },
    acceptButton: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
    },
    rejectButton: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    buttonText: {
        fontSize: 12,
        fontFamily: 'Times New Roman',
    },
    acceptText: {
        color: '#34D399',
    },
    rejectText: {
        color: '#EF4444',
    },
}); 