import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Trophy, Target, TrendingUp, Crown, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEloVisibility } from '~/hooks/useEloVisibility';

interface GameSummaryModalProps {
    visible: boolean;
    onClose: () => void;
    stats: {
        isWinner: boolean;
        correctGuesses: number;
        incorrectGuesses: number;
        eloAtGame: number;
        eloChange: number;
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
                <View className="w-[90%] max-w-[400px] bg-white dark:bg-[#1A2227] rounded-2xl p-6">
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
                                    Accuracy
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
                                    Correct
                                </Text>
                                <TrendingUp size={20} color="#8B0000" />
                            </View>
                            <Text className="text-2xl font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                {stats.correctGuesses}
                            </Text>
                        </View>

                        <View className="flex-1 min-w-[45%] bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700">
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-sm text-[#666666] dark:text-neutral-400 font-['Times_New_Roman']">
                                    Incorrect
                                </Text>
                                <X size={20} color="#8B0000" />
                            </View>
                            <Text className="text-2xl font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                {stats.incorrectGuesses}
                            </Text>
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
                </View>
            </View>
        </Modal>
    );
};
