import React from 'react';
import { View, Text } from 'react-native';
import { Square } from '~/hooks/useRoom';

interface ClueDisplayProps {
  selectedSquare: Square | null;
  isAcrossMode: boolean;
}

export const ClueDisplay: React.FC<ClueDisplayProps> = ({ selectedSquare, isAcrossMode }) => {
  if (!selectedSquare) return null;
  const clue = isAcrossMode ? selectedSquare.acrossQuestion : selectedSquare.downQuestion;

  if (!clue) return null;

  const clueText = clue.split(".")[1];

  return (
  <View className="p-2 pt-4 items-center justify-center min-h-[40px] flex">
      <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] leading-6 text-center px-4 flex-wrap-none flex-shrink">
        {clueText}
      </Text>
    </View>
  );
};
