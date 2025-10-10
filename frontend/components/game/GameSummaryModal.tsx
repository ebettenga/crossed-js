import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { Room } from '~/hooks/useJoinRoom';
import { useUser } from '~/hooks/users';
import { Home, Star } from 'lucide-react-native';
import { useRateDifficulty, useRateQuality } from '~/hooks/useRatings';
import { useTimeTrialLeaderboard } from '~/hooks/useLeaderboard';
import Animated, {
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    withDelay
} from 'react-native-reanimated';
import { DifficultyRating } from '~/types/crossword';

const formatMs = (ms: number | null) => {
    if (ms == null || ms < 0) return '—';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

interface GameSummaryModalProps {
    isVisible: boolean;
    onClose: () => void;
    room: Room;
}

const AnimatedStar = ({ filled, onPress, delay }: { filled: boolean; onPress: () => void; delay: number }) => {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{
            scale: withSequence(
                withTiming(1, { duration: 0 }),
                withDelay(delay, withSpring(1.2)),
                withSpring(1)
            )
        }],
    }));

    return (
        <Pressable onPress={onPress}>
            <Animated.View style={animatedStyle}>
                <Star
                    size={32}
                    color={filled ? '#FFD700' : '#666666'}
                    fill={filled ? '#FFD700' : 'transparent'}
                />
            </Animated.View>
        </Pressable>
    );
};

export const GameSummaryModal: React.FC<GameSummaryModalProps> = ({
    isVisible,
    onClose,
    room,
}) => {
    const { data: currentUser } = useUser();
    const [qualityRating, setQualityRating] = useState(0);
    const [difficultyRating, setDifficultyRating] = useState<DifficultyRating | null>(null);
    const rateDifficulty = useRateDifficulty();
    const rateQuality = useRateQuality();

    // Fetch leaderboard data using React Query
    const {
        data: leaderboard,
        isLoading: lbLoading,
        error: lbError
    } = useTimeTrialLeaderboard(
        isVisible && room?.type === 'time_trial' ? room.id : undefined,
        10
    );

    if (!room || !currentUser) return null;

    // Find the current user's stats in the room
    const userStats = room.players.find(player => player.id === currentUser.id);
    const isWinner = room.scores[currentUser.id] === Math.max(...Object.values(room.scores));

    const handleDifficultyRate = async (rating: DifficultyRating) => {
        try {
            rateDifficulty.mutate({ crosswordId: room.crossword.id, rating });
            setDifficultyRating(rating);
        } catch (error) {
            console.error('Failed to rate difficulty:', error);
        }
    };

    const handleQualityRate = async (rating: 1 | 2 | 3 | 4 | 5) => {
        try {
            rateQuality.mutate({ crosswordId: room.crossword.id, rating });
            setQualityRating(rating);
        } catch (error) {
            console.error('Failed to rate quality:', error);
        }
    };

    return (
        <Dialog style={{ borderRadius: 4 }} open={isVisible} onOpenChange={onClose}>
            <DialogContent className="bg-[#F5F5F5] w-96 h-[500px] dark:bg-[#1A2227]">
                <View className="flex-1 p-4">
                    <Text className="text-2xl font-semibold text-center text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman'] mb-6">
                        {room.type === 'time_trial' ? 'Time Trial Complete' : 'Game Summary'}
                    </Text>

                    {room.type !== 'time_trial' && (
                        <View className="bg-[#F5F5F5] dark:bg-[#1A2227] rounded-lg p-6 mb-6">
                            <Text className="text-xl text-center text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman'] mb-4">
                                {isWinner ? 'Victory!' : 'Better luck next time!'}
                            </Text>

                            <View className="space-y-4">
                                <View className="flex-row justify-between">
                                    <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                                        Score:
                                    </Text>
                                    <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                        {room.scores[currentUser.id]}
                                    </Text>
                                </View>

                                <View className="flex-row justify-between">
                                    <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                                        Rating:
                                    </Text>
                                    <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                        {userStats?.eloRating || 0}
                                    </Text>
                                </View>

                                <View className="flex-row justify-between">
                                    <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                                        Game Type:
                                    </Text>
                                    <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                        {room.type === '1v1' ? '1 vs 1' : room.type === '2v2' ? '2 vs 2' : room.type === 'free4all' ? 'Free for All' : 'Time Trial'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {room.type === 'time_trial' && (
                        <View className="bg-[#F5F5F5] dark:bg-[#1A2227] rounded-lg p-4 mb-6">
                            <Text className="text-lg text-center text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman'] mb-3">
                                Top Scores
                            </Text>
                            {lbLoading ? (
                                <Text className="text-center text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">Loading...</Text>
                            ) : lbError ? (
                                <Text className="text-center text-[#8B0000] dark:text-[#FF6B6B] font-['Times_New_Roman']">
                                    {lbError instanceof Error ? lbError.message : 'Failed to load leaderboard'}
                                </Text>
                            ) : leaderboard && leaderboard.length > 0 ? (
                                <View className="space-y-2">
                                    {leaderboard.map((entry) => {
                                        const isYou = entry.user?.id === currentUser.id;
                                        return (
                                            <View key={entry.roomId} className="flex-row justify-between">
                                                <Text className={`text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman'] ${isYou ? 'font-semibold' : ''}`}>
                                                    {entry.rank}. {entry.user?.username ?? 'Anonymous'}
                                                </Text>
                                                <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                                    {entry.score} pts • {formatMs(entry.timeTakenMs)}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text className="text-center text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">No results yet</Text>
                            )}
                        </View>
                    )}

                    <View className="space-y-6 mb-6">
                        <View className="mb-4">
                            <Text className="text-lg text-center text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman'] mb-3">
                                Rate the Difficulty
                            </Text>
                            <View className="flex-row justify-center gap-x-3">
                                <TouchableOpacity
                                    onPress={() => handleDifficultyRate('too_easy')}
                                    className={`px-4 py-2 rounded-lg ${difficultyRating === 'too_easy' ? 'bg-[#8B0000]' : 'bg-[#666666]'}`}
                                >
                                    <Text className="text-white font-['Times_New_Roman']">Too Easy</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDifficultyRate('just_right')}
                                    className={`px-4 py-2 rounded-lg ${difficultyRating === 'just_right' ? 'bg-[#8B0000]' : 'bg-[#666666]'}`}
                                >
                                    <Text className="text-white font-['Times_New_Roman']">Just Right</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDifficultyRate('too_hard')}
                                    className={`px-4 py-2 rounded-lg ${difficultyRating === 'too_hard' ? 'bg-[#8B0000]' : 'bg-[#666666]'}`}
                                >
                                    <Text className="text-white font-['Times_New_Roman']">Too Hard</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View>
                            <Text className="text-lg text-center text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman'] mb-3">
                                Rate the Quality
                            </Text>
                            <View className="flex-row justify-center space-x-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <AnimatedStar
                                        key={star}
                                        filled={star <= qualityRating}
                                        onPress={() => handleQualityRate(star as 1 | 2 | 3 | 4 | 5)}
                                        delay={star * 100}
                                    />
                                ))}
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={onClose}
                        className="flex-row items-center justify-center bg-[#8B0000] p-4 rounded-lg"
                    >
                        <Home size={20} color="#FFFFFF" className="mr-2" />
                        <Text className="text-white font-['Times_New_Roman']">
                            Return Home
                        </Text>
                    </TouchableOpacity>
                </View>
            </DialogContent>
        </Dialog>
    );
};
