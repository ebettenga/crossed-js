import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart, YAxis, Grid } from 'react-native-svg-charts';
import { useUserGameStats, useUser } from '~/hooks/users';

interface AccuracyChartProps {
    startDate?: Date;
}

export const AccuracyChart: React.FC<AccuracyChartProps> = ({ startDate }) => {
    const { data: gameStats } = useUserGameStats(startDate);
    const { data: user } = useUser();

    if (!gameStats?.length || !user) return null;

    // Sort by date and calculate accuracy for each game
    const data = [...gameStats]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(stat => {
            const total = stat.correctGuesses + stat.incorrectGuesses;
            return total > 0 ? (stat.correctGuesses / total) * 100 : 0;
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
        <View style={styles.container}>
            <View style={styles.chartRow}>
                <YAxisComponent
                    data={data}
                    contentInset={contentInset}
                    svg={{ fontSize: 12, fill: '#666666', fontFamily: 'Times New Roman' }}
                    numberOfTicks={5}
                    formatLabel={(value: number) => `${Math.round(value)}%`}
                    style={styles.yAxis}
                />
                <View style={styles.chartContainer}>
                    <Chart
                        style={styles.chart}
                        data={data}
                        svg={{ stroke: '#34D399', strokeWidth: 2 }}
                        contentInset={{ ...contentInset, left: 10, right: 10 }}
                        animate={true}
                        animationDuration={300}
                    >
                        <GridComponent />
                    </Chart>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#F8F8F5',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    chartRow: {
        flexDirection: 'row',
        height: 200,
    },
    yAxis: {
        marginRight: 10,
        width: 40,
    },
    chartContainer: {
        flex: 1,
    },
    chart: {
        flex: 1,
    },
}); 