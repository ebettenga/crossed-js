import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { decode } from 'html-entities';
import { Square } from '~/hooks/useJoinRoom';

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
  if (!selectedSquare) return null;
  const clue = isAcrossMode ? selectedSquare.acrossQuestion : selectedSquare.downQuestion;

  if (!clue) return null;

  const rawClueText = clue.replace(/^\s*\d+\.\s*/, '').trim();
  const clueText = decode(rawClueText);

  return (
    <View className="p-2 pt-4 flex-row items-center justify-between min-h-[40px]">
      <TouchableOpacity
        onPress={() => onNavigate('previous')}
        className="p-2"
      >
        <ChevronLeft size={24} color="#666666" />
      </TouchableOpacity>

      <View className="flex-1 px-4">
        <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] leading-6 text-center">
          {clueText}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => onNavigate('next')}
        className="p-2"
      >
        <ChevronRight size={24} color="#666666" />
      </TouchableOpacity>
    </View>
  );
};
