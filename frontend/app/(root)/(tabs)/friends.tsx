import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput } from 'react-native';
import { Swords, X, Circle, UserPlus, Check, Search } from 'lucide-react-native';
import { HomeHeader } from '~/components/home/HomeHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
    Friend,
    useFriendsList,
    usePendingRequests,
    useAcceptFriendRequest,
    useRejectFriendRequest,
    useRemoveFriend,
    useAddFriend
} from '~/hooks/useFriends';
import { useUser } from '~/hooks/users';

interface FriendRowProps {
    friend: Friend;
    currentUserId: number;
    onChallenge: (friendId: number) => void;
    onRemove: (friendId: number) => void;
    onAccept?: (friendId: number) => void;
    onReject?: (friendId: number) => void;
    isPending?: boolean;
}

const FriendRow: React.FC<FriendRowProps> = ({ 
    friend, 
    currentUserId,
    onChallenge, 
    onRemove,
    onAccept,
    onReject,
    isPending = false
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
                <Text style={styles.name}>{otherUser.username}</Text>
            </View>
            
            <View style={styles.actions}>
                {isPending && isReceiver ? (
                    <>
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.acceptButton]}
                            onPress={() => onAccept?.(friend.id)}
                        >
                            <Check size={16} color="#34D399" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.rejectButton]}
                            onPress={() => onReject?.(friend.id)}
                        >
                            <X size={16} color="#EF4444" />
                        </TouchableOpacity>
                    </>
                ) : !isPending && (
                    <>
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.challengeButton]}
                            onPress={() => onChallenge(friend.id)}
                        >
                            <Swords size={16} color="#8B0000" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.removeButton]}
                            onPress={() => onRemove(friend.id)}
                        >
                            <X size={16} color="#666666" />
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
    );
};

export default function Friends() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { data: user } = useUser();
    const [username, setUsername] = useState('');

    const { 
        data: friends = [], 
        isLoading: friendsLoading,
        error: friendsError
    } = useFriendsList();

    const {
        data: pendingRequests = [],
        isLoading: requestsLoading,
        error: requestsError
    } = usePendingRequests();

    const { mutate: acceptRequest } = useAcceptFriendRequest();
    const { mutate: rejectRequest } = useRejectFriendRequest();
    const { mutate: removeFriend } = useRemoveFriend();
    const { mutate: addFriend, isPending: isAddingFriend } = useAddFriend();

    const handleChallenge = (friendId: number) => {
        console.log(`Challenging friend ${friendId}`);
        // Implement challenge logic
    };

    const handleRemoveFriend = async (friendId: number) => {
        try {
            await removeFriend(friendId);
        } catch (err) {
            console.error('Failed to remove friend:', err);
        }
    };

    const handleAcceptRequest = async (friendId: number) => {
        try {
            await acceptRequest(friendId);
        } catch (err) {
            console.error('Failed to accept request:', err);
        }
    };

    const handleRejectRequest = async (friendId: number) => {
        try {
            await rejectRequest(friendId);
        } catch (err) {
            console.error('Failed to reject request:', err);
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

    const isLoading = friendsLoading || requestsLoading;
    const error = friendsError || requestsError;

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
                    
                    {pendingRequests.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Pending Requests</Text>
                            <View style={styles.friendsList}>
                                {pendingRequests.map(request => (
                                    <FriendRow
                                        key={request.id}
                                        friend={request}
                                        currentUserId={user.id}
                                        onChallenge={handleChallenge}
                                        onRemove={handleRemoveFriend}
                                        onAccept={handleAcceptRequest}
                                        onReject={handleRejectRequest}
                                        isPending={true}
                                    />
                                ))}
                            </View>
                        </View>
                    )}

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Friends</Text>
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
                </ScrollView>
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
    },
    actionButton: {
        padding: 6,
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
});
