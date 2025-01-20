import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { TrendingUp, TrendingDown, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useUser } from '~/hooks/users';
import { useRecentGames } from '~/hooks/useRecentGames';
import { useEloVisibility } from '~/hooks/useEloVisibility';
import { useActiveUsers } from '~/hooks/useActiveUsers';

export const PageHeader = () => {
    const router = useRouter();
    const { data: user } = useUser();
    const { isEloVisible } = useEloVisibility();
    const { data: activeUsers } = useActiveUsers();

    if (!user) return null;

    // Get stats from the last week
    const oneWeekAgo = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date;
    }, []);

    const { data: weeklyStats } = useRecentGames(oneWeekAgo);

    // Calculate ELO difference and games played
    const { eloChange, isEloUp, eloChangeColor } = useMemo(() => {
        const oldestGame = weeklyStats?.length ? weeklyStats.reduce((min, game) => new Date(game.room.created_at) < new Date(min.room.created_at) ? game : min, weeklyStats[0]) : null;
        const change = oldestGame ? user.eloRating - oldestGame.stats.eloAtGame : 0;
        const up = change > 0;
        return {
            eloChange: change,
            isEloUp: up,
            eloChangeColor: up ? '#34D399' : '#EF4444'
        };
    }, [weeklyStats, user.eloRating, user.gamesWon, user.gamesLost]);

    return (
        <View className="bg-[#F6FAFE] dark:bg-[#0F1417] px-4 py-5 border-b border-neutral-200 dark:border-neutral-800">
            <View className="flex-row justify-between items-center">
                <TouchableOpacity
                    className="flex-row items-center gap-3"
                    onPress={() => router.push('/profile/edit')}
                >
                    {user.photo && (
                        <Image
                            source={{ uri: user.photo }}
                            className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800"
                        />
                    )}
                    <View className="gap-0.5">
                        <Text className="text-xs text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                            Welcome back,
                        </Text>
                        <Text className="text-base font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                            {user.username}
                        </Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    className="items-end"
                    onPress={() => router.push('/(root)/(tabs)/stats')}
                >
                    <View className="flex-row items-center gap-3 bg-neutral-50 dark:bg-neutral-800 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700">
                        {isEloVisible && (
                            <>
                                <View className="items-center gap-0.5">
                                    <View className="flex-row items-center gap-1">
                                        <Text className="text-base font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                            {user.eloRating}
                                        </Text>
                                        {eloChange !== 0 && (
                                            <View className="flex-row items-center gap-0.5">
                                                {isEloUp ? (
                                                    <TrendingUp size={12} color={eloChangeColor} />
                                                ) : (
                                                    <TrendingDown size={12} color={eloChangeColor} />
                                                )}
                                                <Text className="text-xs font-['Times_New_Roman']" style={{ color: eloChangeColor }}>
                                                    {isEloUp ? '+' : ''}{eloChange}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-xs text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                                        ELO
                                    </Text>
                                </View>
                            </>
                        )}
                        <View className="w-px h-6 bg-neutral-200 dark:bg-neutral-700" />

                        <View className="items-center gap-0.5">
                            <View className="flex-row items-center gap-1">
                                <Users size={16} color="#666666" />
                                <Text className="text-base font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                    {activeUsers?.toString() || 0}
                                </Text>
                            </View>
                            <Text className="text-xs text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                                Online
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
};
