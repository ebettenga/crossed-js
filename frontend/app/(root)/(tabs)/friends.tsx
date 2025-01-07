import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput } from 'react-native';
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
    useRejectFriendRequest
} from '~/hooks/useFriends';
import { useUser } from '~/hooks/users';
import { ChallengeDialog } from '~/components/ChallengeDialog';
import { useChallenge } from '~/hooks/useChallenge';
import { ChallengeRow } from '~/components/ChallengeRow';
import { cn } from '~/lib/utils';

interface FriendRowProps {
    friend: Friend;
    currentUserId: number;
    onChallenge: (friend: Friend) => void;
    onRemove: (friendId: number) => void;
    onAccept?: (friendId: number) => void;
    onReject?: (friendId: number) => void;
    isChallenge?: boolean;
    isPending?: boolean;
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
    isPending = false,
    roomId
}) => {
    const otherUser = friend.sender.id === currentUserId ? friend.receiver : friend.sender;
    const isReceiver = friend.receiver.id === currentUserId;

    return (
        <View className="flex-row items-center justify-between bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 mb-2">
            <View className="flex-1 flex-row items-center gap-3">
                <View className="relative">
                    <Image
                        source={{ uri: otherUser.avatarUrl || 'https://i.pravatar.cc/150' }}
                        className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700"
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
        </View>
    );
};

export default function Friends() {
    const insets = useSafeAreaInsets();
    const { data: user } = useUser();
    const [username, setUsername] = useState('');
    const [activeTab, setActiveTab] = useState<'friends' | 'challenges'>('friends');
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

    const {
        data: friends,
        isLoading: friendsLoading,
        error: friendsError
    } = useFriendsList();

    const {
        data: pendingRequests,
        isLoading: pendingLoading
    } = usePendingRequests();

    const {
        challenges,
        acceptChallenge,
        rejectChallenge
    } = useChallenge();

    const { mutate: removeFriend } = useRemoveFriend();
    const { mutate: addFriend, isPending: isAddingFriend } = useAddFriend();
    const { mutate: acceptFriend } = useAcceptFriendRequest();
    const { mutate: rejectFriend } = useRejectFriendRequest();

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

    const handleAcceptFriend = async (friendId: number) => {
        try {
            await acceptFriend(friendId);
        } catch (err) {
            console.error('Failed to accept friend request:', err);
        }
    };

    const handleRejectFriend = async (friendId: number) => {
        try {
            await rejectFriend(friendId);
        } catch (err) {
            console.error('Failed to reject friend request:', err);
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

    const isLoading = friendsLoading || pendingLoading;
    const error = friendsError;

    const otherUser = selectedFriend ?
        (selectedFriend.sender.id === user.id ? selectedFriend.receiver : selectedFriend.sender) :
        null;

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
                    <View className="flex-row gap-2 mb-4">
                        <TextInput
                            className="flex-1 h-[46px] border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 bg-neutral-50 dark:bg-neutral-800 text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']"
                            placeholder="Enter username"
                            placeholderTextColor="#666666"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity
                            className="flex-row items-center bg-[#8B0000] px-4 rounded-lg gap-1"
                            onPress={handleAddFriend}
                            disabled={isAddingFriend}
                        >
                            {isAddingFriend ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <UserPlus size={16} color="#FFFFFF" />
                                    <Text className="text-white text-sm font-['Times_New_Roman']">Add</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator className="mt-5" size="large" color="#8B0000" />
                    ) : error ? (
                        <Text className="text-red-500 dark:text-red-400 text-center mt-5 font-['Times_New_Roman']">
                            Failed to load friends
                        </Text>
                    ) : (
                        <ScrollView className="flex-1">
                            {pendingRequests?.map((friend) => (
                                <FriendRow
                                    key={friend.id}
                                    friend={friend}
                                    currentUserId={user.id}
                                    onChallenge={handleChallenge}
                                    onRemove={handleRemoveFriend}
                                    onAccept={handleAcceptFriend}
                                    onReject={handleRejectFriend}
                                    isPending={true}
                                />
                            ))}
                            {friends?.map((friend) => (
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
                <View className="flex-1 px-4">
                    <ScrollView className="flex-1">
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
