import React, { useState, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useChallenge } from '~/hooks/useChallenge';
import { Swords, X } from 'lucide-react-native';
import { useSound } from '~/hooks/useSound';
import { useSoundPreference } from '~/hooks/useSoundPreference';
import { pencilSounds, randomPencilKey } from '~/assets/sounds/randomButtonSound';
import { showToast } from '~/components/shared/Toast';

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

  const handleChallenge = useCallback(async () => {
    if (!friendId || sendChallenge.isPending) return;

    try {
      await sendChallenge.mutateAsync({
        challengedId: friendId,
        difficulty: selectedDifficulty,
      });

      const successMessage = friendName ? `Challenge sent to ${friendName}` : 'Challenge sent';
      showToast('success', successMessage);
      setSelectedDifficulty('easy');
      void play(randomPencilKey()).catch(() => { });
      onClose();
    } catch (error) {
      showToast('error', 'Failed to send challenge');
    }
  }, [friendId, friendName, onClose, play, selectedDifficulty, sendChallenge]);

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
          <Text className="text-2xl font-semibold mb-4 text-[#1D2124] dark:text-[#DDE1E5] font-rubik">
            Challenge Friend
          </Text>
          <Text className="text-base mb-5 text-center text-[#4B4B4B] dark:text-[#DDE1E5]/70 font-rubik">
            Challenge {friendName} to a game!
          </Text>

          <View className="w-full mb-5">
            <Text className="text-base mb-2.5 text-[#2B2B2B] dark:text-[#DDE1E5] font-rubik">
              Select Difficulty:
            </Text>
            <View className="flex-row w-full" style={{ width: '100%' }}>
              {difficulties.map(({ label, value }, index) => (
                <TouchableOpacity
                  key={value}
                  className={`flex-1 p-2.5 rounded-lg border ${selectedDifficulty === value
                    ? 'bg-[#8B0000] border-[#8B0000]'
                    : 'border-[#E5E5E5] dark:border-[#2A3136]'
                    }`}
                  style={{
                    marginRight: index !== difficulties.length - 1 ? 10 : 0,
                    flexBasis: 0,
                    minWidth: 0,
                  }}
                  onPress={async () => {
                    setSelectedDifficulty(value);
                  }}
                >
                  <Text
                    className={`text-center text-sm font-rubik ${selectedDifficulty === value
                      ? 'text-white'
                      : 'text-[#666666] dark:text-[#DDE1E5]/70'
                      }`}
                    style={{ flexShrink: 0 }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="flex-row w-full" style={{ width: '100%' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <TouchableOpacity
                className="flex-row items-center justify-center bg-[#8B0000] p-2.5 px-5 gap-2"
                style={{ width: '100%' }}
                onPress={handleChallenge}
                disabled={sendChallenge.isPending}
              >
                {sendChallenge.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Swords size={20} color="#FFFFFF" />
                    <Text className="text-base text-white font-rubik">Challenge</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <TouchableOpacity
                className="flex-row items-center justify-center bg-[#F8F8F5] dark:bg-[#1A2227] p-2.5 px-5 border border-[#E5E5E5] dark:border-[#2A3136] gap-2"
                style={{ width: '100%' }}
                onPress={onClose}
                disabled={sendChallenge.isPending}
              >
                <X size={20} color="#666666" />
                <Text className="text-base text-[#666666] dark:text-[#DDE1E5]/70 font-rubik">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};
