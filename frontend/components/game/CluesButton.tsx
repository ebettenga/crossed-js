import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
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
}

export const CluesButton: React.FC<CluesButtonProps> = ({
    clues,
    onCluePress
}) => {
    const [isCluesModalVisible, setIsCluesModalVisible] = useState(false);
    const { isDark } = useColorMode();

    return (
        <View className="absolute bottom-5 left-4 items-start">
            <TouchableOpacity
                className={cn(
                    "w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700",
                    "justify-center items-center shadow-md"
                )}
                onPress={() => setIsCluesModalVisible(true)}
            >
                <NotepadText size={20} color={isDark ? '#DDE1E5' : '#4A4A4A'} />
            </TouchableOpacity>

            {<CluesModal
                visible={isCluesModalVisible}
                onClose={() => setIsCluesModalVisible(false)}
                clues={clues}
                onCluePress={(square, isAcrossMode) => {
                    onCluePress(square, isAcrossMode);
                    setIsCluesModalVisible(false);
                }}
            /> }
        </View>
    );
};
