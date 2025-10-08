import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, RefreshControl, FlatList } from 'react-native';
import { Swords, X, UserPlus, Check } from 'lucide-react-native';
import { PageHeader } from '~/components/Header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    Friend,
    useFriendsList,
    useRemoveFriend,
    useAddFriend,
    usePendingRequests,
    useAcceptFriendRequest,
    useRejectFriendRequest,
    useSearchUsers
} from '~/hooks/useFriends';
import { useUser } from '~/hooks/users';
import { ChallengeDialog } from '~/components/ChallengeDialog';
import { useChallenge } from '~/hooks/useChallenge';
import { ChallengeRow } from '~/components/ChallengeRow';
import { cn } from '~/lib/utils';
import { showToast } from '~/components/shared/Toast';
import { useUserStatus } from '../../../hooks/socket';

interface SearchResult {
    id: number;
    username: string;
    photo: string | null;
    status: 'online' | 'offline';
}

interface OtherUser {
    id: number;
    username: string;
    photo: string;
    status: 'online' | 'offline';
}

interface FriendRowProps {
    friend: Friend;
    currentUserId: number;
    onChallenge: (friend: Friend) => void;
    onRemove: (friendId: number) => void;
    onAccept?: (friendId: number) => void;
    onReject?: (friendId: number) => void;
    isChallenge?: boolean;
    isPending?: boolean;
    isSender?: boolean;
    roomId?: number;
    otherUser: OtherUser;
}

