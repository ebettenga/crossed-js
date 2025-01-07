import React from 'react';
import { View } from 'react-native';
import { LineChart, YAxis } from 'react-native-svg-charts';
import { useUserGameStats, useUser } from '~/hooks/users';
import { useColorScheme } from 'react-native';

interface EloChartProps {
    startDate?: Date;
}

export const EloChart: React.FC<EloChartProps> = ({ startDate }) => {
    const { data: gameStats } = useUserGameStats(startDate);
    const { data: user } = useUser();
    const colorScheme = useColorScheme();

    if (!gameStats?.length || !user) return null;

    // Sort by date and map to ELO values, then append current ELO
    const data = [...gameStats]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(stat => stat.eloAtGame);

    // Append current ELO if it's different from the last ELO in the stats
    if (data[data.length - 1] !== user.eloRating) {
        data.push(user.eloRating);
    }

    const Chart = LineChart as any;
    const YAxisComponent = YAxis as any;
    const contentInset = { top: 20, bottom: 20 };

    // Find min and max ELO values
    const minElo = Math.min(...data);
    const maxElo = Math.max(...data);

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
                    numberOfTicks={2}
                    formatLabel={(value: number) => Math.round(value)}
                    style={{ marginRight: 10, width: 40 }}
                />
                <View className="flex-1">
                    <Chart
                        style={{ flex: 1 }}
                        data={data}
                        svg={{ stroke: '#8B0000', strokeWidth: 2 }}
                        contentInset={{ ...contentInset, left: 10, right: 10 }}
                        animate={true}
                        animationDuration={300}
                    />
                </View>
            </View>
        </View>
    );
};
