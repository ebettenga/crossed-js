import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Square } from '~/hooks/socket';

interface ClueDisplayProps {
  selectedSquare: Square | null;
  isAcrossMode: boolean;
}

export const ClueDisplay: React.FC<ClueDisplayProps> = ({ selectedSquare, isAcrossMode }) => {
  if (!selectedSquare) return null;
  console.log('selectedSquare', selectedSquare);
  console.log('isAcrossMode', isAcrossMode);
  const clue = isAcrossMode ? selectedSquare.acrossQuestion : selectedSquare.downQuestion;
  const direction = isAcrossMode ? 'Across' : 'Down';
  
  if (!clue) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.direction}>{direction}</Text>
      <Text style={styles.clueText}>{clue}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  direction: {
    fontSize: 14,
    color: '#2B2B2B',
    fontWeight: '600',
    marginBottom: 4,
  },
  clueText: {
    fontSize: 16,
    color: '#2B2B2B',
    lineHeight: 24,
  },
}); 