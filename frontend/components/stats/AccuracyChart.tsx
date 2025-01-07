import React from 'react';
import { View } from 'react-native';
import { LineChart, YAxis, Grid } from 'react-native-svg-charts';
import { useUser } from '~/hooks/users';
import { useRecentGames } from '~/hooks/useRecentGames';
import { useColorScheme } from 'react-native';

interface AccuracyChartProps {
    startDate?: Date;
}

export const AccuracyChart: React.FC<AccuracyChartProps> = ({ startDate }) => {
    const { data: gameStats } = useRecentGames(startDate);
    const { data: user } = useUser();
    const colorScheme = useColorScheme();

    if (!gameStats?.length || !user) return null;

    // Sort by date and calculate accuracy for each game
    const data = [...gameStats]
        .sort((a, b) => new Date(a.room.created_at).getTime() - new Date(b.room.created_at).getTime())
        .map(stat => {
            const total = stat.stats.correctGuesses + stat.stats.incorrectGuesses;
            return total > 0 ? (stat.stats.correctGuesses / total) * 100 : 0;
        });

    // Append current accuracy if we have it
    if (user.guessAccuracy !== undefined && data[data.length - 1] !== user.guessAccuracy) {
        data.push(user.guessAccuracy);
    }

    const Chart = LineChart as any;
    const YAxisComponent = YAxis as any;
    const GridComponent = Grid as any;
    const contentInset = { top: 20, bottom: 20 };

    return (
        <View className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <View className="flex-row h-[200px]">
                <YAxisComponent
                    data={data}
                    contentInset={contentInset}
                    svg={{
                        fontSize: 12,
                        fill: colorScheme === 'dark' ? '#9CA3AF' : '#666666',
                        fontFamily: 'Times New Roman'
                    }}
                    numberOfTicks={5}
                    formatLabel={(value: number) => `${Math.round(value)}%`}
                    style={{ marginRight: 10, width: 40 }}
                />
                <View className="flex-1">
                    <Chart
                        style={{ flex: 1 }}
                        data={data}
                        svg={{ stroke: '#34D399', strokeWidth: 2 }}
                        contentInset={{ ...contentInset, left: 10, right: 10 }}
                        animate={true}
                        animationDuration={300}
                    >
                        <GridComponent
                            svg={{
                                stroke: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
                                strokeWidth: 1
                            }}
                        />
                    </Chart>
                </View>
            </View>
        </View>
    );
};
