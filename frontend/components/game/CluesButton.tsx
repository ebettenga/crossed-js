import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { NotepadText } from 'lucide-react-native';
import { CluesModal } from './CluesModal';
import { Square } from '~/hooks/useRoom';
import { cn } from '~/lib/utils';
import { useColorMode } from '~/hooks/useColorMode';

interface CluesButtonProps {
    clues: {
        across: Square[];
        down: Square[];
    };
    onCluePress: (square: Square, isAcrossMode: boolean) => void;
    onButtonPress: (square: Square, isAcrossMode: boolean) => void;
    isAcrossMode: boolean;
}

export const CluesButton: React.FC<CluesButtonProps> = ({
    clues,
    onCluePress,
    isAcrossMode,
    onButtonPress,
}) => {
    const [isCluesModalVisible, setIsCluesModalVisible] = useState(false);
    const { isDark } = useColorMode();

    return (
        <View className="items-start pb-2">
            <TouchableOpacity
                className={cn(
                    "w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700",
                    "justify-center items-center shadow-md flex"
                )}
                onLongPress={() => setIsCluesModalVisible(true)}
                onPress={() => onButtonPress(clues[isAcrossMode ? 'across' : 'down'][0], isAcrossMode)}
            >
                <Text className={`text-sm font-semibold justify-center items-center pt-1 pl-0.5 ${isAcrossMode ? 'text-white' : 'text-[#1D2124] dark:text-[#DDE1E5]'}`}>
                    {isAcrossMode ? 'A' : 'D'}
                </Text>
            </TouchableOpacity>

            {<CluesModal
                visible={isCluesModalVisible}
                onClose={() => setIsCluesModalVisible(false)}
                clues={clues}
                onCluePress={(square, isAcrossMode) => {
                    onCluePress(square, isAcrossMode);
                    setIsCluesModalVisible(false);
                }}
            />}
        </View>
    );
};
