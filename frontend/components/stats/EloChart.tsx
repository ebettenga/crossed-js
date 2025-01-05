import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LineChart, YAxis } from 'react-native-svg-charts';
import { useUserGameStats, useUser } from '~/hooks/users';

interface EloChartProps {
    startDate?: Date;
}

export const EloChart: React.FC<EloChartProps> = ({ startDate }) => {
    const { data: gameStats } = useUserGameStats(startDate);
    const { data: user } = useUser();

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
        <View style={styles.container}>
            <View style={styles.chartRow}>
                <YAxisComponent
                    data={data}
                    contentInset={contentInset}
                    svg={{ fontSize: 12, fill: '#666666', fontFamily: 'Times New Roman' }}
                    numberOfTicks={2}
                    formatLabel={(value: number) => Math.round(value)}
                    style={styles.yAxis}
                />
                <View style={styles.chartContainer}>
                    <Chart
                        style={styles.chart}
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