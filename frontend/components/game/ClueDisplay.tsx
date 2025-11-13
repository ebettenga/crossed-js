import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { decode } from 'html-entities';
import { Square } from '~/hooks/useJoinRoom';
import { useHaptics } from '~/hooks/useHaptics';

interface ClueDisplayProps {
  selectedSquare: Square | null;
  isAcrossMode: boolean;
  onNavigate: (direction: 'next' | 'previous') => void;
}

export const ClueDisplay: React.FC<ClueDisplayProps> = ({
  selectedSquare,
  isAcrossMode,
  onNavigate
}) => {
  const { selection } = useHaptics();

  const handleNavigate = (direction: 'next' | 'previous') => {
    selection();
    onNavigate(direction);
  };

  if (!selectedSquare) return null;
  const clue = isAcrossMode ? selectedSquare.acrossQuestion : selectedSquare.downQuestion;

  if (!clue) return null;

  const rawClueText = clue.replace(/^\s*\d+\.\s*/, '').trim();
  const clueText = decode(rawClueText);

  return (
    <View className="relative p-2 min-h-[40px] justify-center">
      <View className="absolute inset-0 flex-row">
        <TouchableOpacity
          onPress={() => handleNavigate('previous')}
          className="flex-1 justify-center items-start px-4"
          accessibilityRole="button"
          accessibilityLabel="Previous clue"
        >
          <ChevronLeft size={24} color="#666666" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleNavigate('next')}
          className="flex-1 justify-center items-end px-4"
          accessibilityRole="button"
          accessibilityLabel="Next clue"
        >
          <ChevronRight size={24} color="#666666" />
        </TouchableOpacity>
      </View>

      <View className="px-4" pointerEvents="none">
        <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] leading-6 text-center">
          {clueText}
        </Text>
      </View>
    </View>
  );
};
