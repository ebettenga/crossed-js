import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ClueDisplayProps {
  text: string;
}

export const ClueDisplay: React.FC<ClueDisplayProps> = ({ text }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.clue}>
        <Text style={styles.text}>{text}</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 16,
    backgroundColor: '#F5F5EB', // Match newspaper theme
    borderTopWidth: 1,
    borderColor: '#2B2B2B',
  },
  clue: {
    fontFamily: 'Times New Roman',
    fontSize: 16,
    lineHeight: 24,
  },
  number: {
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  text: {
    color: '#2B2B2B',
  },
}); 