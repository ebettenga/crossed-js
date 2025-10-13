import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { Room, SquareType } from '~/hooks/useJoinRoom';
import { useUser } from '~/hooks/users';
import { Home, Star, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react-native';
import { useRateDifficulty, useRateQuality } from '~/hooks/useRatings';
import { useTimeTrialLeaderboard } from '~/hooks/useLeaderboard';
import { useGameStats, GameStats } from '~/hooks/useGameStats';
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
import { useLogger } from '~/hooks/useLogs';

const formatMs = (ms: number | null) => {
    if (ms == null || ms < 0) return '—';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Helper function to calculate grid completion percentage per player
const calculatePlayerGridCompletion = (room: Room, playerStats: GameStats | undefined): number => {
    if (!playerStats?.correctGuessDetails) return 0;

    const totalNonBlackSquares = room.board.flat().filter(
        square => square.squareType !== SquareType.BLACK
    ).length;

    // Count unique squares solved by this player using their correctGuessDetails
    const playerSolvedSquares = playerStats.correctGuessDetails.length;

    return totalNonBlackSquares > 0 ? (playerSolvedSquares / totalNonBlackSquares) * 100 : 0;
};

// Helper function to calculate accuracy
const calculateAccuracy = (correct: number, incorrect: number): number => {
    const total = correct + incorrect;
    return total > 0 ? (correct / total) * 100 : 0;
};

// Helper function to calculate contribution percentage
const calculateContribution = (userCorrect: number, allStats: GameStats[] | undefined): number => {
    if (!allStats || allStats.length === 0) return 0;
    const totalCorrect = allStats.reduce((sum, stat) => sum + stat.correctGuesses, 0);
    return totalCorrect > 0 ? (userCorrect / totalCorrect) * 100 : 0;
};

// Helper function to get match outcome for competitive games
const getMatchOutcome = (room: Room, userId: number): { isWinner: boolean; margin: number; teamScore?: number; opponentScore?: number } => {
    const userScore = room.scores[userId] || 0;
    const allScores = Object.values(room.scores);
    const maxScore = Math.max(...allScores);
    const isWinner = userScore === maxScore;

    if (room.type === '2v2') {
        // For 2v2, calculate team scores
        const players = room.players;
        const userIndex = players.findIndex(p => p.id === userId);
        const teamIndices = userIndex < 2 ? [0, 1] : [2, 3];
        const opponentIndices = userIndex < 2 ? [2, 3] : [0, 1];

        const teamScore = teamIndices.reduce((sum, idx) =>
            sum + (room.scores[players[idx]?.id] || 0), 0
        );
        const opponentScore = opponentIndices.reduce((sum, idx) =>
            sum + (room.scores[players[idx]?.id] || 0), 0
        );

        return {
            isWinner: teamScore > opponentScore,
            margin: Math.abs(teamScore - opponentScore),
            teamScore,
            opponentScore
        };
    }

    // For 1v1 and free4all
    const sortedScores = [...allScores].sort((a, b) => b - a);
    const margin = isWinner ? userScore - (sortedScores[1] || 0) : maxScore - userScore;

    return { isWinner, margin };
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
    selectedPlayerId: number;
    onNavigatePlayer: (direction: 'prev' | 'next') => void;
    gameStats: GameStats[] | undefined;
}

const CompetitiveResults: React.FC<CompetitiveResultsProps> = ({ room, selectedPlayerId, onNavigatePlayer, gameStats }) => {

    console.log(gameStats);
    const selectedPlayer = room.players.find(p => p.id === selectedPlayerId);
    const playerStats = gameStats?.find(stat => stat.userId === selectedPlayerId);

    const outcome = useMemo(() => getMatchOutcome(room, selectedPlayerId), [room, selectedPlayerId]);
    const gridCompletion = useMemo(() => calculatePlayerGridCompletion(room, playerStats), [room, playerStats]);
    const accuracy = useMemo(() =>
        playerStats ? calculateAccuracy(playerStats.correctGuesses, playerStats.incorrectGuesses) : 0,
        [playerStats]
    );
    const contribution = useMemo(() =>
        playerStats ? calculateContribution(playerStats.correctGuesses, gameStats) : 0,
        [playerStats, gameStats]
    );

    // Calculate Elo change
    const eloChange = playerStats?.eloChange;
    const currentElo = selectedPlayer?.eloRating || 0;
    const eloAtGame = playerStats?.eloAtGame || currentElo;

    return (
        <View className="rounded-sm border-[1.5px] border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 w-full pt-6">
            <Text className="text-lg text-center text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman'] mb-4">
                {outcome.isWinner ? 'Victory!' : 'Defeated'}
                {room.type === '2v2' && outcome.teamScore !== undefined && (
                    <Text className="text-sm"> ({outcome.teamScore} - {outcome.opponentScore})</Text>
                )}
            </Text>
            <Text className="text-xl text-center text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman'] mb-2">
                {selectedPlayer?.username || 'Player'}
            </Text>


            <ScrollView className="px-4 mb-4" style={{ maxHeight: 256 }}>
                <View className="">

                    {/* Score */}
                    <View className="flex-row mb-1 justify-between">
                        <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                            Score:
                        </Text>
                        <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                            {room.scores[selectedPlayerId] || 0}
                        </Text>
                    </View>


                    {/* Match Outcome */}
                    <View className="flex-row mb-1 justify-between">
                        <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                            Margin:
                        </Text>
                        <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                            {outcome.isWinner ? '+' : '-'}{outcome.margin} pts
                        </Text>
                    </View>

                    {/* Elo Change */}
                    <View className="flex-row mb-1 justify-between">
                        <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                            Rating:
                        </Text>
                        <View className="flex-row items-center gap-2">
                            <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                {eloAtGame}
                            </Text>
                            {eloChange !== undefined && eloChange !== 0 ? (
                                <View className="flex-row items-center gap-1">
                                    {eloChange > 0 ? (
                                        <TrendingUp size={16} color="#16a34a" />
                                    ) : (
                                        <TrendingDown size={16} color="#dc2626" />
                                    )}
                                    <Text className={cn(
                                        "font-['Times_New_Roman'] font-semibold",
                                        eloChange > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                    )}>
                                        {eloChange > 0 ? '+' : ''}{eloChange}
                                    </Text>
                                </View>
                            ) : (
                                <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman'] text-xs">
                                    (unchanged)
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Accuracy */}
                    {playerStats && (
                        <View className="flex-row mb-1 justify-between">
                            <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                                Accuracy:
                            </Text>
                            <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                {accuracy.toFixed(1)}% ({playerStats.correctGuesses} correct, {playerStats.incorrectGuesses} mistakes)
                            </Text>
                        </View>
                    )}

                    {/* Contribution */}
                    {playerStats && gameStats && gameStats.length > 1 && (
                        <View className="flex-row mb-1 justify-between">
                            <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                                Contribution:
                            </Text>
                            <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                {contribution.toFixed(1)}%
                            </Text>
                        </View>
                    )}

                    {/* Grid Completion */}
                    <View className="flex-row mb-1 justify-between">
                        <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                            Grid Solved:
                        </Text>
                        <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                            {gridCompletion.toFixed(1)}%
                        </Text>
                    </View>

                </View>
            </ScrollView>

            {/* Navigation buttons */}
            <View className="flex-row w-full mt-2">
                <View
                    className={cn(
                        "border-t-[2px] border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 flex-1 h-10 rounded-sm",
                    )}
                >
                    <Pressable
                        onPress={() => onNavigatePlayer('prev')}
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
                            <ChevronLeft color='#666666' size={32} />
                        </View>
                    </Pressable>
                </View>

                <View
                    className={cn(
                        "border-t-2 border-l-2 border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 flex-1 h-10 rounded-sm",
                    )}
                >
                    <Pressable
                        onPress={() => onNavigatePlayer('next')}
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
                            <ChevronRight color='#666666' size={32} />
                        </View>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};

interface TimeTrialResultsProps {
    room: Room;
    leaderboard: any[] | undefined;
    isLoading: boolean;
    error: Error | null;
    selectedPlayerId: number;
    onNavigatePlayer: (direction: 'prev' | 'next') => void;
    gameStats: GameStats[] | undefined;
}

const TimeTrialResults: React.FC<TimeTrialResultsProps> = ({
    room,
    leaderboard,
    isLoading,
    error,
    selectedPlayerId,
    onNavigatePlayer,
    gameStats
}) => {
    const selectedPlayer = room.players.find(p => p.id === selectedPlayerId);
    const playerStats = gameStats?.find(stat => stat.userId === selectedPlayerId);

    const gridCompletion = useMemo(() => calculatePlayerGridCompletion(room, playerStats), [room, playerStats]);
    const accuracy = useMemo(() =>
        playerStats ? calculateAccuracy(playerStats.correctGuesses, playerStats.incorrectGuesses) : 0,
        [playerStats]
    );
    const contribution = useMemo(() =>
        playerStats ? calculateContribution(playerStats.correctGuesses, gameStats) : 0,
        [playerStats, gameStats]
    );

    // Calculate Elo change
    const eloChange = playerStats?.eloChange;
    const currentElo = selectedPlayer?.eloRating || 0;
    const eloAtGame = playerStats?.eloAtGame || currentElo;

    return (
        <View className="rounded-sm border-[1.5px] border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 w-full pt-6">
            <Text className="text-xl text-center text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman'] mb-4">
                {selectedPlayer?.username || 'Player'}
            </Text>

            <ScrollView className="px-4 mb-4" style={{ maxHeight: 256 }}>
                <View className="space-y-3">
                    {/* Score */}
                    <View className="flex-row justify-between">
                        <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                            Score:
                        </Text>
                        <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                            {room.scores[selectedPlayerId] || 0}
                        </Text>
                    </View>

                    {/* Elo Change */}
                    <View className="flex-row justify-between">
                        <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                            Rating:
                        </Text>
                        <View className="flex-row items-center gap-2">
                            <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                {eloAtGame}
                            </Text>
                            {eloChange !== undefined && eloChange !== 0 ? (
                                <View className="flex-row items-center gap-1">
                                    {eloChange > 0 ? (
                                        <TrendingUp size={16} color="#16a34a" />
                                    ) : (
                                        <TrendingDown size={16} color="#dc2626" />
                                    )}
                                    <Text className={cn(
                                        "font-['Times_New_Roman'] font-semibold",
                                        eloChange > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                    )}>
                                        {eloChange > 0 ? '+' : ''}{eloChange}
                                    </Text>
                                </View>
                            ) : (
                                <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman'] text-xs">
                                    (unchanged)
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Accuracy */}
                    {playerStats && (
                        <View className="flex-row justify-between">
                            <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                                Accuracy:
                            </Text>
                            <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                {accuracy.toFixed(1)}% ({playerStats.correctGuesses} correct, {playerStats.incorrectGuesses} mistakes)
                            </Text>
                        </View>
                    )}

                    {/* Contribution */}
                    {playerStats && gameStats && gameStats.length > 1 && (
                        <View className="flex-row justify-between">
                            <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                                Contribution:
                            </Text>
                            <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                {contribution.toFixed(1)}%
                            </Text>
                        </View>
                    )}

                    {/* Grid Completion */}
                    <View className="flex-row justify-between">
                        <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                            Grid Solved:
                        </Text>
                        <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                            {gridCompletion.toFixed(1)}%
                        </Text>
                    </View>
                </View>

                {/* Leaderboard */}
                <View className="mt-6 pt-4 border-t border-[#343434] dark:border-neutral-600">
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
                                const isYou = entry.user?.id === selectedPlayerId;
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
            </ScrollView>

            {/* Navigation buttons */}
            <View className="flex-row w-full mt-4">
                <View
                    className={cn(
                        "border-t-[2px] border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 flex-1 h-16 rounded-sm",
                    )}
                >
                    <Pressable
                        onPress={() => onNavigatePlayer('prev')}
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
                            <ChevronLeft color='#666666' size={32} />
                        </View>
                    </Pressable>
                </View>

                <View
                    className={cn(
                        "border-t-2 border-l-2 border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 flex-1 h-16 rounded-sm",
                    )}
                >
                    <Pressable
                        onPress={() => onNavigatePlayer('next')}
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
                            <ChevronRight color='#666666' size={32} />
                        </View>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};

export const GameSummaryModal: React.FC<GameSummaryModalProps> = ({
    isVisible,
    onClose,
    room,
}) => {
    const { data: currentUser } = useUser();
    const logger = useLogger();
    const [qualityRating, setQualityRating] = useState(0);
    const [difficultyRating, setDifficultyRating] = useState<DifficultyRating | null>(null);
    const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0);
    const rateDifficulty = useRateDifficulty();
    const rateQuality = useRateQuality();

    // Fetch game stats using React Query
    const {
        data: gameStats,
        isLoading: statsLoading,
        error: statsError
    } = useGameStats(
        isVisible && room?.status === 'finished' ? room.id : undefined,
        isVisible && room?.status === 'finished'
    );

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

    // Initialize selected player to current user when modal opens
    React.useEffect(() => {
        if (isVisible && room.players) {
            const currentUserIndex = room.players.findIndex(p => p.id === currentUser.id);
            setSelectedPlayerIndex(currentUserIndex >= 0 ? currentUserIndex : 0);
        }
    }, [isVisible, room.players, currentUser.id]);

    const selectedPlayerId = room.players[selectedPlayerIndex]?.id || currentUser.id;

    const handleNavigatePlayer = (direction: 'prev' | 'next') => {
        setSelectedPlayerIndex(prev => {
            if (direction === 'prev') {
                return prev > 0 ? prev - 1 : room.players.length - 1;
            } else {
                return prev < room.players.length - 1 ? prev + 1 : 0;
            }
        });
    };

    const handleDifficultyRate = async (rating: DifficultyRating) => {
        try {
            rateDifficulty.mutate({ crosswordId: room.crossword.id, rating });
            setDifficultyRating(rating);
        } catch (error) {
            logger.mutate({ log: { context: 'handleDifficultyRate failed on GameSummaryModal' }, severity: 'error' })
            console.error('Failed to rate difficulty:', error);
        }
    };

    const handleQualityRate = async (rating: 1 | 2 | 3 | 4 | 5) => {
        try {
            rateQuality.mutate({ crosswordId: room.crossword.id, rating });
            setQualityRating(rating);
        } catch (error) {
            logger.mutate({ log: { context: 'handleQualityRate failed on GameSummaryModal' }, severity: 'error' })
            console.error('Failed to rate quality:', error);
        }
    };

    const renderResults = () => {
        // Show loading state while fetching stats
        if (statsLoading) {
            return (
                <View className="rounded-sm border-[1.5px] border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 w-full pt-6 pb-6">
                    <Text className="text-center text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                        Loading stats...
                    </Text>
                </View>
            );
        }

        // Show error state if stats failed to load
        if (statsError) {
            return (
                <View className="rounded-sm border-[1.5px] border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800 w-full pt-6 pb-6">
                    <Text className="text-center text-[#8B0000] dark:text-[#FF6B6B] font-['Times_New_Roman']">
                        Failed to load game stats
                    </Text>
                </View>
            );
        }

        if (room.type === 'time_trial') {
            return (
                <TimeTrialResults
                    room={room}
                    leaderboard={leaderboard}
                    isLoading={lbLoading}
                    error={lbError}
                    selectedPlayerId={selectedPlayerId}
                    onNavigatePlayer={handleNavigatePlayer}
                    gameStats={gameStats}
                />
            );
        }

        // For 1v1, 2v2, and free4all modes
        return (
            <CompetitiveResults
                room={room}
                selectedPlayerId={selectedPlayerId}
                onNavigatePlayer={handleNavigatePlayer}
                gameStats={gameStats}
            />
        );
    };

    return (
        <Dialog open={isVisible} onOpenChange={onClose}>
            <DialogContent className="bg-[#F5F5F5] flex w-96 h-[500px] dark:bg-[#1A2227]">
                <View className="flex-1 flex justify-between p-2">
                    <ScrollView contentContainerClassName='flex flex-col gap-4'>
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
