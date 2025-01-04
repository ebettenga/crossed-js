import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, Pressable } from 'react-native';
import { Swords, X, UserPlus } from 'lucide-react-native';
import { HomeHeader } from '~/components/home/HomeHeader';
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
        pendingChallenges,
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
        <View style={styles.container}>
            <HomeHeader 
                username={user.username}
                elo={user.eloRating}
                eloChange={-10}
                gamesPlayed={34}
                avatarUrl={"https://i.pravatar.cc/150"}
                coins={42}
            />
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#8B0000" />
                </View>
            ) : (
                <ScrollView 
                    style={styles.content}
                    contentContainerStyle={[
                        styles.contentContainer,
                        { paddingBottom: insets.bottom + 90 }
                    ]}
                >
                    {error && (
                        <Text style={styles.errorText}>
                            {error instanceof Error ? error.message : 'An error occurred'}
                        </Text>
                    )}

                    <View style={styles.searchSection}>
                        <View style={styles.searchContainer}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Enter username to add friend"
                                value={username}
                                onChangeText={setUsername}
                                onSubmitEditing={handleAddFriend}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <TouchableOpacity 
                                style={[
                                    styles.addButton,
                                    (!username.trim() || isAddingFriend) && styles.addButtonDisabled
                                ]}
                                onPress={handleAddFriend}
                                disabled={!username.trim() || isAddingFriend}
                            >
                                {isAddingFriend ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <UserPlus size={20} color="#FFFFFF" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.tabContainer}>
                        <Pressable 
                            style={[
                                styles.tab,
                                activeTab === 'friends' && styles.activeTab
                            ]}
                            onPress={() => setActiveTab('friends')}
                        >
                            <Text style={[
                                styles.tabText,
                                activeTab === 'friends' && styles.activeTabText
                            ]}>
                                Friends
                            </Text>
                        </Pressable>
                        <Pressable 
                            style={[
                                styles.tab,
                                activeTab === 'challenges' && styles.activeTab
                            ]}
                            onPress={() => setActiveTab('challenges')}
                        >
                            <Text style={[
                                styles.tabText,
                                activeTab === 'challenges' && styles.activeTabText
                            ]}>
                                Challenges
                                {pendingChallenges.length > 0 && (
                                    <Text style={styles.badge}> {pendingChallenges.length}</Text>
                                )}
                            </Text>
                        </Pressable>
                    </View>

                    {activeTab === 'friends' ? (
                        <View style={styles.section}>
                            <View style={styles.friendsList}>
                                {friends.map(friend => (
                                    <FriendRow
                                        key={friend.id}
                                        friend={friend}
                                        currentUserId={user.id}
                                        onChallenge={handleChallenge}
                                        onRemove={handleRemoveFriend}
                                    />
                                ))}
                                {friends.length === 0 && (
                                    <Text style={styles.emptyText}>
                                        No friends yet. Add some friends to play with!
                                    </Text>
                                )}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.section}>
                            <View style={styles.friendsList}>
                                {pendingChallenges.map(challenge => (
                                    <FriendRow
                                        key={challenge.challenger.id}
                                        friend={{
                                            id: challenge.challenger.id,
                                            sender: {
                                                id: challenge.challenger.id,
                                                username: challenge.challenger.username,
                                                avatarUrl: ''
                                            },
                                            receiver: {
                                                id: user.id,
                                                username: user.username,
                                                avatarUrl: ''
                                            },
                                            status: 'pending',
                                            createdAt: new Date().toISOString(),
                                            acceptedAt: null
                                        }}
                                        currentUserId={user.id}
                                        onChallenge={() => {}}
                                        onRemove={() => {}}
                                        onAccept={handleAcceptChallenge}
                                        onReject={handleRejectChallenge}
                                        isChallenge={true}
                                        roomId={challenge.room.id}
                                    />
                                ))}
                                {pendingChallenges.length === 0 && (
                                    <Text style={styles.emptyText}>
                                        No pending challenges
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}
                </ScrollView>
            )}

            {selectedFriend && otherUser && (
                <ChallengeDialog
                    isVisible={!!selectedFriend}
                    onClose={() => setSelectedFriend(null)}
                    friendId={otherUser.id}
                    friendName={otherUser.username}
                />
            )}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#EF4444',
        textAlign: 'center',
        marginBottom: 16,
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
    name: {
        fontSize: 16,
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    actions: {
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
    },
    challengeButton: {
        backgroundColor: '#FFF5F5',
        borderColor: '#FECACA',
    },
    removeButton: {
        backgroundColor: '#F8F8F5',
        borderColor: '#E5E5E5',
    },
    acceptButton: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
    },
    rejectButton: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    searchSection: {
        marginBottom: 24,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        backgroundColor: '#F8F8F5',
        borderRadius: 8,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        fontFamily: 'Times New Roman',
    },
    addButton: {
        width: 44,
        height: 44,
        backgroundColor: '#8B0000',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButtonDisabled: {
        backgroundColor: '#D1D1D1',
    },
    emptyText: {
        textAlign: 'center',
        color: '#666666',
        fontFamily: 'Times New Roman',
        fontSize: 16,
        paddingVertical: 24,
    },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        borderRadius: 8,
        backgroundColor: '#F8F8F5',
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    activeTab: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    activeTabText: {
        color: '#2B2B2B',
        fontWeight: '600',
    },
    badge: {
        color: '#8B0000',
        fontWeight: '600',
    },
    userInfo: {
        flex: 1,
    },
    challengeText: {
        fontSize: 12,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    buttonText: {
        fontSize: 12,
        marginLeft: 4,
        fontFamily: 'Times New Roman',
    },
    challengeActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
});
