import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Square } from '~/hooks/useRoom';

interface ClueDisplayProps {
  selectedSquare: Square | null;
  isAcrossMode: boolean;
}

export const ClueDisplay: React.FC<ClueDisplayProps> = ({ selectedSquare, isAcrossMode }) => {
  if (!selectedSquare) return null;
  const clue = isAcrossMode ? selectedSquare.acrossQuestion : selectedSquare.downQuestion;
  const direction = isAcrossMode ? 'Across' : 'Down';

  if (!clue) return null;

  const clueText = clue.split(".")[1];

  return (
    <View style={styles.container}>
      <Text style={styles.clueText}>{clueText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    display: 'flex',
  },
  direction: {
    fontSize: 14,
    color: '#2B2B2B',
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  clueText: {
    fontSize: 16,
    color: '#2B2B2B',
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 16,
    flexWrap: 'nowrap',
    flexShrink: 1
  },
});
