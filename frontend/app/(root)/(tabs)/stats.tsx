import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { PageHeader } from '~/components/Header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '~/hooks/users';
import { useRecentGames, RecentGame } from '~/hooks/useRecentGames';
import { Trophy, Target, TrendingUp, Crown, X } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { EloChart } from '~/components/stats/EloChart';
import { AccuracyChart } from '~/components/stats/AccuracyChart';
import { cn } from '~/lib/utils';

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
    const userScore = game.room.scores[userId] || 0;

    return (
        <View className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700">
            <View className="gap-2">
                <View className="flex-row justify-between items-center">
                    <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman'] font-semibold">
                        {game.room.type.toUpperCase()} • {game.room.difficulty}
                    </Text>
                    <Text className="text-xs text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
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
                    <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                        {game.stats.eloAtGame} ELO
                    </Text>
                </View>
            </View>
        </View>
    );
};

export default function Stats() {
    const insets = useSafeAreaInsets();
    const { data: user } = useUser();

    // Get stats from the last month for the chart
    const oneMonthAgo = React.useMemo(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date;
    }, []);
    const { data: recentGames, isLoading: gamesLoading } = useRecentGames(oneMonthAgo);

    if (!user) return null;

    return (
        <View className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417]">
            <PageHeader />
            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    padding: 16,
                    paddingBottom: insets.bottom + 90
                }}
            >
                <View className="flex-row flex-wrap gap-4 mb-6">
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
                    <StatCard
                        title="Win Rate"
                        value={user.winRate}
                        suffix="%"
                        icon={<TrendingUp size={24} color="#34D399" />}
                    />
                    <StatCard
                        title="Guess Accuracy"
                        value={user.guessAccuracy}
                        suffix="%"
                        icon={<Target size={24} color="#8B0000" />}
                    />
                </View>

                <View className="mb-6">
                    <Text className="text-lg font-semibold text-[#1D2124] dark:text-[#DDE1E5] mb-3 font-['Times_New_Roman']">
                        ELO History
                    </Text>
                    <EloChart startDate={oneMonthAgo} />
                </View>

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
                        <View className="gap-3">
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
