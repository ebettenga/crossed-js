import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, useColorScheme } from 'react-native';
import { X } from 'lucide-react-native';
import { Square } from '~/hooks/useRoom';
import { useColorMode } from '~/hooks/useColorMode';

interface CluesModalProps {
    visible: boolean;
    onClose: () => void;
    clues: {
        across: Square[];
        down: Square[];
    };
    onCluePress: (square: Square, isAcrossMode: boolean) => void;
}

export const CluesModal: React.FC<CluesModalProps> = ({
    visible,
    onClose,
    clues,
    onCluePress,
}) => {
    const { isDark } = useColorMode();
    const [isAcrossMode, setIsAcrossMode] = React.useState(true);

    const handleCluePress = (number: number | null, isAcross: boolean) => {
        const square = isAcross ? clues.across.find(square => square.gridnumber === number) : clues.down.find(square => square.gridnumber === number);
        if (square) {
            onCluePress(square, isAcross);
            onClose();
        }
    };

    const handlePress = (number: number | null, isAcross: boolean) => {
        handleCluePress(number, isAcross);
    };

    const renderClues = (clueList: Square[], isAcross: boolean) => {
        return clueList
            .sort((a, b) => (a.gridnumber ?? 0) - (b.gridnumber ?? 0))
            .map((clue) => {
                const number = clue.gridnumber;
                return (
                    <TouchableOpacity
                        key={`${isAcross ? 'across' : 'down'}-${number}`}
                        onPress={() => handlePress(number, isAcross)}
                        activeOpacity={0.7}
                        className="py-4 px-4 border-b border-neutral-200 dark:border-neutral-700"
                    >
                        <Text className="text-base font-semibold text-[#2B2B2B] dark:text-[#DDE1E5] font-rubik">
                            {isAcross ? clue.acrossQuestion : clue.downQuestion}
                        </Text>
                    </TouchableOpacity>
                );
            });
    };

    const memoizedAcrossClues = React.useMemo(() =>
        renderClues(clues.across, true)
        , [clues.across, handleCluePress]);

    const memoizedDownClues = React.useMemo(() =>
        renderClues(clues.down, false)
        , [clues.down, handleCluePress]);

    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50">
                <View className="flex-1 mt-20 bg-white dark:bg-[#1A2227] rounded-t-3xl">
                    <View className="flex-row justify-between items-center p-4 border-b border-neutral-200 dark:border-neutral-700">
                        <Text className="text-2xl font-semibold text-[#2B2B2B] dark:text-[#DDE1E5] font-rubik">
                            Clues
                        </Text>
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <X size={24} color={isDark ? '#FFFFFF' : '#2B2B2B'} />
                        </TouchableOpacity>
                    </View>
                    <View className="flex-row justify-center my-4">
                        <View className="w-[200px] h-[40px] bg-neutral-100 dark:bg-neutral-800 rounded-full p-1 flex-row relative">
                            <View
                                className={`absolute w-[100px] h-[40px] bg-[#8B0000] rounded-full ${isAcrossMode ? 'left-1' : 'right-1'}`}
                            />
                            <TouchableOpacity
                                onPress={() => setIsAcrossMode(true)}
                                className="flex-1 justify-center items-center"
                            >
                                <Text className={`font-semibold ${isAcrossMode ? 'text-white' : 'text-[#2B2B2B] dark:text-[#DDE1E5]'} font-rubik`}>
                                    Across
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setIsAcrossMode(false)}
                                className="flex-1 justify-center items-center"
                            >
                                <Text className={`font-semibold ${!isAcrossMode ? 'text-white' : 'text-[#2B2B2B] dark:text-[#DDE1E5]'} font-rubik`}>
                                    Down
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
                        {isAcrossMode ? memoizedAcrossClues : memoizedDownClues}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};
