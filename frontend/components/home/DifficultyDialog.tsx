import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Swords, X } from 'lucide-react-native';

type Difficulty = 'easy' | 'medium' | 'hard';

type DifficultyDialogProps = {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (difficulty: Difficulty) => void;
};

export const DifficultyDialog = ({ isVisible, onClose, onSelect }: DifficultyDialogProps) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('easy');

  const difficulties: { label: string; value: Difficulty }[] = [
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
  ];

  const handleStart = () => {
    onSelect(selectedDifficulty);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="m-5 bg-white dark:bg-[#1A2227] rounded-[20px] p-8 items-center shadow-lg min-w-[300px]">
          <Text className="text-2xl font-semibold mb-4 text-[#1D2124] dark:text-[#DDE1E5] font-rubik">
            Select Difficulty
          </Text>
          <Text className="text-base mb-5 text-center text-[#4B4B4B] dark:text-[#DDE1E5]/70 font-rubik">
            Choose a difficulty to start your game.
          </Text>

          <View className="w-full mb-5">
            <Text className="text-base mb-2.5 text-[#2B2B2B] dark:text-[#DDE1E5] font-rubik">
              Select Difficulty:
            </Text>
            <View className="flex-row justify-between gap-2.5">
              {difficulties.map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  className={`flex-1 p-2.5 rounded-lg border ${selectedDifficulty === value
                      ? 'bg-[#8B0000] border-[#8B0000]'
                      : 'border-[#E5E5E5] dark:border-[#2A3136]'
                    }`}
                  onPress={() => setSelectedDifficulty(value)}
                >
                  <Text
                    className={`text-center text-sm font-rubik ${selectedDifficulty === value
                        ? 'text-white'
                        : 'text-[#666666] dark:text-[#DDE1E5]/70'
                      }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="flex-row gap-2.5">
            <TouchableOpacity
              className="flex-row items-center bg-[#8B0000] p-2.5 px-5 gap-2"
              onPress={handleStart}
            >
              <Swords size={20} color="#FFFFFF" />
              <Text className="text-base text-white font-rubik">Start</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center bg-[#F8F8F5] dark:bg-[#1A2227] p-2.5 px-5 border border-[#E5E5E5] dark:border-[#2A3136] gap-2"
              onPress={onClose}
            >
              <X size={20} color="#666666" />
              <Text className="text-base text-[#666666] dark:text-[#DDE1E5]/70 font-rubik">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
