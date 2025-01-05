import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-svg-charts';
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

    return (
        <View style={styles.container}>
            <Chart
                style={styles.chart}
                data={data}
                svg={{ stroke: '#8B0000', strokeWidth: 2 }}
                contentInset={{ top: 20, bottom: 20, left: 10, right: 10 }}
                animate={true}
                animationDuration={300}
            />
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
    chart: {
        height: 200,
    },
}); 