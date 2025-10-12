import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { Room } from '~/hooks/useJoinRoom';
import { useUser } from '~/hooks/users';
import { Home, Star, ChevronLeft, ChevronRight } from 'lucide-react-native';
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
import { RectButton } from '../home/HomeSquareButton';
import { cn } from '~/lib/utils';
import { ScrollView } from 'react-native-gesture-handler';

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

interface CompetitiveResultsProps {
    room: Room;
    currentUserId: number;
    userStats: any;
}

const CompetitiveResults: React.FC<CompetitiveResultsProps> = ({ room, currentUserId, userStats }) => {
    const isWinner = room.scores[currentUserId as any] === Math.max(...Object.values(room.scores));

    return (
        <View className="rounded-sm border-[1.5px] border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 w-full pt-6">
            <Text className="text-xl text-center text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman'] mb-4">
                {isWinner ? 'Victory!' : 'Better luck next time!'}
            </Text>

            <View className="space-y-4 px-4 mb-6">
                <View className="flex-row justify-between">
                    <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                        Score:
                    </Text>
                    <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                        {room.scores[currentUserId as any]}
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

            {/* Navigation buttons */}
            <View className="flex-row w-full mt-4">
                <View
                    className={cn(
                        "border-t-[2px] border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 flex-1 h-16 rounded-sm",
                    )}
                >
                    <Pressable
                        onPress={() => {/* TODO: Navigate to previous player */ }}
                        style={({ pressed }) => ({
                            backgroundColor: pressed
                                ? '#F0F0ED'
                                : '#FAFAF7'
                        })}
                        className={cn(
                            "flex-1 justify-center items-center relative dark:bg-neutral-800",
                            "active:bg-[#F0F0ED] active:dark:bg-neutral-700",
                        )}
                    >
                        <View className="w-full h-full flex flex-col items-center justify-center">
                            <ChevronLeft color='#FFFFFF' size={32} />
                        </View>
                    </Pressable>
                </View>

                <View
                    className={cn(
                        "border-t-2 border-l-2 border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 flex-1 h-16 rounded-sm",
                    )}
                >
                    <Pressable
                        onPress={() => {/* TODO: Navigate to next player */ }}
                        style={({ pressed }) => ({
                            backgroundColor: pressed
                                ? '#F0F0ED'
                                : '#FAFAF7'
                        })}
                        className={cn(
                            "flex-1 justify-center items-center relative dark:bg-neutral-800",
                            "active:bg-[#F0F0ED] active:dark:bg-neutral-700",
                        )}
                    >
                        <View className="w-full h-full flex flex-col items-center justify-center">
                            <ChevronRight color='#FFFFFF' size={32} />
                        </View>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};

interface TimeTrialResultsProps {
    leaderboard: any[] | undefined;
    isLoading: boolean;
    error: Error | null;
    currentUserId: number;
}

const TimeTrialResults: React.FC<TimeTrialResultsProps> = ({ leaderboard, isLoading, error, currentUserId }) => {
    return (
        <View className="bg-[#F5F5F5] dark:bg-[#1A2227] rounded-lg p-4 mb-6">
            <Text className="text-lg text-center text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman'] mb-3">
                Top Scores
            </Text>
            {isLoading ? (
                <Text className="text-center text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">Loading...</Text>
            ) : error ? (
                <Text className="text-center text-[#8B0000] dark:text-[#FF6B6B] font-['Times_New_Roman']">
                    {error instanceof Error ? error.message : 'Failed to load leaderboard'}
                </Text>
            ) : leaderboard && leaderboard.length > 0 ? (
                <View className="space-y-2">
                    {leaderboard.map((entry) => {
                        const isYou = entry.user?.id === currentUserId;
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

    const renderResults = () => {
        if (room.type === 'time_trial') {
            return (
                <TimeTrialResults
                    leaderboard={leaderboard}
                    isLoading={lbLoading}
                    error={lbError}
                    currentUserId={currentUser.id}
                />
            );
        }

        // For 1v1 and free4all modes
        return (
            <CompetitiveResults
                room={room}
                currentUserId={currentUser.id}
                userStats={userStats}
            />
        );
    };

    return (
        <Dialog open={isVisible} onOpenChange={onClose}>
            <DialogContent className="bg-[#F5F5F5] flex w-96 h-[500px] dark:bg-[#1A2227]">
                <View className="flex-1 flex justify-between p-4">
                    <ScrollView contentContainerClassName='flex flex-col flex-1 justify-between'>
                        {renderResults()}



                        <View className={cn(
                            "rounded-sm border-[1.5px] border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 w-full mb-4",
                        )}>
                            <View className="flex-row justify-center gap-x-3 my-4">
                                <TouchableOpacity
                                    onPress={() => handleDifficultyRate('too_easy')}
                                    className={`border-[1.5px] rounded-sm dark:bg-neutral-800 px-4 py-2 ${difficultyRating === 'too_easy' ? 'border-[#8B0000]' : 'border-[#FAFAF7]'}`}
                                >
                                    <Text className={`text-white font-['Times_New_Roman'] ${difficultyRating === 'too_easy' ? 'color-[#8B0000]' : 'color-[#FAFAF7]'}`}>Easy</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDifficultyRate('just_right')}
                                    className={`border-[1.5px] rounded-sm dark:bg-neutral-800 px-4 py-2  ${difficultyRating === 'just_right' ? 'border-[#8B0000]' : 'border-[#FAFAF7]'}`}
                                >
                                    <Text className={`text-white font-['Times_New_Roman'] ${difficultyRating === 'just_right' ? 'color-[#8B0000]' : 'color-[#FAFAF7]'}`}>Perfect</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDifficultyRate('too_hard')}
                                    className={`border-[1.5px] rounded-sm dark:bg-neutral-800 px-4 py-2  ${difficultyRating === 'too_hard' ? 'border-[#8B0000]' : 'border-[#FAFAF7]'}`}
                                >
                                    <Text className={`text-white font-['Times_New_Roman'] ${difficultyRating === 'too_hard' ? 'color-[#8B0000]' : 'color-[#FAFAF7]'}`}>Hard</Text>
                                </TouchableOpacity>
                            </View>

                            <View className='my-4'>
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

                    </ScrollView>



                    {/* Home button */}
                    <View
                        className={cn(
                            "border-[1.5px] border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 w-full h-16 rounded-sm",
                        )}
                    >
                        <Pressable
                            onPress={onClose}
                            style={({ pressed }) => ({
                                backgroundColor: pressed
                                    ? '#F0F0ED'
                                    : '#FAFAF7'
                            })}
                            className={cn(
                                "flex-1 justify-center items-center relative dark:bg-neutral-800",
                                "active:bg-[#F0F0ED] active:dark:bg-neutral-700",
                            )}
                        >

                            <Text className="absolute top-1 left-1 text-xs font-['Times_New_Roman'] text-[#666666] dark:text-neutral-400 font-medium">
                                1
                            </Text>
                            <View className="w-full h-full flex flex-col items-center justify-center">
                                <View className="mb-1">
                                    <Home color='#FFFFFF' />
                                </View>
                            </View>
                        </Pressable>
                    </View>
                </View>
            </DialogContent>
        </Dialog>
    );
};
