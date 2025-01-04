import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useChallenge } from '~/hooks/useChallenge';
import { Swords, X } from 'lucide-react-native';

type ChallengeDialogProps = {
  isVisible: boolean;
  onClose: () => void;
  friendId: number;
  friendName: string;
};

export const ChallengeDialog = ({ isVisible, onClose, friendId, friendName }: ChallengeDialogProps) => {
  const { sendChallenge } = useChallenge();
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('easy');

  const handleChallenge = () => {
    sendChallenge.mutate({
      challengedId: friendId,
      difficulty: selectedDifficulty,
    });
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
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.title}>Challenge Friend</Text>
          <Text style={styles.message}>
            Challenge {friendName} to a game!
          </Text>

          <View style={styles.difficultySection}>
            <Text style={styles.difficultyLabel}>Select Difficulty:</Text>
            <View style={styles.difficultyButtons}>
              {difficulties.map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.difficultyButton,
                    selectedDifficulty === value && styles.selectedDifficulty,
                  ]}
                  onPress={() => setSelectedDifficulty(value)}
                >
                  <Text
                    style={[
                      styles.difficultyButtonText,
                      selectedDifficulty === value && styles.selectedDifficultyText,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.challengeButton]}
              onPress={handleChallenge}
              disabled={sendChallenge.isPending}
            >
              {sendChallenge.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Swords size={20} color="#FFFFFF" />
                  <Text style={[styles.buttonText, styles.challengeText]}>Challenge</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={sendChallenge.isPending}
            >
              <X size={20} color="#666666" />
              <Text style={[styles.buttonText, styles.cancelText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 300,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 15,
    color: '#2B2B2B',
    fontFamily: 'Times New Roman',
  },
  message: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#4B4B4B',
    fontFamily: 'Times New Roman',
  },
  difficultySection: {
    width: '100%',
    marginBottom: 20,
  },
  difficultyLabel: {
    fontSize: 16,
    marginBottom: 10,
    color: '#2B2B2B',
    fontFamily: 'Times New Roman',
  },
  difficultyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  difficultyButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  selectedDifficulty: {
    backgroundColor: '#8B0000',
    borderColor: '#8B0000',
  },
  difficultyButtonText: {
    color: '#666666',
    fontSize: 14,
    fontFamily: 'Times New Roman',
  },
  selectedDifficultyText: {
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  challengeButton: {
    backgroundColor: '#8B0000',
  },
  cancelButton: {
    backgroundColor: '#F8F8F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Times New Roman',
  },
  challengeText: {
    color: '#FFFFFF',
  },
  cancelText: {
    color: '#666666',
  },
}); 