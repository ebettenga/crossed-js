import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, Pressable } from 'react-native';
import { Swords, X, UserPlus } from 'lucide-react-native';
import { PageHeader } from '~/components/Header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
    Friend,
    useFriendsList,
    useRemoveFriend,
    useAddFriend
} from '~/hooks/useFriends';
import { useUser } from '~/hooks/users';
import { ChallengeDialog } from '~/components/ChallengeDialog';
import { useChallenge } from '~/hooks/useChallenge';
import { ChallengeRow } from '~/components/ChallengeRow';

interface FriendRowProps {
    friend: Friend;
    currentUserId: number;
    onChallenge: (friend: Friend) => void;
    onRemove: (friendId: number) => void;
    onAccept?: (roomId: number) => void;
    onReject?: (roomId: number) => void;
    isChallenge?: boolean;
    roomId?: number;
}

const FriendRow: React.FC<FriendRowProps> = ({ 
    friend, 
    currentUserId,
    onChallenge, 
    onRemove,
    onAccept,
    onReject,
    isChallenge = false,
    roomId
}) => {
    const otherUser = friend.sender.id === currentUserId ? friend.receiver : friend.sender;
    const isReceiver = friend.receiver.id === currentUserId;

    return (
        <View style={styles.friendRow}>
            <View style={styles.leftSection}>
                <View style={styles.avatarContainer}>
                    <Image 
                        source={{ uri: otherUser.avatarUrl || 'https://i.pravatar.cc/150' }} 
                        style={styles.avatar}
                    />
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.name}>{otherUser.username}</Text>
                    {isChallenge && (
                        <Text style={styles.challengeText}>
                            wants to play a game!
                        </Text>
                    )}
                </View>
                {!isChallenge && (
                    <View style={styles.actions}>
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.challengeButton]}
                            onPress={() => onChallenge(friend)}
                        >
                            <Swords size={16} color="#8B0000" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.removeButton]}
                            onPress={() => onRemove(friend.id)}
                        >
                            <X size={16} color="#666666" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
            
            {isChallenge && isReceiver && roomId && (
                <View style={styles.challengeActions}>
                    <TouchableOpacity 
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={() => onAccept?.(roomId)}
                    >
                        <Swords size={16} color="#34D399" />
                        <Text style={styles.buttonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => onReject?.(roomId)}
                    >
                        <X size={16} color="#EF4444" />
                        <Text style={styles.buttonText}>Decline</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

export default function Friends() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { data: user } = useUser();
    const [username, setUsername] = useState('');
    const [activeTab, setActiveTab] = useState<'friends' | 'challenges'>('friends');
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

    const { 
        data: friends = [], 
        isLoading: friendsLoading,
        error: friendsError
    } = useFriendsList();

    const {
        challenges,
        acceptChallenge,
        rejectChallenge
    } = useChallenge();

    const { mutate: removeFriend } = useRemoveFriend();
    const { mutate: addFriend, isPending: isAddingFriend } = useAddFriend();

    const handleChallenge = (friend: Friend) => {
        setSelectedFriend(friend);
    };

    const handleRemoveFriend = async (friendId: number) => {
        try {
            await removeFriend(friendId);
        } catch (err) {
            console.error('Failed to remove friend:', err);
        }
    };

    const handleAcceptChallenge = async (roomId: number) => {
        try {
            await acceptChallenge.mutateAsync(roomId);
        } catch (err) {
            console.error('Failed to accept challenge:', err);
        }
    };

    const handleRejectChallenge = async (roomId: number) => {
        try {
            await rejectChallenge.mutateAsync(roomId);
        } catch (err) {
            console.error('Failed to reject challenge:', err);
        }
    };

    const handleAddFriend = async () => {
        if (!username.trim()) return;
        
        try {
            await addFriend(username.trim());
            setUsername(''); // Clear input on success
        } catch (err) {
            console.error('Failed to add friend:', err);
        }
    };

    if (!user) return null;

    const isLoading = friendsLoading;
    const error = friendsError;

    const otherUser = selectedFriend ? 
        (selectedFriend.sender.id === user.id ? selectedFriend.receiver : selectedFriend.sender) : 
        null;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <PageHeader />
            
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
                    onPress={() => setActiveTab('friends')}
                >
                    <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>Friends</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'challenges' && styles.activeTab]}
                    onPress={() => setActiveTab('challenges')}
                >
                    <Text style={[styles.tabText, activeTab === 'challenges' && styles.activeTabText]}>Challenges</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'friends' ? (
                <View style={styles.content}>
                    <View style={styles.addFriendContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter username"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity 
                            style={styles.addButton}
                            onPress={handleAddFriend}
                            disabled={isAddingFriend}
                        >
                            {isAddingFriend ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <UserPlus size={16} color="#FFFFFF" />
                                    <Text style={styles.addButtonText}>Add</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator style={styles.loader} />
                    ) : error ? (
                        <Text style={styles.errorText}>Failed to load friends</Text>
                    ) : (
                        <ScrollView style={styles.list}>
                            {friends.map((friend) => (
                                <FriendRow
                                    key={friend.id}
                                    friend={friend}
                                    currentUserId={user.id}
                                    onChallenge={handleChallenge}
                                    onRemove={handleRemoveFriend}
                                />
                            ))}
                        </ScrollView>
                    )}
                </View>
            ) : (
                <View style={styles.content}>
                    <ScrollView style={styles.list}>
                        {challenges.map((room) => (
                            <ChallengeRow
                                key={room.id}
                                room={room}
                                user={user}
                                challenger={room.players.find(p => p.id !== user.id)}
                                onAccept={handleAcceptChallenge}
                                onReject={handleRejectChallenge}
                                isAccepting={acceptChallenge.isPending}
                                isRejecting={rejectChallenge.isPending}
                            />
                        ))}
                    </ScrollView>
                </View>
            )}

            <ChallengeDialog
                isVisible={!!selectedFriend}
                onClose={() => setSelectedFriend(null)}
                friendId={otherUser?.id || 0}
                friendName={otherUser?.username || ''}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#8B0000',
    },
    tabText: {
        fontSize: 16,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    activeTabText: {
        color: '#8B0000',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    addFriendContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    input: {
        flex: 1,
        height: 46,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 8,
        paddingHorizontal: 12,
        backgroundColor: '#F8F8F5',
        fontFamily: 'Times New Roman',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#8B0000',
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 4,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Times New Roman',
    },
    list: {
        flex: 1,
    },
    loader: {
        marginTop: 20,
    },
    errorText: {
        color: '#EF4444',
        textAlign: 'center',
        marginTop: 20,
        fontFamily: 'Times New Roman',
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
        marginBottom: 8,
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
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginLeft: 'auto',
        paddingLeft: 12,
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
    challengeButton: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    removeButton: {
        backgroundColor: '#F3F4F6',
        borderColor: '#E5E7EB',
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
});