const FriendRow: React.FC<FriendRowProps> = ({
    friend,
    currentUserId,
    onChallenge,
    onRemove,
    onAccept,
    onReject,
    isChallenge = false,
    isPending = false,
    isSender = false,
    roomId,
    otherUser
}) => {
    const isReceiver = friend.receiver.id === currentUserId;
    return (
        <View className="flex-row items-center justify-between bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 mb-2">
            <View className="flex-1 flex-row items-center gap-3">
                <View className="relative">
                    {otherUser.photo ? (
                        <Image
                            source={{ uri: otherUser.photo }}
                            className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700"
                        />
                    ) : (
                        <View className="w-10 h-10 rounded-full bg-[#8B0000] items-center justify-center">
                            <Text className="text-white text-lg font-bold font-['Times_New_Roman']">
                                {otherUser.username.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <View
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${otherUser.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                    />
                </View>
                <View className="flex-1">
                    <Text className="text-base text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                        {otherUser.username}
                    </Text>
                    {isPending && isReceiver && (
                        <Text className="text-xs text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                            sent you a friend request
                        </Text>
                    )}
                    {isPending && !isReceiver && (
                        <Text className="text-xs text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                            pending acceptance
                        </Text>
                    )}
                    {isChallenge && (
                        <Text className="text-xs text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                            wants to play a game!
                        </Text>
                    )}
                </View>
            </View>

            {!isChallenge && !isPending && (
                <View className="flex-row items-center gap-1.5 ml-auto pl-3">
                    <TouchableOpacity
                        className="flex-row items-center p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900"
                        onPress={() => onChallenge(friend)}
                    >
                        <Swords size={16} color="#8B0000" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-row items-center p-2 rounded-md bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600"
                        onPress={() => onRemove(friend.id)}
                    >
                        <X size={16} color="#666666" />
                    </TouchableOpacity>
                </View>
            )}

            {isPending && isReceiver && (
                <View className="flex-row items-center gap-1.5 ml-auto pl-3">
                    <TouchableOpacity
                        className="flex-row items-center p-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900"
                        onPress={() => onAccept?.(friend.id)}
                    >
                        <Check size={16} color="#34D399" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-row items-center p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900"
                        onPress={() => onReject?.(friend.id)}
                    >
                        <X size={16} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            )}

            {isChallenge && isReceiver && roomId && (
                <View className="flex-row items-center gap-1.5 ml-auto pl-3">
                    <TouchableOpacity
                        className="flex-row items-center p-2 gap-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900"
                        onPress={() => onAccept?.(roomId)}
                    >
                        <Swords size={16} color="#34D399" />
                        <Text className="text-xs font-['Times_New_Roman']">Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-row items-center p-2 gap-1 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900"
                        onPress={() => onReject?.(roomId)}
                    >
                        <X size={16} color="#EF4444" />
                        <Text className="text-xs font-['Times_New_Roman']">Decline</Text>
                    </TouchableOpacity>
                </View>
            )}

            {isPending && isSender && (
                <View className="flex-row items-center gap-1.5 ml-auto pl-3">
                    <TouchableOpacity
                        className="flex-row items-center p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900"
                        onPress={() => onRemove(friend.id)}
                    >
                        <X size={16} color="#EF4444" />
                        <Text className="ml-1 text-xs text-red-500 dark:text-red-400 font-['Times_New_Roman']">
                            Cancel
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

export default function Friends() {
    const insets = useSafeAreaInsets();
    const { data: user } = useUser();
    const [username, setUsername] = useState('');
    const [activeTab, setActiveTab] = useState<'friends' | 'challenges'>('friends');
    const [challengeTarget, setChallengeTarget] = useState<{ id: number; name: string } | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const {
        data: friends,
        isLoading: friendsLoading,
        error: friendsError,
        refetch: refetchFriends
    } = useFriendsList();

    const {
        data: pendingRequests,
        isLoading: pendingLoading,
        refetch: refetchPending
    } = usePendingRequests();

    const {
        challenges,
        acceptChallenge,
        rejectChallenge,
        refetch: refetchChallenges
    } = useChallenge();

    const { searchResults: foundUsers, clearSearchResults, mutate: searchUsers } = useSearchUsers();
    const { mutate: addFriend, isPending: isAddingFriend } = useAddFriend();
    const { mutate: removeFriend } = useRemoveFriend();
    const { mutate: acceptFriend } = useAcceptFriendRequest();
    const { mutate: rejectFriend } = useRejectFriendRequest();

    const handleAddFriend = useCallback(async () => {
        if (!username.trim()) return;

        clearSearchResults();

        try {
            await addFriend(username.trim());
            setUsername(''); // Clear input on success
            showToast('success', 'Friend request sent');
        } catch (err) {
            console.error('Failed to add friend:', err);
        }
    }, [username, addFriend, clearSearchResults]);

    const handleUsernameChange = useCallback((text: string) => {
        setUsername(text);
        if (text.trim()) {
            searchUsers(text, {
                onSuccess: (data) => {
                }
            });
        } else {
        }
    }, [searchUsers]);

    const handleSelectUser = useCallback((selectedUsername: string) => {
        clearSearchResults(); // Clear the dropdown immediately
        addFriend(selectedUsername, {
            onSuccess: () => {
                setUsername(''); // Clear input on success
                showToast('success', 'Friend request sent');
            },
            onError: (err) => {
                console.error('Failed to add friend:', err);
            }
        });
    }, [addFriend, clearSearchResults]);

    const handleRemoveFriend = useCallback(async (friendId: number) => {
        try {
            await removeFriend(friendId);
        } catch (err) {
            console.error('Failed to remove friend:', err);
        }
    }, [removeFriend]);

    const handleAcceptFriend = useCallback(async (friendId: number) => {
        try {
            await acceptFriend(friendId);
        } catch (err) {
            console.error('Failed to accept friend request:', err);
        }
    }, [acceptFriend]);

    const handleRejectFriend = useCallback(async (friendId: number) => {
        try {
            await rejectFriend(friendId);
        } catch (err) {
            console.error('Failed to reject friend request:', err);
        }
    }, [rejectFriend]);

    const handleAcceptChallenge = async (roomId: number) => {
        try {
            acceptChallenge.mutate(roomId);
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

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                refetchFriends(),
                refetchPending(),
                refetchChallenges()
            ]);
        } catch (error) {
            console.error('Error refreshing:', error);
        }
        setRefreshing(false);
    }, [refetchFriends, refetchPending, refetchChallenges]);

    useUserStatus(); // Add this hook to listen for status changes

    if (!user) return null;

    const getFriendStatus = useCallback((friend: Friend): OtherUser => {
        const otherUser = friend.sender.id === user.id ? friend.receiver : friend.sender;
        return {
            ...otherUser,
            status: otherUser.status || 'offline'
        };
    }, [user.id]);

    const handleChallenge = useCallback((friend: Friend) => {
        const target = getFriendStatus(friend);
        setChallengeTarget({ id: target.id, name: target.username });
    }, [getFriendStatus]);

    const isLoading = friendsLoading || pendingLoading;
    const error = friendsError;

    return (
        <View className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417]" style={{ paddingTop: insets.top }}>
            <PageHeader />

            <View className="flex-row px-4 mb-4">
                <TouchableOpacity
                    className={cn(
                        "flex-1 py-4 items-center border-b-2",
                        activeTab === 'friends'
                            ? "border-[#8B0000]"
                            : "border-transparent"
                    )}
                    onPress={() => setActiveTab('friends')}
                >
                    <Text className={cn(
                        "text-base font-['Times_New_Roman']",
                        activeTab === 'friends'
                            ? "text-[#8B0000]"
                            : "text-[#666666] dark:text-neutral-400"
                    )}>
                        Friends
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className={cn(
                        "flex-1 py-4 items-center border-b-2",
                        activeTab === 'challenges'
                            ? "border-[#8B0000]"
                            : "border-transparent"
                    )}
                    onPress={() => setActiveTab('challenges')}
                >
                    <Text className={cn(
                        "text-base font-['Times_New_Roman']",
                        activeTab === 'challenges'
                            ? "text-[#8B0000]"
                            : "text-[#666666] dark:text-neutral-400"
                    )}>
                        Challenges
                    </Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'friends' ? (
                <View className="flex-1 px-4">
                    <View className="relative flex-row gap-2 mb-4">
                        <TextInput
                            className="flex-1 h-[46px] border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 bg-neutral-50 dark:bg-neutral-800 text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']"
                            placeholder="Enter username"
                            placeholderTextColor="#666666"
                            value={username}
                            onChangeText={handleUsernameChange}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity
                            className="flex-row items-center bg-[#8B0000] px-4 rounded-lg gap-1"
                            onPress={handleAddFriend}
                            disabled={isAddingFriend}
                        >
                            {isAddingFriend ? (
                                <ActivityIndicator size="large" color="#FFFFFF" />
                            ) : (
                                <>
                                    <UserPlus size={16} color="#FFFFFF" />
                                    <Text className="text-white text-sm font-['Times_New_Roman']">Add</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        {foundUsers && foundUsers.length > 0 && (
                            <View className="absolute top-[46px] left-0 right-[76px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg mt-1 z-10 shadow-lg">
                                <FlatList
                                    data={foundUsers}
                                    keyExtractor={(item) => item.id.toString()}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            className="flex-row items-center p-3 border-b border-neutral-200 dark:border-neutral-700"
                                            onPress={() => handleSelectUser(item.username)}
                                        >
                                            <View className="relative">
                                                {item.photo ? (
                                                    <Image
                                                        source={{ uri: item.photo }}
                                                        className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-700"
                                                    />
                                                ) : (
                                                    <View className="w-8 h-8 rounded-full bg-[#8B0000] items-center justify-center">
                                                        <Text className="text-white text-sm font-bold font-['Times_New_Roman']">
                                                            {item.username.charAt(0).toUpperCase()}
                                                        </Text>
                                                    </View>
                                                )}
                                                <View
                                                    className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white ${item.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                                                        }`}
                                                />
                                            </View>
                                            <Text className="ml-3 text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                                {item.username}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                    style={{ maxHeight: 200 }}
                                />
                            </View>
                        )}
                    </View>

                    {isLoading ? (
                        <ActivityIndicator className="mt-5" size="large" color="#8B0000" />
                    ) : error ? (
                        <Text className="text-red-500 dark:text-red-400 text-center mt-5 font-['Times_New_Roman']">
                            Failed to load friends
                        </Text>
                    ) : (
                        <ScrollView
                            className="flex-1"
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    tintColor="#8B0000"
                                    colors={["#8B0000"]}
                                />
                            }
                        >
                            {pendingRequests?.map((friend) => {
                                const isSender = friend.sender.id === user.id;
                                return (
                                    <FriendRow
                                        key={friend.id}
                                        friend={friend}
                                        currentUserId={user.id}
                                        onChallenge={handleChallenge}
                                        onRemove={handleRemoveFriend}
                                        onAccept={handleAcceptFriend}
                                        onReject={handleRejectFriend}
                                        isPending={true}
                                        isSender={isSender}
                                        otherUser={getFriendStatus(friend)}
                                    />
                                );
                            })}
                            {friends?.map((friend) => (
                                <FriendRow
                                    key={friend.id}
                                    friend={friend}
                                    currentUserId={user.id}
                                    onChallenge={handleChallenge}
                                    onRemove={handleRemoveFriend}
                                    otherUser={getFriendStatus(friend)}
                                />
                            ))}
                        </ScrollView>
                    )}
                </View>
            ) : (
                <View className="flex-1 px-4">
                    <ScrollView
                        className="flex-1"
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor="#8B0000"
                                colors={["#8B0000"]}
                            />
                        }
                    >
                        {challenges.map((room) => {
                            const isChallenger = room.players[0].id === user.id;
                            const otherUser = room.players.find(p => p.id !== user.id);
                            return (
                                <ChallengeRow
                                    key={room.id}
                                    room={room}
                                    challenger={isChallenger}
                                    username={otherUser?.username || ''}
                                    onAccept={!isChallenger ? handleAcceptChallenge : undefined}
                                    onReject={handleRejectChallenge}
                                    isAccepting={acceptChallenge.isPending}
                                    isRejecting={rejectChallenge.isPending}
                                />
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            <ChallengeDialog
                isVisible={!!challengeTarget}
                onClose={() => setChallengeTarget(null)}
                friendId={challengeTarget?.id || 0}
                friendName={challengeTarget?.name || ''}
            />
        </View>
    );
}
