import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useChallenge } from '~/hooks/useChallenge';
import { Swords, X } from 'lucide-react-native';
import { useSound } from '~/hooks/useSound';
import { useSoundPreference } from '~/hooks/useSoundPreference';
import { pencilSounds, randomPencilKey } from '~/assets/sounds/randomButtonSound';

type ChallengeDialogProps = {
  isVisible: boolean;
  onClose: () => void;
  friendId: number;
  friendName: string;
};

export const ChallengeDialog = ({ isVisible, onClose, friendId, friendName }: ChallengeDialogProps) => {
  const { sendChallenge } = useChallenge();
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('easy');
  const { isSoundEnabled } = useSoundPreference();
  const { play } = useSound(pencilSounds, { enabled: isSoundEnabled });

  const handleChallenge = async () => {
    console.log('[ChallengeDialog] Sending challenge');
    sendChallenge.mutate({
      challengedId: friendId,
      difficulty: selectedDifficulty,
    });
    console.log('[ChallengeDialog] Playing sound before closing dialog');
    await play(randomPencilKey());
    console.log('[ChallengeDialog] Sound completed, closing dialog');
    onClose();
  };

  const difficulties = [
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
  ];

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="m-5 bg-white dark:bg-[#1A2227] rounded-[20px] p-8 items-center shadow-lg min-w-[300px]">
          <Text className="text-2xl font-semibold mb-4 text-[#1D2124] dark:text-[#DDE1E5] font-['Times New Roman']">
            Challenge Friend
          </Text>
          <Text className="text-base mb-5 text-center text-[#4B4B4B] dark:text-[#DDE1E5]/70 font-['Times New Roman']">
            Challenge {friendName} to a game!
          </Text>

          <View className="w-full mb-5">
            <Text className="text-base mb-2.5 text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']">
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
                  onPress={async () => {
                    setSelectedDifficulty(value);
                  }}
                >
                  <Text
                    className={`text-center text-sm font-['Times New Roman'] ${selectedDifficulty === value
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
              onPress={handleChallenge}
              disabled={sendChallenge.isPending}
            >
              {sendChallenge.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Swords size={20} color="#FFFFFF" />
                  <Text className="text-base text-white font-['Times New Roman']">Challenge</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center bg-[#F8F8F5] dark:bg-[#1A2227] p-2.5 px-5 border border-[#E5E5E5] dark:border-[#2A3136] gap-2"
              onPress={onClose}
              disabled={sendChallenge.isPending}
            >
              <X size={20} color="#666666" />
              <Text className="text-base text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman']">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
