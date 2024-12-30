import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Swords, X, Circle } from 'lucide-react-native';
import { HomeHeader } from '~/components/home/HomeHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface Friend {
    id: string;
    name: string;
    avatarUrl: string;
    isOnline: boolean;
}

interface FriendRowProps {
    friend: Friend;
    onChallenge: (friendId: string) => void;
    onRemove: (friendId: string) => void;
}

const FriendRow: React.FC<FriendRowProps> = ({ friend, onChallenge, onRemove }) => (
    <View style={styles.friendRow}>
        <View style={styles.leftSection}>
            <View style={styles.avatarContainer}>
                <Image 
                    source={{ uri: friend.avatarUrl }} 
                    style={styles.avatar}
                />
                {friend.isOnline && (
                    <View style={styles.onlineIndicator}>
                        <Circle size={8} fill="#34D399" color="#34D399" />
                    </View>
                )}
            </View>
            <Text style={styles.name}>{friend.name}</Text>
        </View>
        
        <View style={styles.actions}>
            {friend.isOnline && (
                <TouchableOpacity 
                    style={styles.challengeButton}
                    onPress={() => onChallenge(friend.id)}
                >
                    <Swords size={16} color="#8B0000" />
                </TouchableOpacity>
            )}
            
            <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => onRemove(friend.id)}
            >
                <X size={16} color="#666666" />
            </TouchableOpacity>
        </View>
    </View>
);

export default function Friends() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    // Mock friends data
    const friends: Friend[] = [
        {
            id: '1',
            name: 'Jane Smith',
            avatarUrl: 'https://i.pravatar.cc/150?img=1',
            isOnline: true,
        },
        {
            id: '2',
            name: 'John Doe',
            avatarUrl: 'https://i.pravatar.cc/150?img=2',
            isOnline: false,
        },
        {
            id: '3',
            name: 'Alice Johnson',
            avatarUrl: 'https://i.pravatar.cc/150?img=3',
            isOnline: true,
        },
        // Add more friends as needed
    ];

    const handleChallenge = (friendId: string) => {
        console.log(`Challenging friend ${friendId}`);
    };

    const handleRemoveFriend = (friendId: string) => {
        console.log(`Removing friend ${friendId}`);
        // Implement remove friend logic
    };

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
                    <View style={styles.friendsList}>
                        {friends.map(friend => (
                            <FriendRow
                                key={friend.id}
                                friend={friend}
                                onChallenge={handleChallenge}
                                onRemove={handleRemoveFriend}
                            />
                        ))}
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
    },
    contentContainer: {
        padding: 16,
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
    friendsList: {
        gap: 12,
    },
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
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 2,
    },
    name: {
        fontSize: 16,
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    challengeButton: {
        padding: 6,
        backgroundColor: '#FFF5F5',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    removeButton: {
        padding: 6,
        backgroundColor: '#F8F8F5',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
});
