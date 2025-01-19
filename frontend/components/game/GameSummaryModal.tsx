import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Target, TrendingUp, Crown, X, Timer, Users, Flame } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEloVisibility } from '~/hooks/useEloVisibility';
import { LineChart, YAxis, Grid } from 'react-native-svg-charts';
import * as shape from 'd3-shape';
import { useColorScheme } from 'react-native';

interface TimeGraphProps {
    timings: number[];
}

const TimeGraph: React.FC<TimeGraphProps> = ({ timings }) => {
    if (timings.length === 0) return null;
    const colorScheme = useColorScheme();

    const Chart = LineChart as any;
    const YAxisComponent = YAxis as any;
    const GridComponent = Grid as any;
    const contentInset = { top: 10, bottom: 10 };

    return (
        <View className="flex-row h-[120px]">
            <YAxisComponent
                data={timings}
                contentInset={contentInset}
                svg={{
                    fontSize: 10,
                    fill: colorScheme === 'dark' ? '#9CA3AF' : '#666666',
                    fontFamily: 'Times New Roman'
                }}
                numberOfTicks={4}
                formatLabel={(value: number) => `${Math.round(value)}s`}
                style={{ marginRight: 10, width: 35 }}
            />
            <View className="flex-1">
                <Chart
                    style={{ flex: 1 }}
                    data={timings}
                    contentInset={{ ...contentInset, left: 10, right: 10 }}
                    curve={shape.curveNatural}
                    svg={{ stroke: '#8B0000', strokeWidth: 2 }}
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
    );
};

interface GameSummaryModalProps {
    visible: boolean;
    onClose: () => void;
    stats: {
        isWinner: boolean;
        correctGuesses: number;
        incorrectGuesses: number;
        eloAtGame: number;
        eloChange: number;
        opponentStats: {
            correctGuesses: number;
            incorrectGuesses: number;
        };
        guessTimings: number[]; // array of timestamps between guesses in seconds
        longestStreak: number;
    };
}

export const GameSummaryModal: React.FC<GameSummaryModalProps> = ({
    visible,
    onClose,
    stats
}) => {
    const router = useRouter();
    const { isEloVisible } = useEloVisibility();
    const accuracy = Math.round((stats.correctGuesses / (stats.correctGuesses + stats.incorrectGuesses)) * 100) || 0;
    const opponentAccuracy = Math.round((stats.opponentStats.correctGuesses /
        (stats.opponentStats.correctGuesses + stats.opponentStats.incorrectGuesses)) * 100) || 0;

    const handleContinue = () => {
        onClose();
        router.push('/(root)/(tabs)');
    };

    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center bg-black/50">
                <View className="w-[95%] max-w-[500px] max-h-[90%] bg-white dark:bg-[#1A2227] rounded-2xl p-6">
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-2xl font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                {stats.isWinner ? 'Victory!' : 'Game Over'}
                            </Text>
                            <TouchableOpacity onPress={onClose}>
                                <X size={24} color="#666666" />
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row flex-wrap gap-4 mb-6">
                            {isEloVisible && (
                                <View className="flex-1 min-w-[45%] bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                                            ELO Change
                                        </Text>
                                        <Crown size={20} color="#8B0000" />
                                    </View>
                                    <Text className="text-2xl font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                        {stats.eloChange > 0 ? '+' : ''}{stats.eloChange}
                                    </Text>
                                </View>
                            )}

                            <View className="flex-1 min-w-[45%] bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                                        Your Accuracy
                                    </Text>
                                    <Target size={20} color="#8B0000" />
                                </View>
                                <Text className="text-2xl font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                    {accuracy}%
                                </Text>
                            </View>

                            <View className="flex-1 min-w-[45%] bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                                        Total Guesses
                                    </Text>
                                    <TrendingUp size={20} color="#8B0000" />
                                </View>
                                <Text className="text-2xl font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                    {stats.correctGuesses + stats.incorrectGuesses}
                                </Text>
                            </View>

                            <View className="flex-1 min-w-[45%] bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                                        Longest Streak
                                    </Text>
                                    <Flame size={20} color="#8B0000" />
                                </View>
                                <Text className="text-2xl font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                    {stats.longestStreak}
                                </Text>
                            </View>

                            <View className="w-full bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                                        Opponent Stats
                                    </Text>
                                    <Users size={20} color="#8B0000" />
                                </View>
                                <View className="flex-row justify-between">
                                    <View>
                                        <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                                            Accuracy
                                        </Text>
                                        <Text className="text-xl font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                            {opponentAccuracy}%
                                        </Text>
                                    </View>
                                    <View>
                                        <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                                            Total Guesses
                                        </Text>
                                        <Text className="text-xl font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                            {stats.opponentStats.correctGuesses + stats.opponentStats.incorrectGuesses}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <View className="w-full bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                                        Time Between Guesses
                                    </Text>
                                    <Timer size={20} color="#8B0000" />
                                </View>
                                <TimeGraph timings={stats.guessTimings} />
                            </View>
                        </View>

                        <TouchableOpacity
                            className="w-full bg-[#8B0000] py-3 rounded-lg"
                            onPress={handleContinue}
                        >
                            <Text className="text-white text-center font-semibold font-['Times_New_Roman']">
                                Continue
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};
