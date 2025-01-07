import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { PageHeader } from '~/components/Header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '~/hooks/users';
import { useRecentGames, RecentGame } from '~/hooks/useRecentGames';
import { Trophy, Target, TrendingUp, Crown, X } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { EloChart } from '~/components/stats/EloChart';
import { AccuracyChart } from '~/components/stats/AccuracyChart';
import { cn } from '~/lib/utils';
import { useEloVisibility } from '~/hooks/useEloVisibility';

interface StatCardProps {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    suffix?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, suffix }) => (
    <View className="flex-1 min-w-[45%] bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
        <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                {title}
            </Text>
            {icon}
        </View>
        <Text className="text-2xl font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
            {value}{suffix}
        </Text>
    </View>
);

interface GameRowProps {
    game: RecentGame;
    userId: number;
}

const GameRow: React.FC<GameRowProps> = ({ game, userId }) => {
    const { isEloVisible } = useEloVisibility();
    const isWinner = game.room.scores[userId] === Math.max(...Object.values(game.room.scores));
    const userScore = game.room.scores[userId];

    return (
        <View className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <View className="gap-2">
                <View className="flex-row justify-between items-center">
                    <Text className="text-base font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                        {isWinner ? 'Victory' : 'Defeat'}
                    </Text>
                    <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                        {formatDistanceToNow(new Date(game.room.created_at), { addSuffix: true })}
                    </Text>
                </View>
                <View className="flex-row items-center gap-2">
                    <Text className="text-xl font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                        {userScore} pts
                    </Text>
                    {game.stats.isWinner ? (
                        <Crown size={20} color="#FFD700" />
                    ) : (
                        <X size={20} color="#EF4444" />
                    )}
                </View>

                <View className="flex-row justify-between items-center">
                    <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                        {game.stats.correctGuesses} correct • {game.stats.incorrectGuesses} incorrect
                    </Text>
                    {isEloVisible && (
                        <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                            {game.stats.eloAtGame} ELO
                        </Text>
                    )}
                </View>
            </View>
        </View>
    );
};

export default function Stats() {
    const insets = useSafeAreaInsets();
    const { data: user, isLoading: userLoading, refetch: refetchUser } = useUser();
    const { isEloVisible } = useEloVisibility();

    const oneMonthAgo = React.useMemo(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date;
    }, []);

    const {
        data: recentGames,
        isLoading: gamesLoading,
        refetch: refetchGames
    } = useRecentGames(oneMonthAgo);

    const onRefresh = React.useCallback(async () => {
        try {
            await Promise.all([
                refetchUser(),
                refetchGames()
            ]);
        } catch (error) {
            console.error('Error refreshing stats:', error);
        }
    }, [refetchUser, refetchGames]);

    if (userLoading || !user) {
        return (
            <View className="flex-1 items-center justify-center bg-[#F6FAFE] dark:bg-[#0F1417]">
                <ActivityIndicator size="large" color="#8B0000" />
            </View>
        );
    }

    const totalGames = user.gamesWon + user.gamesLost;
    const winRate = totalGames > 0 ? Math.round((user.gamesWon / totalGames) * 100) : 0;

    return (
        <View className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417]" style={{ paddingBottom: insets.bottom }}>
            <PageHeader />

            <ScrollView
                className="flex-1 px-4"
                refreshControl={
                    <RefreshControl
                        refreshing={userLoading || gamesLoading}
                        onRefresh={onRefresh}
                        tintColor="#8B0000"
                        colors={["#8B0000"]}
                    />
                }
            >
                <View className="flex-row flex-wrap gap-3 mt-6">
                    {isEloVisible && (
                        <StatCard
                            title="Current ELO"
                            value={user.eloRating}
                            icon={<Crown size={20} color="#8B0000" />}
                        />
                    )}
                    <StatCard
                        title="Win Rate"
                        value={winRate}
                        suffix="%"
                        icon={<Trophy size={20} color="#8B0000" />}
                    />
                    <StatCard
                        title="Accuracy"
                        value={user.guessAccuracy}
                        suffix="%"
                        icon={<Target size={20} color="#8B0000" />}
                    />
                    <StatCard
                        title="Games Played"
                        value={totalGames}
                        icon={<TrendingUp size={20} color="#8B0000" />}
                    />
                    <StatCard
                        title="Games Won"
                        value={user.gamesWon}
                        icon={<Trophy size={24} color="#FFD700" />}
                    />
                    <StatCard
                        title="Games Lost"
                        value={user.gamesLost}
                        icon={<Trophy size={24} color="#C0C0C0" />}
                    />
                </View>

                {isEloVisible && (
                    <View className="mb-6">
                        <Text className="text-lg font-semibold text-[#1D2124] dark:text-[#DDE1E5] mb-3 font-['Times_New_Roman']">
                            ELO History
                        </Text>
                        <EloChart startDate={oneMonthAgo} />
                    </View>
                )}

                <View className="mb-6">
                    <Text className="text-lg font-semibold text-[#1D2124] dark:text-[#DDE1E5] mb-3 font-['Times_New_Roman']">
                        Guess Accuracy History
                    </Text>
                    <AccuracyChart startDate={oneMonthAgo} />
                </View>

                <View className="mb-6">
                    <Text className="text-lg font-semibold text-[#1D2124] dark:text-[#DDE1E5] mb-3 font-['Times_New_Roman']">
                        Recent Games
                    </Text>
                    {gamesLoading ? (
                        <ActivityIndicator size="large" color="#8B0000" />
                    ) : recentGames?.length === 0 ? (
                        <Text className="text-center text-[#666666] dark:text-neutral-400 font-['Times_New_Roman'] text-base py-6">
                            No games played yet
                        </Text>
                    ) : (
                        <View className="gap-3 pb-20">
                            {recentGames?.map(game => (
                                <GameRow
                                    key={game.room.id}
                                    game={game}
                                    userId={user.id}
                                />
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
